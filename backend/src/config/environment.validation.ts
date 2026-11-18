import * as Joi from 'joi';

export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  CORS_ORIGINS: string;
  DATABASE_URL: string;
  DATABASE_SSL: boolean;
  SUPABASE_URL: string;
  SUPABASE_JWT_AUDIENCE: string;
}

const databaseUrlSchema = Joi.string().uri({ scheme: ['postgres', 'postgresql'] });
const supabaseUrlSchema = Joi.string().uri({ scheme: ['http', 'https'] });

const environmentSchema = Joi.object<EnvironmentVariables>({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  CORS_ORIGINS: Joi.string().default('http://localhost:8081,http://localhost:3001'),
  DATABASE_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: databaseUrlSchema.required(),
    otherwise: databaseUrlSchema.default(
      'postgresql://mistri:change-me-for-local-development@127.0.0.1:5433/mistri',
    ),
  }),
  DATABASE_SSL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().valid(true).required(),
    otherwise: Joi.boolean().default(false),
  }),
  SUPABASE_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .uri({ scheme: ['https'] })
      .required(),
    otherwise: supabaseUrlSchema.default('http://127.0.0.1:54321'),
  }),
  SUPABASE_JWT_AUDIENCE: Joi.string().default('authenticated'),
}).unknown(true);

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const { error, value } = environmentSchema.validate(config, {
    abortEarly: false,
    convert: true,
  });

  if (error) {
    throw new Error(`Invalid environment configuration: ${error.message}`);
  }

  return value;
}
