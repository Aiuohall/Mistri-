import type { Request } from 'express';

import type { AuthenticatedIdentity } from './authenticated-identity.interface';

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedIdentity;
}
