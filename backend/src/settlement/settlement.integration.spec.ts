import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { appDataSource } from '../database/data-source';
import { Vehicle } from '../vehicles/vehicle.entity';
import { MechanicProfile } from '../mechanics/mechanic-profile.entity';
import { ServiceRequest } from '../service-requests/service-request.entity';
import { ServiceRequestsService } from '../service-requests/service-requests.service';
import { MechanicServiceRequestAction as Action } from '../service-requests/mechanic-service-request-action.enum';
import { SettlementService } from './settlement.service';
import { ManualBkashProvider } from './topup-provider';

const connection = process.env.MISTRI_PHASE8_TEST_DATABASE_URL;
(connection ? describe : describe.skip)('Phase 8 settlement on PostgreSQL', () => {
  let db: DataSource;
  let settlement: SettlementService;
  let jobs: ServiceRequestsService;
  const admin = randomUUID();
  const customer = randomUUID();
  let mechanic: string;
  let vehicleId: string;
  const previousSandbox = process.env.MISTRI_WALLET_SANDBOX;
  const previousRate = process.env.MISTRI_TEST_COMMISSION_BPS;
  beforeAll(async () => {
    const target = new URL(connection!);
    if (
      target.hostname !== '127.0.0.1' ||
      !/^\/mistri_phase8_test_[a-z0-9_]+$/.test(target.pathname) ||
      target.search
    )
      throw new Error('Use a dedicated loopback mistri_phase8_test_* database.');
    const options = appDataSource.options;
    if (options.type !== 'postgres') throw new Error('Postgres required');
    process.env.MISTRI_WALLET_SANDBOX = 'true';
    process.env.MISTRI_TEST_COMMISSION_BPS = '1000';
    db = new DataSource({ ...options, url: connection, ssl: false });
    await db.initialize();
    await db.runMigrations();
    settlement = new SettlementService(db, new ManualBkashProvider());
    jobs = new ServiceRequestsService(
      db.getRepository(ServiceRequest),
      db.getRepository(Vehicle),
      db.getRepository(MechanicProfile),
    );
    await db.query("INSERT INTO users(id,role) VALUES($1,'admin'),($2,'customer')", [
      admin,
      customer,
    ]);
    const [vehicle] = await db.query(
      "INSERT INTO vehicles(customer_id,label,vehicle_type) VALUES($1,'Test','car') RETURNING id",
      [customer],
    );
    vehicleId = vehicle.id;
  }, 30000);
  beforeEach(async () => {
    mechanic = randomUUID();
    await db.query("INSERT INTO users(id,role) VALUES($1,'mechanic')", [mechanic]);
    await db.query(
      "INSERT INTO mechanics(user_id,display_name,is_online) VALUES($1,'Test mechanic',true)",
      [mechanic],
    );
  });
  afterAll(async () => {
    if (previousSandbox === undefined) delete process.env.MISTRI_WALLET_SANDBOX;
    else process.env.MISTRI_WALLET_SANDBOX = previousSandbox;
    if (previousRate === undefined) delete process.env.MISTRI_TEST_COMMISSION_BPS;
    else process.env.MISTRI_TEST_COMMISSION_BPS = previousRate;
    if (db?.isInitialized) await db.destroy();
  });
  async function arrivedJob() {
    const job = await jobs.create(customer, {
      vehicleId,
      description: 'Fixture job',
      serviceType: 'tyre',
      latitude: 23.7,
      longitude: 90.4,
    });
    await jobs.accept(mechanic, job.id);
    await jobs.transitionAsMechanic(mechanic, job.id, { action: Action.START_TRAVEL });
    await jobs.transitionAsMechanic(mechanic, job.id, { action: Action.ARRIVE });
    return job;
  }
  async function fund(amount: number) {
    const row = await settlement.submit(mechanic, amount, randomUUID().replaceAll('-', ''));
    await settlement.decide(admin, row.id, 'approved', 'Matched fixture statement');
  }
  const start = (id: string) =>
    jobs.transitionAsMechanic(mechanic, id, { action: Action.START_SERVICE });
  const complete = (id: string) =>
    jobs.transitionAsMechanic(mechanic, id, { action: Action.COMPLETE });

  it('verifies deposits once, rejects conflicting references, and checks current staff role', async () => {
    const reference = randomUUID().replaceAll('-', '');
    const row = await settlement.submit(mechanic, 500, reference);
    expect(await settlement.submit(mechanic, 500, reference.toUpperCase())).toEqual(row);
    await expect(settlement.submit(mechanic, 501, reference)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      settlement.decide(mechanic, row.id, 'approved', 'Unauthorized'),
    ).rejects.toMatchObject({ status: 403 });
    const formerAdmin = randomUUID();
    await db.query("INSERT INTO users(id,role) VALUES($1,'admin')", [formerAdmin]);
    await db.query("UPDATE users SET role='customer' WHERE id=$1", [formerAdmin]);
    await expect(
      settlement.decide(formerAdmin, row.id, 'approved', 'Old session'),
    ).rejects.toMatchObject({ status: 403 });
    const decide = () => settlement.decide(admin, row.id, 'approved', 'Matched statement');
    await Promise.all([decide(), decide()]);
    await expect(settlement.decide(admin, row.id, 'rejected', 'Duplicate')).rejects.toMatchObject({
      status: 409,
    });
    const rejected = await settlement.submit(mechanic, 800, randomUUID().replaceAll('-', ''));
    await settlement.decide(admin, rejected.id, 'rejected', 'Reference missing');
    const wallet = await settlement.wallet(mechanic);
    expect(wallet.balance).toBe('500');
    expect(wallet.entries).toHaveLength(1);
    await expect(
      db.query('UPDATE wallet_entries SET amount=1 WHERE source_id=$1', [row.id]),
    ).rejects.toThrow('immutable');
    expect(await db.query('SELECT kind FROM wallet_audit WHERE source_id=$1', [row.id])).toEqual([
      { kind: 'approved' },
    ]);
  });
  it('preserves accepted quotes, rounds to poisha, and posts a single debit and reversal', async () => {
    const { id, priced } = await arrivedJob();
    expect(priced).toBe(true);
    await expect(start(id)).rejects.toMatchObject({ status: 409 });
    const before = await settlement.propose(mechanic, id, 4, 1);
    expect(before?.fee).toBe(0);
    const quote = await settlement.propose(mechanic, id, 5, 2);
    expect(quote?.fee).toBe(1);
    await expect(settlement.accept(customer, id, before!.id)).rejects.toMatchObject({
      status: 409,
    });
    await expect(settlement.pricing(admin, id)).rejects.toMatchObject({ status: 404 });
    await settlement.accept(customer, id, quote!.id);
    await expect(
      db.query('UPDATE job_quotes SET amount=6 WHERE id=$1', [quote!.id]),
    ).rejects.toThrow('replacement quote');
    await expect(start(id)).rejects.toMatchObject({ status: 409 });
    await fund(100);
    await start(id);
    const larger = await settlement.propose(mechanic, id, 100000000, 3);
    expect(larger?.fee).toBe(10000000);
    await expect(settlement.accept(customer, id, larger!.id)).rejects.toMatchObject({
      status: 409,
    });
    expect(await settlement.pricing(customer, id)).toMatchObject({
      needsTopup: true,
      accepted: { id: quote!.id },
    });
    const replacement = await settlement.propose(mechanic, id, 905, 4);
    await settlement.accept(customer, id, replacement!.id);
    expect(await settlement.wallet(mechanic)).toMatchObject({ balance: '100', reserved: '91' });
    await Promise.all([complete(id), complete(id)]);
    expect(await jobs.confirmCashPayment(customer, id)).toMatchObject({ status: 'paid' });
    expect(await complete(id)).toMatchObject({ status: 'paid' });
    expect(await settlement.wallet(mechanic)).toMatchObject({ balance: '9', reserved: '0' });
    const reverse = () => settlement.correctJob(admin, id, 'refund', 'Resolved dispute');
    await Promise.all([reverse(), reverse()]);
    expect(await settlement.wallet(mechanic)).toMatchObject({ balance: '100', reserved: '0' });
    expect(await settlement.reconcile()).toEqual([]);
  });
  it('serializes competing reservations and releases an abandoned job without charging', async () => {
    const ids = await Promise.all([arrivedJob(), arrivedJob()]);
    await fund(100);
    for (const job of ids) {
      const quote = await settlement.propose(mechanic, job.id, 1000, 1);
      await settlement.accept(customer, job.id, quote!.id);
    }
    const results = await Promise.allSettled(ids.map((job) => start(job.id)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const active = ids[results.findIndex((r) => r.status === 'fulfilled')]!;
    await settlement.correctJob(admin, active.id, 'release', 'Abandoned test job');
    expect(await settlement.wallet(mechanic)).toMatchObject({ balance: '100', reserved: '0' });
    await start(ids.find((j) => j.id !== active.id)!.id);
    expect(await settlement.reconcile()).toEqual([]);
  });
  it('lets legacy jobs complete after pricing is enabled', async () => {
    process.env.MISTRI_WALLET_SANDBOX = 'false';
    let job;
    try {
      job = await arrivedJob();
    } finally {
      process.env.MISTRI_WALLET_SANDBOX = 'true';
    }
    expect(job.priced).toBe(false);
    await start(job.id);
    await complete(job.id);
    expect(await settlement.wallet(mechanic)).toMatchObject({
      balance: '0',
      reserved: '0',
      entries: [],
    });
  });
  it('keeps an active reservation intact while sandbox writes are disabled', async () => {
    const { id } = await arrivedJob();
    const quote = await settlement.propose(mechanic, id, 1000, 1);
    await settlement.accept(customer, id, quote!.id);
    await fund(100);
    await start(id);
    process.env.MISTRI_WALLET_SANDBOX = 'false';
    try {
      await expect(complete(id)).rejects.toMatchObject({ status: 403 });
      await expect(settlement.propose(mechanic, id, 2000, 2)).rejects.toMatchObject({
        status: 403,
      });
    } finally {
      process.env.MISTRI_WALLET_SANDBOX = 'true';
    }
    expect(await settlement.wallet(mechanic)).toMatchObject({ balance: '100', reserved: '100' });
    await complete(id);
    expect(await settlement.wallet(mechanic)).toMatchObject({ balance: '0', reserved: '0' });
  });
});
