import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';

import type { AuthenticatedRequest } from './authenticated-request.interface';
import { SupabaseJwtVerifier } from './supabase-jwt-verifier.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(@Inject(SupabaseJwtVerifier) private readonly jwtVerifier: SupabaseJwtVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.getBearerToken(request.headers.authorization);

    request.authUser = await this.jwtVerifier.verifyAccessToken(token);
    return true;
  }

  private getBearerToken(authorization: string | undefined): string {
    const match = /^Bearer\s+(.+)$/i.exec(authorization ?? '');
    if (!match?.[1]) {
      throw new UnauthorizedException('A Supabase access token is required.');
    }

    return match[1];
  }
}
