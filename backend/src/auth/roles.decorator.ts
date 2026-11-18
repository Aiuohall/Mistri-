import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '../users/user-role.enum';

export const ROLES_KEY = 'mistri:roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
