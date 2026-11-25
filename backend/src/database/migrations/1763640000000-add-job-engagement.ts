import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobEngagement1763640000000 implements MigrationInterface {
  async up(db: QueryRunner): Promise<void> {
    await db.query(`
      CREATE TABLE job_messages (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
        sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id uuid NOT NULL,
        body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (request_id, sender_id, client_id)
      );
      CREATE INDEX job_messages_request_idx ON job_messages(request_id, id DESC);
      CREATE INDEX job_messages_sender_idx ON job_messages(sender_id, created_at DESC);
      CREATE TABLE job_reviews (
        request_id uuid PRIMARY KEY REFERENCES service_requests(id) ON DELETE CASCADE,
        mechanic_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment text NOT NULL CHECK (char_length(comment) <= 500),
        published boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX job_reviews_mechanic_idx ON job_reviews(mechanic_id) WHERE published;
      CREATE TABLE job_message_reports (
        message_id bigint NOT NULL REFERENCES job_messages(id) ON DELETE CASCADE,
        reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(message_id, reporter_id)
      );
      CREATE TABLE push_installations (
        token text PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        updated_at timestamptz(3) NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX push_installations_user_idx ON push_installations(user_id);
      CREATE TABLE job_outbox (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
        recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('status','message')),
        notify boolean NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE job_push_deliveries (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        event_id bigint NOT NULL,
        request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
        recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token text NOT NULL REFERENCES push_installations(token) ON DELETE CASCADE,
        generation timestamptz(3) NOT NULL,
        receipt_id text,
        attempts int NOT NULL DEFAULT 0,
        due_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(event_id, token)
      );
      CREATE INDEX job_push_due_idx ON job_push_deliveries(due_at, id);
      ALTER TABLE job_messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE job_reviews ENABLE ROW LEVEL SECURITY;
      ALTER TABLE job_message_reports ENABLE ROW LEVEL SECURITY;
      ALTER TABLE push_installations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE job_outbox ENABLE ROW LEVEL SECURITY;
      ALTER TABLE job_push_deliveries ENABLE ROW LEVEL SECURITY;
      CREATE FUNCTION queue_job_status() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
          INSERT INTO job_outbox(request_id, recipient_id, kind, notify)
          VALUES (NEW.id, NEW.customer_id, 'status', NEW.status NOT IN ('paid','cancelled'));
          IF NEW.mechanic_id IS NOT NULL THEN
            INSERT INTO job_outbox(request_id, recipient_id, kind, notify)
            VALUES (NEW.id, NEW.mechanic_id, 'status', NEW.status = 'paid');
          END IF;
        END IF;
        RETURN NEW;
      END; $$;
      CREATE TRIGGER service_request_status_outbox AFTER UPDATE OF status ON service_requests
        FOR EACH ROW EXECUTE FUNCTION queue_job_status();
    `);
  }

  async down(db: QueryRunner): Promise<void> {
    await db.query(`
      DROP TRIGGER service_request_status_outbox ON service_requests;
      DROP FUNCTION queue_job_status();
      DROP TABLE job_push_deliveries, job_outbox, push_installations, job_reviews, job_message_reports, job_messages;
    `);
  }
}
