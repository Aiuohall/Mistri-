import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'crypto';
import { sign } from 'jsonwebtoken';

import type { EnvironmentVariables } from '../config/environment.validation';
import { SupabaseJwtVerifier } from './supabase-jwt-verifier.service';

const userId = '5e50ac6e-0e81-4952-a6c4-c37fb936af5e';
const issuer = 'https://example.supabase.co/auth/v1';

interface MockedJwksClient {
  getSigningKey: jest.Mock<Promise<{ getPublicKey: () => string }>, [string]>;
}

function createVerifier(): {
  verifier: SupabaseJwtVerifier;
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];
} {
  const config = {
    getOrThrow: jest.fn((key: keyof EnvironmentVariables) => {
      const values: Pick<EnvironmentVariables, 'SUPABASE_URL' | 'SUPABASE_JWT_AUDIENCE'> = {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_JWT_AUDIENCE: 'authenticated',
      };

      return values[key as keyof typeof values];
    }),
  } as unknown as ConfigService<EnvironmentVariables, true>;
  const verifier = new SupabaseJwtVerifier(config);
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const mockedVerifier = verifier as unknown as { jwksClient: MockedJwksClient };

  mockedVerifier.jwksClient = {
    getSigningKey: jest.fn().mockResolvedValue({
      getPublicKey: () => publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    }),
  };

  return { verifier, privateKey };
}

describe('SupabaseJwtVerifier', () => {
  it('accepts a correctly signed Supabase access token', async () => {
    const { verifier, privateKey } = createVerifier();
    const token = sign({ email: 'driver@example.com' }, privateKey, {
      algorithm: 'RS256',
      audience: 'authenticated',
      issuer,
      keyid: 'test-key',
      subject: userId,
    });

    await expect(verifier.verifyAccessToken(token)).resolves.toEqual({
      id: userId,
      email: 'driver@example.com',
    });
  });

  it('rejects a token with the wrong audience', async () => {
    const { verifier, privateKey } = createVerifier();
    const token = sign({}, privateKey, {
      algorithm: 'RS256',
      audience: 'another-app',
      issuer,
      keyid: 'test-key',
      subject: userId,
    });

    await expect(verifier.verifyAccessToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
