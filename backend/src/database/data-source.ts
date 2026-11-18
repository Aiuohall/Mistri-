import 'reflect-metadata';

import { config as loadEnvironment } from 'dotenv';
import { DataSource } from 'typeorm';

loadEnvironment();

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://mistri:change-me-for-local-development@127.0.0.1:5433/mistri';

export const appDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [],
  migrations: [],
  synchronize: false,
});
