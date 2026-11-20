import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaidServiceRequestStatus1763630000000 implements MigrationInterface {
  name = 'AddPaidServiceRequestStatus1763630000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "service_request_status_enum" ADD VALUE IF NOT EXISTS 'paid'`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_requests" ADD COLUMN "paid_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "service_requests" DROP COLUMN "paid_at"`);
    await queryRunner.query(`ALTER TABLE "service_requests" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TYPE "service_request_status_enum" RENAME TO "service_request_status_enum_old"`,
    );
    await queryRunner.query(`
      CREATE TYPE "service_request_status_enum" AS ENUM (
        'open', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "service_requests"
      ALTER COLUMN "status" TYPE "service_request_status_enum"
      USING "status"::text::"service_request_status_enum"
    `);
    await queryRunner.query(
      `ALTER TABLE "service_requests" ALTER COLUMN "status" SET DEFAULT 'open'`,
    );
    await queryRunner.query(`DROP TYPE "service_request_status_enum_old"`);
  }
}
