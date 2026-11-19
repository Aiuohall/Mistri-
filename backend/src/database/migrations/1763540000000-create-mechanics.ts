import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMechanics1763540000000 implements MigrationInterface {
  name = 'CreateMechanics1763540000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "mechanics" (
        "user_id" uuid NOT NULL,
        "display_name" character varying(100) NOT NULL,
        "bio" character varying(500),
        "service_types" text[] NOT NULL DEFAULT '{}',
        "is_online" boolean NOT NULL DEFAULT false,
        "current_location" geography(Point, 4326),
        "location_updated_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mechanics_user_id" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_mechanics_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_mechanics_location_when_online" CHECK (
          "is_online" OR ("current_location" IS NULL AND "location_updated_at" IS NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_mechanics_online" ON "mechanics" ("is_online")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_mechanics_online_location" ON "mechanics"
      USING GIST ("current_location")
      WHERE "is_online" = true AND "current_location" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_mechanics_online_location"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mechanics_online"`);
    await queryRunner.query(`DROP TABLE "mechanics"`);
  }
}
