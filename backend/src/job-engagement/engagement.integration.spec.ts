import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { appDataSource } from '../database/data-source';
import { EngagementService } from './engagement.service';
import type { JobEventsGateway } from './job-events.gateway';
import { JobOutbox } from './job-outbox.service';

const connection = process.env.MISTRI_PHASE7_TEST_DATABASE_URL;
const integration = connection ? describe : describe.skip;

integration('Phase 7 with PostgreSQL/PostGIS', () => {
  let db: DataSource;
  let engagement: EngagementService;
  const customer = randomUUID();
  const mechanic = randomUUID();
  const outsider = randomUUID();
  const job = randomUUID();

  beforeAll(async () => {
    const target = new URL(connection!);
    if (
      target.hostname !== '127.0.0.1' ||
      !/^\/mistri_phase7_test_[a-z0-9_]+$/.test(target.pathname)
    ) {
      throw new Error('Use a dedicated loopback mistri_phase7_test_* database.');
    }
    const options = appDataSource.options;
    if (options.type !== 'postgres') throw new Error('Expected PostgreSQL configuration');
    db = new DataSource({
      ...options,
      url: connection,
      ssl: false,
    });
    await db.initialize();
    await db.runMigrations();
    engagement = new EngagementService(db);
    await db.query(
      "INSERT INTO users(id,role) VALUES ($1,'customer'),($2,'mechanic'),($3,'customer')",
      [customer, mechanic, outsider],
    );
    const [vehicle] = await db.query<Array<{ id: string }>>(
      "INSERT INTO vehicles(customer_id,label,vehicle_type) VALUES ($1,'Fixture','car') RETURNING id",
      [customer],
    );
    if (!vehicle) throw new Error('Missing vehicle fixture');
    await db.query(
      `
      INSERT INTO service_requests(id, customer_id, vehicle_id, service_type, description, location)
      VALUES ($1,$2,$3,'flat tyre','Fixture',ST_SetSRID(ST_MakePoint(90.4,23.75),4326)::geography)
    `,
      [job, customer, vehicle.id],
    );
  });

  afterAll(async () => {
    if (!db?.isInitialized) return;
    try {
      await db.query('DELETE FROM service_requests WHERE id = $1', [job]);
      await db.query('DELETE FROM users WHERE id IN ($1,$2,$3)', [customer, mechanic, outsider]);
    } finally {
      await db.destroy();
    }
  });

  it('queues only participants and rolls back the event with the status write', async () => {
    const assign = `UPDATE service_requests SET status = 'assigned', mechanic_id = $2,
      accepted_at = now() WHERE id = $1`;
    await expect(
      db.transaction(async (tx) => {
        await tx.query(assign, [job, mechanic]);
        throw new Error('forced rollback');
      }),
    ).rejects.toThrow('forced rollback');
    expect(await db.query('SELECT id FROM job_outbox WHERE request_id = $1', [job])).toEqual([]);
    await db.query(assign, [job, mechanic]);
    const recipients = await db.query<Array<{ recipient_id: string }>>(
      'SELECT recipient_id FROM job_outbox WHERE request_id = $1',
      [job],
    );
    expect(recipients.map((row) => row.recipient_id).sort()).toEqual([customer, mechanic].sort());
  });

  it('deduplicates concurrent chat retries and keeps the conversation private', async () => {
    const dto = { clientId: randomUUID(), body: 'On my way' };
    const results = await Promise.all([
      engagement.send(mechanic, job, dto),
      engagement.send(mechanic, job, dto),
    ]);
    expect(results[0]).toEqual(results[1]);
    const messages = await engagement.messages(customer, job);
    expect(messages.items).toHaveLength(1);
    await expect(engagement.messages(outsider, job)).rejects.toMatchObject({ status: 404 });
    await expect(engagement.send(outsider, job, dto)).rejects.toMatchObject({ status: 404 });
    await expect(
      engagement.send(mechanic, job, { ...dto, body: 'Different content' }),
    ).rejects.toMatchObject({ status: 409 });
    const message = messages.items[0];
    if (!message) throw new Error('Missing message fixture');
    await expect(engagement.report(outsider, job, message.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(engagement.report(customer, job, message.id)).resolves.toEqual({ reported: true });
    await expect(engagement.report(customer, job, message.id)).resolves.toEqual({ reported: true });
    const events = await db.query('SELECT id FROM job_outbox WHERE request_id = $1 AND kind = $2', [
      job,
      'message',
    ]);
    expect(events).toHaveLength(1);
  });

  it('rejects premature reviews, locks completed chat, and accepts one customer review', async () => {
    await expect(engagement.review(customer, job, { rating: 5 })).rejects.toMatchObject({
      status: 409,
    });
    await db.query(
      "UPDATE service_requests SET status = 'completed', completed_at = now() WHERE id = $1",
      [job],
    );
    await expect(
      engagement.send(customer, job, { body: 'Hello', clientId: randomUUID() }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(engagement.review(outsider, job, { rating: 5 })).rejects.toMatchObject({
      status: 404,
    });
    const results = await Promise.allSettled([
      engagement.review(customer, job, { rating: 5 }),
      engagement.review(customer, job, { rating: 5 }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    await expect(engagement.reviewSummary(mechanic)).resolves.toEqual({ average: 5, count: 1 });
    await db.query('UPDATE job_reviews SET published = false WHERE request_id = $1', [job]);
    await expect(engagement.reviewSummary(mechanic)).resolves.toEqual({ average: null, count: 0 });
  });

  it('queues a private invalidation and revokes tokens rejected by Expo receipts', async () => {
    const token = 'ExpoPushToken[' + randomUUID() + ']';
    await engagement.register(customer, { token });
    await db.query('DELETE FROM job_outbox WHERE request_id = $1', [job]);
    await db.query(
      "INSERT INTO job_outbox(request_id, recipient_id, kind, notify) VALUES ($1,$2,'status',true)",
      [job, customer],
    );
    const invalidate = jest.fn();
    const worker = new JobOutbox(db, { invalidate } as unknown as JobEventsGateway);
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ data: [{ status: 'ok', id: 'receipt-test' }] }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            'receipt-test': { status: 'error', details: { error: 'DeviceNotRegistered' } },
          },
        }),
      );
    try {
      await worker.dispatchOnce();
      expect(invalidate).toHaveBeenCalledWith(customer, {
        id: expect.any(String),
        jobId: job,
        kind: 'status',
      });
      const sent = fetcher.mock.calls[0]?.[1]?.body;
      expect(typeof sent === 'string' && JSON.parse(sent)).toEqual([
        expect.objectContaining({ to: token, data: { jobId: job } }),
      ]);
      expect(
        await db.query('SELECT receipt_id FROM job_push_deliveries WHERE token = $1', [token]),
      ).toEqual([{ receipt_id: 'receipt-test' }]);
      await db.query('UPDATE job_push_deliveries SET due_at = now() WHERE token = $1', [token]);
      await worker.dispatchOnce();
      expect(
        await db.query('SELECT token FROM push_installations WHERE token = $1', [token]),
      ).toEqual([]);
      expect(
        await db.query('SELECT id FROM job_push_deliveries WHERE token = $1', [token]),
      ).toEqual([]);
    } finally {
      fetcher.mockRestore();
    }
  });

  it('revokes only the requesting account installation', async () => {
    const dto = { token: 'ExpoPushToken[' + randomUUID() + ']' };
    await engagement.register(customer, dto);
    await engagement.register(mechanic, dto);
    await engagement.revoke(customer, dto);
    expect(
      await db.query('SELECT user_id FROM push_installations WHERE token = $1', [dto.token]),
    ).toEqual([{ user_id: mechanic }]);
    await engagement.revoke(mechanic, dto);
    expect(
      await db.query('SELECT user_id FROM push_installations WHERE token = $1', [dto.token]),
    ).toEqual([]);
  });
});
