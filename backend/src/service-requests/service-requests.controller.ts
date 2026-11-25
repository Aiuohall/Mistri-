import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthenticatedIdentity } from '../auth/authenticated-identity.interface';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserRole } from '../users/user-role.enum';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import {
  AvailableServiceRequestResponse,
  ServiceRequestResponse,
} from './dto/service-request.response';
import { TransitionServiceRequestDto } from './dto/transition-service-request.dto';
import { ServiceRequestsService } from './service-requests.service';

@ApiTags('service requests')
@ApiBearerAuth()
@Controller('service-requests')
@UseGuards(SupabaseAuthGuard)
export class ServiceRequestsController {
  constructor(
    @Inject(ServiceRequestsService)
    private readonly serviceRequestsService: ServiceRequestsService,
  ) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create a service request for one of the customer’s vehicles' })
  @ApiBody({ type: CreateServiceRequestDto })
  @ApiCreatedResponse({ type: ServiceRequestResponse })
  create(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Body() dto: CreateServiceRequestDto,
  ): Promise<ServiceRequestResponse> {
    return this.serviceRequestsService.create(identity.id, dto);
  }

  @Get('mine')
  @Roles(UserRole.CUSTOMER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'List the signed-in customer’s service requests' })
  @ApiOkResponse({ type: ServiceRequestResponse, isArray: true })
  listMine(@CurrentAuthUser() identity: AuthenticatedIdentity): Promise<ServiceRequestResponse[]> {
    return this.serviceRequestsService.listForCustomer(identity.id);
  }

  @Get('available')
  @Roles(UserRole.MECHANIC)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'List unassigned requests without their exact pickup coordinates' })
  @ApiOkResponse({ type: AvailableServiceRequestResponse, isArray: true })
  listAvailable(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
  ): Promise<AvailableServiceRequestResponse[]> {
    return this.serviceRequestsService.listAvailableForMechanic(identity.id);
  }

  @Get('assigned/me')
  @Roles(UserRole.MECHANIC)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'List service requests assigned to the signed-in mechanic' })
  @ApiOkResponse({ type: ServiceRequestResponse, isArray: true })
  listAssigned(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
  ): Promise<ServiceRequestResponse[]> {
    return this.serviceRequestsService.listAssignedToMechanic(identity.id);
  }

  @Post(':requestId/accept')
  @Roles(UserRole.MECHANIC)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Atomically accept an available service request' })
  @ApiConflictResponse({ description: 'The request has already been accepted or closed.' })
  @ApiOkResponse({ type: ServiceRequestResponse })
  accept(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Param('requestId') requestId: string,
  ): Promise<ServiceRequestResponse> {
    return this.serviceRequestsService.accept(identity.id, requestId);
  }

  @Post(':requestId/transitions')
  @Roles(UserRole.MECHANIC)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Advance an assigned request with a permitted mechanic action' })
  @ApiBody({ type: TransitionServiceRequestDto })
  @ApiConflictResponse({ description: 'The action is not valid for the current request state.' })
  @ApiOkResponse({ type: ServiceRequestResponse })
  transition(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Param('requestId') requestId: string,
    @Body() dto: TransitionServiceRequestDto,
  ): Promise<ServiceRequestResponse> {
    return this.serviceRequestsService.transitionAsMechanic(identity.id, requestId, dto);
  }

  @Post(':requestId/cancel')
  @Roles(UserRole.CUSTOMER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Cancel an open service request' })
  @ApiConflictResponse({ description: 'The request can no longer be cancelled.' })
  @ApiOkResponse({ type: ServiceRequestResponse })
  cancel(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Param('requestId') requestId: string,
  ): Promise<ServiceRequestResponse> {
    return this.serviceRequestsService.cancel(identity.id, requestId);
  }

  @Post(':requestId/confirm-cash-payment')
  @Roles(UserRole.CUSTOMER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Confirm cash payment after the mechanic completes the request' })
  @ApiConflictResponse({ description: 'The request has not reached completed status.' })
  @ApiOkResponse({ type: ServiceRequestResponse })
  confirmCashPayment(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Param('requestId') requestId: string,
  ): Promise<ServiceRequestResponse> {
    return this.serviceRequestsService.confirmCashPayment(identity.id, requestId);
  }

  @Get(':requestId')
  @ApiOperation({ summary: 'Get a request when signed in as its customer or assigned mechanic' })
  @ApiOkResponse({ type: ServiceRequestResponse })
  get(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Param('requestId') requestId: string,
  ): Promise<ServiceRequestResponse> {
    return this.serviceRequestsService.getForParticipant(identity.id, requestId);
  }
}
