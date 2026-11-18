import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decode, verify, type Algorithm, type JwtPayload } from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';

import type { EnvironmentVariables } from '../config/environment.validation';
import type { AuthenticatedIdentity } from './authenticated-identity.interface';

const acceptedAlgorithms: Algorithm[] = ['RS256', 'ES256'];

@Injectable()
export class SupabaseJwtVerifier {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwksClient: ReturnType<typeof jwksClient>;

  constructor(@Inject(ConfigService) config: ConfigService<EnvironmentVariables, true>) {
    const supabaseUrl = config.getOrThrow<string>('SUPABASE_URL').replace(/\/$/, '');
    this.issuer = `${supabaseUrl}/auth/v1`;
    this.audience = config.getOrThrow<string>('SUPABASE_JWT_AUDIENCE');
    this.jwksClient = jwksClient({
      cache: true,
      cacheMaxAge: 600_000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      jwksUri: `${this.issuer}/.well-known/jwks.json`,
    });
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedIdentity> {
    const decoded = decode(token, { complete: true });
    const keyId = decoded?.header.kid;

    if (!keyId) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    try {
      const signingKey = await this.jwksClient.getSigningKey(keyId);
      const payload = verify(token, signingKey.getPublicKey(), {
        algorithms: acceptedAlgorithms,
        audience: this.audience,
        issuer: this.issuer,
      });

      return this.toIdentity(payload);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }

  private toIdentity(payload: string | JwtPayload): AuthenticatedIdentity {
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    return {
      id: payload.sub,
      ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
    };
  }
}
