import * as Joi from 'joi';

export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  CORS_ORIGINS: string;
  ENABLE_SWAGGER: boolean;
  MISTRI_WALLET_SANDBOX: boolean;
  MISTRI_TEST_COMMISSION_BPS: number;
  DATABASE_URL: string;
  DATABASE_SSL: boolean;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_JWT_AUDIENCE: string;
}

const databaseUrlSchema = Joi.string().uri({ scheme: ['postgres', 'postgresql'] });
const supabaseUrlSchema = Joi.string().uri({ scheme: ['http', 'https'] });
const corsOriginsSchema = Joi.string().custom((value: string, helpers) => {
  const origins = value.split(',').map((origin) => origin.trim());

  if (!origins.length || origins.some((origin) => !origin || origin === '*')) {
    return helpers.error('any.invalid');
  }

  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return helpers.error('any.invalid');
      }
    } catch {
      return helpers.error('any.invalid');
    }
  }

  return origins.join(',');
}, 'CORS origins validation');

const environmentSchema = Joi.object<EnvironmentVariables>({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  MISTRI_WALLET_SANDBOX: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().valid(false).default(false),
    otherwise: Joi.boolean().default(false),
  }),
  MISTRI_TEST_COMMISSION_BPS: Joi.number().integer().min(1000).max(1500).default(1000),
  CORS_ORIGINS: Joi.when('NODE_ENV', {
    is: 'production',
    then: corsOriginsSchema.required(),
    otherwise: corsOriginsSchema.default('http://localhost:8081,http://localhost:3001'),
  }),
  ENABLE_SWAGGER: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().default(false),
    otherwise: Joi.boolean().default(true),
  }),
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
  SUPABASE_PUBLISHABLE_KEY: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
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
