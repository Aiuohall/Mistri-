import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { sandboxRate } from './sandbox';
import { TopupProvider, type Topup } from './topup-provider';

export interface Quote {
  id: string;
  version: number;
  amount: number;
  fee: number;
  accepted_at: Date | null;
}
interface Job {
  customer_id: string;
  mechanic_id: string;
  status: string;
  commission_bps: number | null;
}

@Injectable()
export class SettlementService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(TopupProvider) private readonly topups: TopupProvider,
  ) {}

  private async job(
    tx: EntityManager,
    actor: string,
    id: string,
    role: 'customer' | 'mechanic' | 'participant',
  ): Promise<Job> {
    const column =
      role === 'customer'
        ? 'customer_id=$2'
        : role === 'mechanic'
          ? 'mechanic_id=$2'
          : '(customer_id=$2 OR mechanic_id=$2)';
    const [job] = await tx.query<Job[]>(
      `SELECT status,customer_id,mechanic_id,commission_bps FROM service_requests WHERE id=$1 AND ${column} FOR UPDATE`,
      [id, actor],
    );
    if (!job || job.commission_bps === null) throw new NotFoundException('Priced job not found.');
    return job;
  }
  private async latest(tx: EntityManager, id: string, acceptedOnly = false) {
    const [quote] = await tx.query<Quote[]>(
      `SELECT id,version,amount,fee,accepted_at FROM job_quotes WHERE request_id=$1 ${acceptedOnly ? 'AND accepted_at IS NOT NULL' : ''} ORDER BY version DESC LIMIT 1`,
      [id],
    );
    return quote ?? null;
  }
  async pricing(actor: string, id: string) {
    return this.db.transaction(async (tx) => {
      const job = await this.job(tx, actor, id, 'participant');
      const current = await this.latest(tx, id);
      const accepted = await this.latest(tx, id, true);
      const [wallet] = await tx.query<{ available: string }[]>(
        `SELECT balance-reserved+coalesce(h.fee,0) AS available FROM wallets w
         LEFT JOIN commission_holds h ON h.request_id=$2 AND h.mechanic_id=w.mechanic_id
         WHERE w.mechanic_id=$1`,
        [job.mechanic_id, id],
      );
      const active = ['assigned', 'en_route', 'arrived', 'in_progress'].includes(job.status);
      return {
        current,
        accepted,
        rate: job.commission_bps,
        needsTopup: active && !!current && BigInt(wallet?.available ?? 0) < BigInt(current.fee),
      };
    });
  }
  async propose(actor: string, id: string, amount: number, version: number) {
    this.checkSandbox();
    return this.db.transaction(async (tx) => {
      const job = await this.job(tx, actor, id, 'mechanic');
      const [existing] = await tx.query<Quote[]>(
        'SELECT * FROM job_quotes WHERE request_id=$1 AND version=$2',
        [id, version],
      );
      if (existing?.amount === amount) return existing;
      const latest = await this.latest(tx, id);
      if (
        !['assigned', 'en_route', 'arrived', 'in_progress'].includes(job.status) ||
        version !== (latest?.version ?? 0) + 1
      )
        throw new ConflictException('Refresh the current quote.');
      const [quote] = await tx.query<Quote[]>(
        'INSERT INTO job_quotes(request_id,version,amount,rate) VALUES($1,$2,$3,$4) RETURNING *',
        [id, version, amount, job.commission_bps],
      );
      return quote;
    });
  }
  async accept(actor: string, id: string, quoteId: string) {
    this.checkSandbox();
    return this.db.transaction(async (tx) => {
      const job = await this.job(tx, actor, id, 'customer');
      const quote = await this.latest(tx, id);
      if (!quote || quote.id !== quoteId) throw new ConflictException('Refresh the current quote.');
      if (quote.accepted_at) return quote;
      if (!['assigned', 'en_route', 'arrived', 'in_progress'].includes(job.status))
        throw new ConflictException('Job is closed.');
      if (job.status === 'in_progress') {
        const [hold] = await tx.query<{ fee: number }[]>(
          'SELECT fee FROM commission_holds WHERE request_id=$1',
          [id],
        );
        if (!hold) throw new ConflictException('Missing reservation.');
        const delta = quote.fee - hold.fee;
        const wallets = await tx.query<{ mechanic_id: string }[]>(
          'WITH changed AS (UPDATE wallets SET reserved=reserved+$1 WHERE mechanic_id=$2 AND balance-reserved >= $1 RETURNING mechanic_id) SELECT * FROM changed',
          [delta, job.mechanic_id],
        );
        if (!wallets.length) throw new ConflictException('Mechanic wallet needs a top-up.');
        await tx.query('UPDATE commission_holds SET fee=$2 WHERE request_id=$1', [id, quote.fee]);
      }
      const [accepted] = await tx.query<Quote[]>(
        'WITH changed AS (UPDATE job_quotes SET accepted_at=now() WHERE id=$1 RETURNING *) SELECT * FROM changed',
        [quoteId],
      );
      return accepted;
    });
  }

  private checkSandbox() {
    if (sandboxRate() === null) throw new ForbiddenException('Test wallet is disabled.');
  }
  async wallet(actor: string) {
    this.checkSandbox();
    return this.db.transaction('REPEATABLE READ', async (tx) => {
      const [wallet] = await tx.query<{ balance: string; reserved: string }[]>(
        'SELECT balance,reserved FROM wallets WHERE mechanic_id=$1',
        [actor],
      );
      const entries = await tx.query(
        'SELECT id,kind,amount,created_at FROM wallet_entries WHERE mechanic_id=$1 ORDER BY id DESC LIMIT 50',
        [actor],
      );
      const topups = await tx.query(
        'SELECT id,reference,amount,status FROM wallet_topups WHERE mechanic_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50',
        [actor],
      );
      return {
        balance: wallet?.balance ?? '0',
        reserved: wallet?.reserved ?? '0',
        entries,
        topups,
      };
    });
  }
  async submit(actor: string, amount: number, reference: string) {
    this.checkSandbox();
    return this.db.transaction((tx) => this.topups.submit(tx, actor, amount, reference));
  }
  private async admin(tx: EntityManager, actor: string) {
    this.checkSandbox();
    const [admin] = await tx.query("SELECT id FROM users WHERE id=$1 AND role='admin' FOR SHARE", [
      actor,
    ]);
    if (!admin) throw new ForbiddenException();
  }
  pending() {
    this.checkSandbox();
    return this.db.query(
      "SELECT * FROM wallet_topups WHERE status='pending' ORDER BY created_at,id LIMIT 50",
    );
  }
  async decide(actor: string, id: string, status: 'approved' | 'rejected', reason: string) {
    return this.db.transaction(async (tx) => {
      await this.admin(tx, actor);
      const [row] = await tx.query<Topup[]>('SELECT * FROM wallet_topups WHERE id=$1 FOR UPDATE', [
        id,
      ]);
      if (!row) throw new NotFoundException();
      if (row.status !== 'pending') {
        const [same] = await tx.query(
          'SELECT 1 FROM wallet_audit WHERE kind=$1 AND source_id=$2 AND actor_id=$3 AND reason=$4',
          [status, id, actor, reason],
        );
        if (same && row.status === status) return row;
        throw new ConflictException('Top-up already decided.');
      }
      if (status === 'approved') {
        await tx.query('INSERT INTO wallets(mechanic_id) VALUES ($1) ON CONFLICT DO NOTHING', [
          row.mechanic_id,
        ]);
        await tx.query(
          "INSERT INTO wallet_entries(mechanic_id,kind,source_id,amount) VALUES($1,'topup',$2,$3)",
          [row.mechanic_id, id, row.amount],
        );
      }
      await tx.query('UPDATE wallet_topups SET status=$2 WHERE id=$1', [id, status]);
      await tx.query(
        'INSERT INTO wallet_audit(kind,source_id,actor_id,reason) VALUES($1,$2,$3,$4)',
        [status, id, actor, reason],
      );
      return { ...row, status };
    });
  }
  async correctJob(actor: string, id: string, action: 'refund' | 'release', reason: string) {
    return this.db.transaction(async (tx) => {
      await this.admin(tx, actor);
      const [job] = await tx.query<Job[]>(
        'SELECT status,mechanic_id FROM service_requests WHERE id=$1 AND commission_bps IS NOT NULL FOR UPDATE',
        [id],
      );
      if (!job) throw new NotFoundException();
      const [prior] = await tx.query<{ actor_id: string; reason: string }[]>(
        'SELECT actor_id,reason FROM wallet_audit WHERE kind=$1 AND source_id=$2',
        [action, id],
      );
      if (prior) {
        if (prior.actor_id !== actor || prior.reason !== reason)
          throw new ConflictException('Correction already recorded.');
        return { action };
      }
      if (action === 'release') {
        if (job.status !== 'in_progress')
          throw new ConflictException('Job has no active reservation.');
        await tx.query(
          "UPDATE service_requests SET status='cancelled',cancelled_at=now(),updated_at=now() WHERE id=$1",
          [id],
        );
      } else {
        const [charge] = await tx.query<{ amount: number }[]>(
          "SELECT amount FROM wallet_entries WHERE kind='commission' AND source_id=$1",
          [id],
        );
        if (!charge) throw new ConflictException('No commission to reverse.');
        await tx.query(
          "INSERT INTO wallet_entries(mechanic_id,kind,source_id,amount) VALUES($1,'refund',$2,$3)",
          [job.mechanic_id, id, -charge.amount],
        );
      }
      await tx.query(
        'INSERT INTO wallet_audit(kind,source_id,actor_id,reason) VALUES($1,$2,$3,$4)',
        [action, id, actor, reason],
      );
      return { action };
    });
  }
  reconcile() {
    this.checkSandbox();
    return this.db
      .query(`SELECT w.mechanic_id,w.balance,w.reserved,e.total AS ledger_total,h.total AS hold_total
      FROM wallets w CROSS JOIN LATERAL (SELECT coalesce(sum(amount),0) AS total FROM wallet_entries WHERE mechanic_id=w.mechanic_id) e
      CROSS JOIN LATERAL (SELECT coalesce(sum(fee),0) AS total FROM commission_holds WHERE mechanic_id=w.mechanic_id) h
      WHERE w.balance<>e.total OR w.reserved<>h.total ORDER BY w.mechanic_id LIMIT 50`);
  }
}
