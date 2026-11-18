import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedIdentity } from './authenticated-identity.interface';
import type { AuthenticatedRequest } from './authenticated-request.interface';

export const CurrentAuthUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedIdentity => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.authUser) {
      throw new Error('Authenticated user is missing from the request.');
    }

    return request.authUser;
  },
);
