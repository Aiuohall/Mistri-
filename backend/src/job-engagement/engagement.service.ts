import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import type { PushTokenDto, ReviewDto, SendMessageDto } from './engagement.dto';

const messageFields = 'id::text, sender_id AS "senderId", body, created_at AS "createdAt"';
const isMessageId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[1-9][0-9]{0,18}$/.test(value) &&
  BigInt(value) <= 9223372036854775807n;

export interface Message {
  id: string;
  senderId: string;
  body: string;
  createdAt: Date;
}
interface JobAccess {
  customer_id: string;
  mechanic_id: string | null;
  status: string;
}

@Injectable()
export class EngagementService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  private async participant(db: EntityManager, user: string, job: string, lock = false) {
    const [row] = await db.query<JobAccess[]>(
      `
      SELECT customer_id, mechanic_id, status FROM service_requests
      WHERE id = $1 AND (customer_id = $2 OR mechanic_id = $2) ${lock ? 'FOR UPDATE' : ''}
    `,
      [job, user],
    );
    if (!row || !row.mechanic_id) throw new NotFoundException('Job conversation not found.');
    return row;
  }

  async messages(user: string, job: string, before?: string) {
    if (before !== undefined && !isMessageId(before)) {
      throw new BadRequestException('Invalid message cursor.');
    }
    await this.participant(this.db.manager, user, job);
    const rows = await this.db.query<Message[]>(
      `
      SELECT ${messageFields} FROM job_messages
      WHERE request_id = $1 AND ($2::bigint IS NULL OR id < $2)
      ORDER BY id DESC LIMIT 51
    `,
      [job, before ?? null],
    );
    const items = rows.slice(0, 50);
    return { items, nextCursor: rows.length > 50 ? (items.at(-1)?.id ?? null) : null };
  }

  async send(user: string, job: string, dto: SendMessageDto) {
    return this.db.transaction(async (db) => {
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        'job-message:' + user,
      ]);
      const access = await this.participant(db, user, job, true);
      const [existing] = await db.query<Message[]>(
        `
        SELECT ${messageFields} FROM job_messages
        WHERE request_id = $1 AND sender_id = $2 AND client_id = $3
      `,
        [job, user, dto.clientId],
      );
      if (existing) {
        if (existing.body !== dto.body) throw new ConflictException('Message key already used.');
        return existing;
      }
      if (!['assigned', 'en_route', 'arrived', 'in_progress'].includes(access.status)) {
        throw new ConflictException('This conversation is read-only.');
      }
      const [quota] = await db.query<Array<{ count: number }>>(
        `
        SELECT count(*)::int AS count FROM job_messages
        WHERE sender_id = $1 AND created_at >= now() - interval '10 seconds'
      `,
        [user],
      );
      if ((quota?.count ?? 0) >= 10) throw new HttpException('Message rate limit reached.', 429);
      const [message] = await db.query<Message[]>(
        `
        INSERT INTO job_messages(request_id, sender_id, client_id, body)
        VALUES ($1, $2, $3, $4) RETURNING ${messageFields}
      `,
        [job, user, dto.clientId, dto.body],
      );
      const recipient = user === access.customer_id ? access.mechanic_id : access.customer_id;
      await db.query(
        `
        INSERT INTO job_outbox(request_id, recipient_id, kind, notify)
        VALUES ($1, $2, 'message', true)
      `,
        [job, recipient],
      );
      return message;
    });
  }

  async review(user: string, job: string, dto: ReviewDto) {
    const result = await this.db.query<Array<{ rating: number }>>(
      `
      INSERT INTO job_reviews(request_id, mechanic_id, rating, comment)
      SELECT id, mechanic_id, $3, $4 FROM service_requests
      WHERE id = $1 AND customer_id = $2 AND mechanic_id IS NOT NULL
        AND status IN ('completed', 'paid')
      ON CONFLICT (request_id) DO NOTHING RETURNING rating
    `,
      [job, user, dto.rating, dto.comment ?? ''],
    );
    if (result[0]) return result[0];
    const [request] = await this.db.query<Array<{ status: string }>>(
      'SELECT status FROM service_requests WHERE id = $1 AND customer_id = $2',
      [job, user],
    );
    if (!request) throw new NotFoundException('Service request not found.');
    throw new ConflictException('This request is not eligible for a new review.');
  }

  async report(user: string, job: string, message: string) {
    if (!isMessageId(message)) throw new BadRequestException('Invalid message ID.');
    await this.participant(this.db.manager, user, job);
    const [target] = await this.db.query<Array<{ id: string }>>(
      'SELECT id FROM job_messages WHERE id = $1 AND request_id = $2 AND sender_id <> $3',
      [message, job, user],
    );
    if (!target) throw new NotFoundException('Message not found.');
    await this.db.query(
      'INSERT INTO job_message_reports(message_id, reporter_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [message, user],
    );
    return { reported: true };
  }

  async reviewSummary(mechanic: string) {
    const [summary] = await this.db.query<Array<{ average: number | null; count: number }>>(
      `
      SELECT round(avg(rating), 1)::float8 AS average, count(*)::int AS count
      FROM job_reviews WHERE mechanic_id = $1 AND published
    `,
      [mechanic],
    );
    return summary;
  }

  async register(user: string, dto: PushTokenDto) {
    await this.db.query(
      `
      INSERT INTO push_installations(token, user_id) VALUES ($1, $2)
      ON CONFLICT (token) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        updated_at = CASE WHEN push_installations.user_id <> EXCLUDED.user_id THEN now()
          ELSE push_installations.updated_at END,
        last_seen_at = now()
    `,
      [dto.token, user],
    );
    return { registered: true };
  }

  async revoke(user: string, dto: PushTokenDto) {
    await this.db.query('DELETE FROM push_installations WHERE token = $1 AND user_id = $2', [
      dto.token,
      user,
    ]);
    return { registered: false };
  }
}
