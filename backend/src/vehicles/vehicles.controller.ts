import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
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
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleResponse } from './dto/vehicle.response';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@ApiBearerAuth()
@Controller('vehicles')
@Roles(UserRole.CUSTOMER)
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(@Inject(VehiclesService) private readonly vehiclesService: VehiclesService) {}

  @Post()
  @ApiOperation({ summary: 'Add a vehicle for the signed-in customer' })
  @ApiBody({ type: CreateVehicleDto })
  @ApiCreatedResponse({ type: VehicleResponse })
  create(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Body() dto: CreateVehicleDto,
  ): Promise<VehicleResponse> {
    return this.vehiclesService.create(identity.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the signed-in customer’s vehicles' })
  @ApiOkResponse({ type: VehicleResponse, isArray: true })
  list(@CurrentAuthUser() identity: AuthenticatedIdentity): Promise<VehicleResponse[]> {
    return this.vehiclesService.listForCustomer(identity.id);
  }

  @Get(':vehicleId')
  @ApiOperation({ summary: 'Get one of the signed-in customer’s vehicles' })
  @ApiOkResponse({ type: VehicleResponse })
  get(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Param('vehicleId') vehicleId: string,
  ): Promise<VehicleResponse> {
    return this.vehiclesService.getForCustomer(identity.id, vehicleId);
  }

  @Patch(':vehicleId')
  @ApiOperation({ summary: 'Update one of the signed-in customer’s vehicles' })
  @ApiBody({ type: UpdateVehicleDto })
  @ApiOkResponse({ type: VehicleResponse })
  update(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<VehicleResponse> {
    return this.vehiclesService.update(identity.id, vehicleId, dto);
  }
}
