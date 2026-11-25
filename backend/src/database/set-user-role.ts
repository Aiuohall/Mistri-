import { appDataSource } from './data-source';
import { UserRole } from '../users/user-role.enum';

const allowedRoles = new Set<string>(Object.values(UserRole));

async function setUserRole(): Promise<void> {
  const [rawEmail, rawRole] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  const role = rawRole?.trim().toLowerCase();

  if (!email || !role || !allowedRoles.has(role)) {
    throw new Error(
      `Usage: npm run db:set-role --workspace=backend -- <email> <${Object.values(UserRole).join('|')}>`,
    );
  }

  await appDataSource.initialize();

  try {
    const rows = (await appDataSource.query(
      `
        UPDATE "users"
        SET "role" = $1, "updated_at" = NOW()
        WHERE "id" = (SELECT "id" FROM "users" WHERE LOWER("email") = $2)
        RETURNING "id", "email", "role"
      `,
      [role, email],
    )) as Array<{ id: string; email: string; role: string }>;

    const updated = rows[0];
    if (!updated) {
      throw new Error(
        `No user found with email "${email}". Sign in once via /auth/me before changing roles.`,
      );
    }

    console.log(`Updated user ${updated.email} (${updated.id}) to role "${updated.role}".`);
  } finally {
    await appDataSource.destroy();
  }
}

void setUserRole().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown database error';
  console.error(`Role update failed: ${message}`);
  process.exitCode = 1;
});
