import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';
import { UserRole } from '../users/user-role.enum';
import type { UsersService } from '../users/users.service';

describe('RolesGuard', () => {
  const request = { authUser: { id: '5e50ac6e-0e81-4952-a6c4-c37fb936af5e' } };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  it('allows a role found in the server-side user record', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    } as unknown as Reflector;
    const usersService = {
      findById: jest.fn().mockResolvedValue({ role: UserRole.ADMIN }),
    } as unknown as UsersService;
    const guard = new RolesGuard(reflector, usersService);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a signed-in customer from an admin-only route', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    } as unknown as Reflector;
    const usersService = {
      findById: jest.fn().mockResolvedValue({ role: UserRole.CUSTOMER }),
    } as unknown as UsersService;
    const guard = new RolesGuard(reflector, usersService);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
