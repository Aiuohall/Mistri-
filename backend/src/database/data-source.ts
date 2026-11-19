import 'reflect-metadata';

import { config as loadEnvironment } from 'dotenv';
import { DataSource } from 'typeorm';

import { User } from '../users/user.entity';
import { MechanicProfile } from '../mechanics/mechanic-profile.entity';
import { CreateUsers1763530000000 } from './migrations/1763530000000-create-users';
import { CreateMechanics1763540000000 } from './migrations/1763540000000-create-mechanics';

loadEnvironment();

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://mistri:change-me-for-local-development@127.0.0.1:5433/mistri';
const databaseSsl = process.env.DATABASE_SSL === 'true';

export const appDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  ssl: databaseSsl ? { rejectUnauthorized: false } : false,
  entities: [User, MechanicProfile],
  migrations: [CreateUsers1763530000000, CreateMechanics1763540000000],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
});
