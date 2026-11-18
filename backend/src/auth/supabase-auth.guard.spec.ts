import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import { SupabaseAuthGuard } from './supabase-auth.guard';
import type { SupabaseJwtVerifier } from './supabase-jwt-verifier.service';

describe('SupabaseAuthGuard', () => {
  const request = { headers: {} as Record<string, string | undefined> };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  it('rejects a request without a bearer token', async () => {
    const verifier = { verifyAccessToken: jest.fn() } as unknown as SupabaseJwtVerifier;
    const guard = new SupabaseAuthGuard(verifier);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifier.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('attaches the verified identity to the request', async () => {
    request.headers.authorization = 'Bearer signed-access-token';
    const verifier = {
      verifyAccessToken: jest.fn().mockResolvedValue({
        id: '5e50ac6e-0e81-4952-a6c4-c37fb936af5e',
        email: 'driver@example.com',
      }),
    } as unknown as SupabaseJwtVerifier;
    const guard = new SupabaseAuthGuard(verifier);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifier.verifyAccessToken).toHaveBeenCalledWith('signed-access-token');
    expect(request).toMatchObject({
      authUser: { id: '5e50ac6e-0e81-4952-a6c4-c37fb936af5e', email: 'driver@example.com' },
    });
  });
});
