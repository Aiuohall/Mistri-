import { sign } from 'jsonwebtoken';
import type { Namespace, Socket } from 'socket.io';
import type { SupabaseJwtVerifier } from '../auth/supabase-jwt-verifier.service';
import { UserRole } from '../users/user-role.enum';
import type { UsersService } from '../users/users.service';
import { JobEventsGateway } from './job-events.gateway';

function setup(role: UserRole, verified = true) {
  const verifyAccessToken = jest.fn(async () => {
    if (!verified) throw new Error('Rejected token');
    return { id: 'verified-account' };
  });
  const findById = jest.fn(async () => ({ role }));
  const gateway = new JobEventsGateway(
    { verifyAccessToken } as unknown as SupabaseJwtVerifier,
    { findById } as unknown as UsersService,
  );
  let authorize: ((socket: Socket, next: (error?: Error) => void) => void) | undefined;
  gateway.afterInit({
    use: (fn: typeof authorize) => {
      authorize = fn;
    },
  } as unknown as Namespace);
  const close = jest.fn();
  const join = jest.fn();
  const socket = {
    handshake: {
      auth: {
        token: sign({ sub: 'claimed-id' }, 'local-fixture', { expiresIn: 1 }),
        room: 'other-account',
      },
    },
    join,
    once: jest.fn(),
    disconnect: close,
  };
  return {
    authenticate: () =>
      new Promise<Error | undefined>((resolve) =>
        authorize?.(socket as unknown as Socket, resolve),
      ),
    join,
    close,
  };
}

it('limits socket membership to the verified account and disconnects when its token expires', async () => {
  jest.useFakeTimers();
  try {
    const { authenticate, join, close } = setup(UserRole.CUSTOMER);
    await expect(authenticate()).resolves.toBeUndefined();
    expect(join).toHaveBeenCalledTimes(1);
    expect(join).toHaveBeenCalledWith('verified-account');
    await jest.advanceTimersByTimeAsync(1_000);
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

it.each([
  [UserRole.ADMIN, true],
  [UserRole.MECHANIC, false],
])('denies membership for role %s with verified=%s', async (role, verified) => {
  const { authenticate, join } = setup(role, verified);
  await expect(authenticate()).resolves.toEqual(new Error('Unauthorized'));
  expect(join).not.toHaveBeenCalled();
});
