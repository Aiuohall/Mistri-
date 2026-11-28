import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSettlement1763650000000 implements MigrationInterface {
  async up(db: QueryRunner): Promise<void> {
    await db.query(`
      ALTER TABLE service_requests ADD COLUMN commission_bps smallint CHECK (commission_bps BETWEEN 1000 AND 1500);
      CREATE TABLE wallets (
        mechanic_id uuid PRIMARY KEY REFERENCES users(id),
        balance bigint NOT NULL DEFAULT 0,
        reserved bigint NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= balance)
      );
      CREATE TABLE job_quotes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id uuid NOT NULL REFERENCES service_requests(id),
        version int NOT NULL CHECK (version > 0),
        amount int NOT NULL CHECK (amount BETWEEN 1 AND 100000000),
        rate smallint NOT NULL CHECK (rate BETWEEN 1000 AND 1500),
        fee int GENERATED ALWAYS AS (((amount::bigint * rate + 5000) / 10000)::int) STORED,
        accepted_at timestamptz,
        UNIQUE(request_id,version)
      );
      CREATE TABLE commission_holds (
        request_id uuid PRIMARY KEY REFERENCES service_requests(id),
        mechanic_id uuid NOT NULL REFERENCES wallets(mechanic_id),
        fee int NOT NULL CHECK (fee >= 0)
      );
      CREATE TABLE wallet_topups (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        mechanic_id uuid NOT NULL REFERENCES users(id),
        amount int NOT NULL CHECK (amount BETWEEN 1 AND 100000000),
        reference text NOT NULL UNIQUE,
        status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX wallet_topups_owner ON wallet_topups(mechanic_id,created_at DESC);
      CREATE TABLE wallet_audit (
        kind text NOT NULL, source_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES users(id),
        reason text NOT NULL CHECK (length(trim(reason)) > 0), created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(kind,source_id)
      );
      CREATE TABLE wallet_entries (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, mechanic_id uuid NOT NULL REFERENCES wallets(mechanic_id),
        kind text NOT NULL CHECK(kind IN ('topup','commission','refund')), source_id uuid NOT NULL,
        amount int NOT NULL CHECK (CASE WHEN kind='commission' THEN amount<=0 ELSE amount>=0 END),
        currency text NOT NULL DEFAULT 'BDT' CHECK(currency='BDT'),
        created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(kind,source_id)
      );
      CREATE INDEX wallet_entries_owner ON wallet_entries(mechanic_id,id DESC);
      ALTER TABLE job_outbox DROP CONSTRAINT job_outbox_kind_check;
      ALTER TABLE job_outbox ADD CONSTRAINT job_outbox_kind_check CHECK(kind IN ('status','message','pricing'));
      CREATE FUNCTION queue_quote_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO job_outbox(request_id,recipient_id,kind,notify)
          SELECT id,CASE WHEN TG_OP='INSERT' THEN customer_id ELSE mechanic_id END,'pricing',false
          FROM service_requests WHERE id=NEW.request_id;
        RETURN NEW;
      END; $$;
      CREATE TRIGGER quote_outbox AFTER INSERT OR UPDATE ON job_quotes FOR EACH ROW EXECUTE FUNCTION queue_quote_update();
      CREATE FUNCTION immutable_finance_record() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Financial history is immutable'; END; $$;
      CREATE TRIGGER ledger_immutable BEFORE UPDATE OR DELETE ON wallet_entries FOR EACH ROW EXECUTE FUNCTION immutable_finance_record();
      CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON wallet_audit FOR EACH ROW EXECUTE FUNCTION immutable_finance_record();
      CREATE FUNCTION preserve_quote() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP='DELETE' OR OLD.accepted_at IS NOT NULL OR NEW.accepted_at IS NULL
          OR (NEW.id,NEW.request_id,NEW.version,NEW.amount,NEW.rate) IS DISTINCT FROM
             (OLD.id,OLD.request_id,OLD.version,OLD.amount,OLD.rate) THEN
          RAISE EXCEPTION 'Create a replacement quote';
        END IF;
        RETURN NEW;
      END; $$;
      CREATE TRIGGER quote_immutable BEFORE UPDATE OR DELETE ON job_quotes FOR EACH ROW EXECUTE FUNCTION preserve_quote();
      CREATE FUNCTION post_wallet_entry() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE wallets SET balance=balance+NEW.amount WHERE mechanic_id=NEW.mechanic_id;
        RETURN NEW;
      END; $$;
      CREATE TRIGGER post_entry AFTER INSERT ON wallet_entries FOR EACH ROW EXECUTE FUNCTION post_wallet_entry();

      CREATE FUNCTION settle_job_transition() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE quote job_quotes%ROWTYPE; held int;
      BEGIN
        IF NEW.commission_bps IS NULL OR OLD.status=NEW.status THEN RETURN NEW; END IF;
        IF NEW.status='in_progress' THEN
          SELECT * INTO quote FROM job_quotes WHERE request_id=NEW.id ORDER BY version DESC LIMIT 1;
          IF quote.accepted_at IS NULL THEN RAISE EXCEPTION USING ERRCODE='P8001', MESSAGE='Accept the current quote before starting work.'; END IF;
          INSERT INTO wallets(mechanic_id) VALUES (NEW.mechanic_id) ON CONFLICT DO NOTHING;
          UPDATE wallets SET reserved=reserved+quote.fee WHERE mechanic_id=NEW.mechanic_id AND balance-reserved>=quote.fee;
          IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P8001', MESSAGE='Mechanic wallet needs a top-up before work starts.'; END IF;
          INSERT INTO commission_holds VALUES (NEW.id,NEW.mechanic_id,quote.fee);
        ELSIF OLD.status='in_progress' AND NEW.status IN ('completed','cancelled') THEN
          DELETE FROM commission_holds WHERE request_id=NEW.id RETURNING fee INTO STRICT held;
          UPDATE wallets SET reserved=reserved-held WHERE mechanic_id=NEW.mechanic_id;
          IF NEW.status='completed' THEN
            INSERT INTO wallet_entries(mechanic_id,kind,source_id,amount) VALUES(NEW.mechanic_id,'commission',NEW.id,-held);
          END IF;
        END IF;
        RETURN NEW;
      END; $$;
      CREATE TRIGGER settle_job BEFORE UPDATE OF status ON service_requests FOR EACH ROW EXECUTE FUNCTION settle_job_transition();
      ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
      ALTER TABLE job_quotes ENABLE ROW LEVEL SECURITY;
      ALTER TABLE commission_holds ENABLE ROW LEVEL SECURITY;
      ALTER TABLE wallet_entries ENABLE ROW LEVEL SECURITY;
      ALTER TABLE wallet_audit ENABLE ROW LEVEL SECURITY;
      ALTER TABLE wallet_topups ENABLE ROW LEVEL SECURITY;
    `);
  }
  async down(db: QueryRunner): Promise<void> {
    await db.query(`
      DO $$ BEGIN IF EXISTS(SELECT FROM wallet_entries) OR EXISTS(SELECT FROM job_quotes) OR EXISTS(SELECT FROM wallet_topups)
      OR EXISTS(SELECT FROM service_requests WHERE commission_bps IS NOT NULL) THEN RAISE EXCEPTION 'Restore a verified backup to roll back populated settlement data'; END IF; END $$;
      DROP TRIGGER settle_job ON service_requests;
      DROP FUNCTION settle_job_transition();
      ALTER TABLE job_outbox DROP CONSTRAINT job_outbox_kind_check;
      ALTER TABLE job_outbox ADD CONSTRAINT job_outbox_kind_check CHECK(kind IN ('status','message'));
      DROP TABLE wallet_entries,wallet_audit,wallet_topups,commission_holds,job_quotes,wallets;
      DROP FUNCTION immutable_finance_record(),post_wallet_entry(),preserve_quote(),queue_quote_update();
      ALTER TABLE service_requests DROP COLUMN commission_bps;
    `);
  }
}
