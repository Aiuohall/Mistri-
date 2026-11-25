import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedIdentity } from '../auth/authenticated-identity.interface';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserRole } from '../users/user-role.enum';
// Nest's validation pipe needs these classes at runtime for @Body metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PushTokenDto, ReviewDto, SendMessageDto } from './engagement.dto';
import { EngagementService } from './engagement.service';

@Controller()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.MECHANIC)
export class EngagementController {
  constructor(@Inject(EngagementService) private readonly engagement: EngagementService) {}

  @Get('service-requests/:id/messages')
  messages(
    @CurrentAuthUser() user: AuthenticatedIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('before') before?: string,
  ) {
    return this.engagement.messages(user.id, id, before);
  }

  @Post('service-requests/:id/messages')
  send(
    @CurrentAuthUser() user: AuthenticatedIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.engagement.send(user.id, id, dto);
  }

  @Post('service-requests/:id/review')
  @Roles(UserRole.CUSTOMER)
  review(
    @CurrentAuthUser() user: AuthenticatedIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDto,
  ) {
    return this.engagement.review(user.id, id, dto);
  }

  @Post('service-requests/:id/messages/:messageId/report')
  report(
    @CurrentAuthUser() user: AuthenticatedIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.engagement.report(user.id, id, messageId);
  }

  @Get('mechanics/:id/review-summary')
  summary(@Param('id', ParseUUIDPipe) id: string) {
    return this.engagement.reviewSummary(id);
  }

  @Put('push/installations')
  register(@CurrentAuthUser() user: AuthenticatedIdentity, @Body() dto: PushTokenDto) {
    return this.engagement.register(user.id, dto);
  }

  @Post('push/installations/revoke')
  revoke(@CurrentAuthUser() user: AuthenticatedIdentity, @Body() dto: PushTokenDto) {
    return this.engagement.revoke(user.id, dto);
  }
}
