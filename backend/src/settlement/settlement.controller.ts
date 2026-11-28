import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedIdentity } from '../auth/authenticated-identity.interface';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserRole } from '../users/user-role.enum';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QuoteDto, TopupDto, DecisionDto, CorrectionDto } from './settlement.dto';
import { SettlementService } from './settlement.service';

@Controller()
@ApiBearerAuth()
@ApiTags('settlement')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class SettlementController {
  constructor(@Inject(SettlementService) private readonly settlement: SettlementService) {}
  @Get('service-requests/:id/pricing')
  @Roles(UserRole.CUSTOMER, UserRole.MECHANIC)
  pricing(@CurrentAuthUser() user: AuthenticatedIdentity, @Param('id', ParseUUIDPipe) id: string) {
    return this.settlement.pricing(user.id, id);
  }

  @Post('service-requests/:id/quotes')
  @Roles(UserRole.MECHANIC)
  propose(
    @CurrentAuthUser() user: AuthenticatedIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QuoteDto,
  ) {
    return this.settlement.propose(user.id, id, dto.amount, dto.version);
  }

  @Post('service-requests/:id/quotes/:quoteId/accept')
  @Roles(UserRole.CUSTOMER)
  accept(
    @CurrentAuthUser() user: AuthenticatedIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    return this.settlement.accept(user.id, id, quoteId);
  }

  @Get('wallet/me')
  @Roles(UserRole.MECHANIC)
  wallet(@CurrentAuthUser() user: AuthenticatedIdentity) {
    return this.settlement.wallet(user.id);
  }

  @Post('wallet/me/topups')
  @Roles(UserRole.MECHANIC)
  submit(@CurrentAuthUser() user: AuthenticatedIdentity, @Body() dto: TopupDto) {
    return this.settlement.submit(user.id, dto.amount, dto.reference);
  }

  @Get('operations/topups')
  @Roles(UserRole.ADMIN)
  pending() {
    return this.settlement.pending();
  }

  @Post('operations/topups/:id/decision')
  @Roles(UserRole.ADMIN)
  decide(
    @CurrentAuthUser() user: AuthenticatedIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.settlement.decide(user.id, id, dto.status, dto.reason);
  }

  @Post('operations/jobs/:id/correction')
  @Roles(UserRole.ADMIN)
  correctJob(
    @CurrentAuthUser() user: AuthenticatedIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrectionDto,
  ) {
    return this.settlement.correctJob(user.id, id, dto.action, dto.reason);
  }

  @Get('operations/wallets/reconciliation')
  @Roles(UserRole.ADMIN)
  reconcile() {
    return this.settlement.reconcile();
  }
}
