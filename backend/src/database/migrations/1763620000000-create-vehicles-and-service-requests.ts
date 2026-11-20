import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVehiclesAndServiceRequests1763620000000 implements MigrationInterface {
  name = 'CreateVehiclesAndServiceRequests1763620000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(
      `CREATE TYPE "vehicle_type_enum" AS ENUM ('car', 'motorcycle', 'cng', 'truck', 'other')`,
    );
    await queryRunner.query(`
      CREATE TABLE "vehicles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "customer_id" uuid NOT NULL,
        "label" character varying(100) NOT NULL,
        "vehicle_type" "vehicle_type_enum" NOT NULL,
        "make" character varying(100),
        "model" character varying(100),
        "production_year" smallint,
        "registration_number" character varying(32),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vehicles_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vehicles_customer_id" FOREIGN KEY ("customer_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_vehicles_production_year" CHECK (
          "production_year" IS NULL OR "production_year" BETWEEN 1886 AND 2100
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_vehicles_customer_created_at"
      ON "vehicles" ("customer_id", "created_at" DESC)
    `);

    await queryRunner.query(
      `CREATE TYPE "service_request_status_enum" AS ENUM (
        'open', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled'
      )`,
    );
    await queryRunner.query(`
      CREATE TABLE "service_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "customer_id" uuid NOT NULL,
        "vehicle_id" uuid NOT NULL,
        "mechanic_id" uuid,
        "service_type" character varying(50) NOT NULL,
        "description" character varying(1000) NOT NULL,
        "location" geography(Point, 4326) NOT NULL,
        "status" "service_request_status_enum" NOT NULL DEFAULT 'open',
        "accepted_at" TIMESTAMP WITH TIME ZONE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_service_requests_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_service_requests_customer_id" FOREIGN KEY ("customer_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_service_requests_vehicle_id" FOREIGN KEY ("vehicle_id")
          REFERENCES "vehicles"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_service_requests_mechanic_id" FOREIGN KEY ("mechanic_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_service_requests_assignment" CHECK (
          ("status" = 'open' AND "mechanic_id" IS NULL)
          OR ("status" <> 'open' AND ("status" = 'cancelled' OR "mechanic_id" IS NOT NULL))
        ),
        CONSTRAINT "CHK_service_requests_accepted_at" CHECK (
          ("mechanic_id" IS NULL AND "accepted_at" IS NULL)
          OR ("mechanic_id" IS NOT NULL AND "accepted_at" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_service_requests_customer_created_at"
      ON "service_requests" ("customer_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_service_requests_mechanic_status_created_at"
      ON "service_requests" ("mechanic_id", "status", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_service_requests_open_location"
      ON "service_requests" USING GIST ("location")
      WHERE "status" = 'open'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_service_requests_open_location"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_service_requests_mechanic_status_created_at"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_service_requests_customer_created_at"`);
    await queryRunner.query(`DROP TABLE "service_requests"`);
    await queryRunner.query(`DROP TYPE "service_request_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_vehicles_customer_created_at"`);
    await queryRunner.query(`DROP TABLE "vehicles"`);
    await queryRunner.query(`DROP TYPE "vehicle_type_enum"`);
  }
}
