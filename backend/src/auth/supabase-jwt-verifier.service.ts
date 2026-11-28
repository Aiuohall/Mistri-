import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decode, verify, type Algorithm, type JwtPayload } from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';

import type { EnvironmentVariables } from '../config/environment.validation';
import type { AuthenticatedIdentity } from './authenticated-identity.interface';

const acceptedAlgorithms: Algorithm[] = ['RS256', 'ES256'];

@Injectable()
export class SupabaseJwtVerifier {
  private readonly supabaseUrl: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly publishableKey: string;
  private readonly jwksClient: ReturnType<typeof jwksClient>;

  constructor(@Inject(ConfigService) config: ConfigService<EnvironmentVariables, true>) {
    this.supabaseUrl = config.getOrThrow<string>('SUPABASE_URL').replace(/\/$/, '');
    this.issuer = `${this.supabaseUrl}/auth/v1`;
    this.audience = config.getOrThrow<string>('SUPABASE_JWT_AUDIENCE');
    this.publishableKey = config.get<string>('SUPABASE_PUBLISHABLE_KEY') ?? '';
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
    if (!decoded || typeof decoded === 'string') {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    if (decoded.header.alg === 'HS256') {
      const claims = decoded.payload;
      if (
        typeof claims === 'string' ||
        claims.iss !== this.issuer ||
        !(Array.isArray(claims.aud)
          ? claims.aud.includes(this.audience)
          : claims.aud === this.audience) ||
        typeof claims.exp !== 'number' ||
        claims.exp <= Date.now() / 1000 ||
        typeof claims.sub !== 'string'
      ) {
        throw new UnauthorizedException('Invalid or expired access token.');
      }
      return this.verifyWithAuthServer(token, claims.sub);
    }
    const keyId = decoded.header.kid;
    if (!keyId || !acceptedAlgorithms.includes(decoded.header.alg as Algorithm)) {
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

  private async verifyWithAuthServer(
    token: string,
    subject: string,
  ): Promise<AuthenticatedIdentity> {
    if (!this.publishableKey) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    try {
      const response = await fetch(`${this.supabaseUrl}/auth/v1/user`, {
        signal: AbortSignal.timeout(5000),
        headers: {
          apikey: this.publishableKey,
          authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new UnauthorizedException('Invalid or expired access token.');
      }

      const user = (await response.json()) as { id?: unknown; email?: unknown };
      if (user.id !== subject) {
        throw new UnauthorizedException('Invalid or expired access token.');
      }

      return {
        id: user.id,
        ...(typeof user.email === 'string' ? { email: user.email } : {}),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
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
