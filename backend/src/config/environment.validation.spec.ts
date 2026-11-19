import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  it('enables Swagger and uses local CORS defaults outside production', () => {
    expect(validateEnvironment({})).toMatchObject({
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://localhost:8081,http://localhost:3001',
      ENABLE_SWAGGER: true,
    });
  });

  it('requires explicit, non-wildcard CORS origins in production', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      'Invalid environment configuration',
    );
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        CORS_ORIGINS: '*',
        DATABASE_URL: 'postgresql://mistri:password@db.example.com/mistri',
        DATABASE_SSL: true,
        SUPABASE_URL: 'https://mistri.supabase.co',
      }),
    ).toThrow('Invalid environment configuration');
  });

  it('disables Swagger by default in production with an explicit CORS allowlist', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://mistri.aiuohall.dev, https://admin.mistri.aiuohall.dev',
        DATABASE_URL: 'postgresql://mistri:password@db.example.com/mistri',
        DATABASE_SSL: true,
        SUPABASE_URL: 'https://mistri.supabase.co',
      }),
    ).toMatchObject({
      ENABLE_SWAGGER: false,
      CORS_ORIGINS: 'https://mistri.aiuohall.dev,https://admin.mistri.aiuohall.dev',
    });
  });
});
