import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedIdentity } from './authenticated-identity.interface';
import { CurrentAuthUser } from './current-auth-user.decorator';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { AuthUserResponse } from './dto/auth-user.response';
import { UserRole } from '../users/user-role.enum';
import { UsersService } from '../users/users.service';
import { sandboxRate } from '../settlement/sandbox';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
@UseGuards(SupabaseAuthGuard)
export class AuthController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Verify a Supabase access token and return the local user profile' })
  @ApiOkResponse({ type: AuthUserResponse })
  async getMe(@CurrentAuthUser() identity: AuthenticatedIdentity): Promise<AuthUserResponse> {
    const user = await this.usersService.getOrCreateFromIdentity(identity);
    return { ...user, walletSandbox: user.role === UserRole.MECHANIC && sandboxRate() !== null };
  }

  @Get('admin/check')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Confirm that the verified user has the admin role' })
  @ApiOkResponse({ schema: { example: { authorized: true } } })
  getAdminCheck(): { authorized: true } {
    return { authorized: true };
  }
}
