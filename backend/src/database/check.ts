import { appDataSource } from './data-source';

interface PostgisVersionRow {
  version: string;
}

async function checkDatabase(): Promise<void> {
  await appDataSource.initialize();

  try {
    const rows = (await appDataSource.query(
      'SELECT PostGIS_Version() AS version',
    )) as PostgisVersionRow[];
    const postgisVersion = rows[0]?.version;

    if (!postgisVersion) {
      throw new Error('PostGIS did not return a version.');
    }

    console.log(`Database connection verified. PostGIS ${postgisVersion} is available.`);
  } finally {
    await appDataSource.destroy();
  }
}

void checkDatabase().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown database error';
  console.error(`Database check failed: ${message}`);
  process.exitCode = 1;
});
