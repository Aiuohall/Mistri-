import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { JobEventsGateway } from './job-events.gateway';

interface Invalidation {
  id: string;
  request_id: string;
  recipient_id: string;
  kind: string;
  notify: boolean;
}
interface Delivery {
  id: string;
  token: string;
  recipient_id: string;
  request_id: string;
  attempts: number;
  receipt_id: string | null;
  generation: Date;
}
interface ExpoResult {
  status?: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
}

@Injectable()
export class JobOutbox implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(JobOutbox.name);
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(JobEventsGateway) private readonly gateway: JobEventsGateway,
  ) {}

  onApplicationBootstrap() {
    this.schedule();
  }

  onApplicationShutdown() {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  private schedule() {
    if (!this.stopped) this.timer = setTimeout(() => void this.run(), 2000);
  }

  private async run() {
    try {
      await this.dispatchOnce();
    } catch {
      this.logger.warn('Job delivery queue could not complete its current pass.');
    } finally {
      this.schedule();
    }
  }

  async dispatchOnce() {
    await this.dispatchEvents();
    await this.dispatchPush();
  }

  private async dispatchEvents() {
    await this.db.transaction(async (db) => {
      const events = await db.query<Invalidation[]>(`
        SELECT o.id::text, o.request_id, o.recipient_id, o.kind, o.notify
        FROM job_outbox o
        JOIN service_requests r ON r.id = o.request_id
        JOIN users u ON u.id = o.recipient_id
        WHERE (r.customer_id = u.id AND u.role = 'customer')
           OR (r.mechanic_id = u.id AND u.role = 'mechanic')
        ORDER BY o.id LIMIT 50 FOR UPDATE OF o SKIP LOCKED
      `);
      for (const event of events) {
        this.gateway.invalidate(event.recipient_id, {
          id: event.id,
          jobId: event.request_id,
          kind: event.kind,
        });
        if (event.notify) {
          await db.query(
            `
            INSERT INTO job_push_deliveries(event_id, request_id, recipient_id, token, generation)
            SELECT $1, $2, $3, token, updated_at FROM push_installations
            WHERE user_id = $3 AND last_seen_at > now() - interval '7 days'
            ON CONFLICT (event_id, token) DO NOTHING
          `,
            [event.id, event.request_id, event.recipient_id],
          );
        }
        await db.query('DELETE FROM job_outbox WHERE id = $1', [event.id]);
      }
      await db.query("DELETE FROM job_outbox WHERE created_at < now() - interval '1 day'");
    });
  }

  private async dispatchPush() {
    const deliveries = await this.db.query<Delivery[]>(`
      WITH claim AS (
        SELECT p.id FROM job_push_deliveries p
        JOIN push_installations i ON i.token = p.token AND i.user_id = p.recipient_id
          AND i.updated_at = p.generation
        JOIN service_requests r ON r.id = p.request_id
        JOIN users u ON u.id = p.recipient_id
        WHERE p.due_at <= now() AND p.attempts < 7
          AND p.created_at > now() - interval '1 day'
          AND ((r.customer_id = u.id AND u.role = 'customer') OR (r.mechanic_id = u.id AND u.role = 'mechanic'))
        ORDER BY p.due_at, p.id LIMIT 10 FOR UPDATE OF p SKIP LOCKED
      ), leased AS (
        UPDATE job_push_deliveries p SET due_at = now() + interval '3 minutes', attempts = attempts + 1
        FROM claim WHERE claim.id = p.id RETURNING p.*
      ) SELECT * FROM leased
    `);
    await Promise.all(deliveries.map((delivery) => this.deliver(delivery)));
    await this.db.query(
      "DELETE FROM job_push_deliveries WHERE created_at <= now() - interval '1 day'",
    );
  }

  private async deliver(delivery: Delivery) {
    try {
      const result = await this.sendOrReadReceipt(delivery);
      const error = result?.details?.error;
      if (error === 'DeviceNotRegistered') {
        await this.db.query(
          'DELETE FROM push_installations WHERE token = $1 AND user_id = $2 AND updated_at = $3',
          [delivery.token, delivery.recipient_id, delivery.generation],
        );
      } else if (!result || error === 'MessageRateExceeded') {
        await this.retry(delivery);
        return;
      } else if (result.status === 'ok' && !delivery.receipt_id && result.id) {
        await this.db.query(
          `
          UPDATE job_push_deliveries SET receipt_id = $2, attempts = 0,
            due_at = now() + interval '15 minutes' WHERE id = $1
        `,
          [delivery.id, result.id],
        );
        return;
      }
      await this.db.query('DELETE FROM job_push_deliveries WHERE id = $1', [delivery.id]);
    } catch {
      await this.retry(delivery);
    }
  }

  private async retry(delivery: Delivery) {
    const delay = Math.min(3600, 30 * 2 ** delivery.attempts) + Math.floor(Math.random() * 15);
    await this.db.query(
      "UPDATE job_push_deliveries SET due_at = now() + ($2 * interval '1 second') WHERE id = $1",
      [delivery.id, delay],
    );
  }

  private async sendOrReadReceipt(delivery: Delivery): Promise<ExpoResult | undefined> {
    const receipt = delivery.receipt_id;
    const accessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;
    const response = await fetch(
      'https://exp.host/--/api/v2/push/' + (receipt ? 'getReceipts' : 'send'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}),
        },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify(
          receipt
            ? { ids: [receipt] }
            : [
                {
                  to: delivery.token,
                  title: 'Mistri',
                  body: 'You have a job update. / আপনার কাজের নতুন খবর আছে।',
                  channelId: 'job-updates',
                  ttl: 3600,
                  data: { jobId: delivery.request_id },
                },
              ],
        ),
      },
    );
    if (response.status === 429 || response.status >= 500)
      throw new Error('Push temporarily unavailable');
    if (!response.ok) return { status: 'error' };
    const payload = (await response.json()) as { data?: Record<string, ExpoResult> | ExpoResult[] };
    return receipt
      ? (payload.data as Record<string, ExpoResult> | undefined)?.[receipt]
      : (payload.data as ExpoResult[] | undefined)?.[0];
  }
}
