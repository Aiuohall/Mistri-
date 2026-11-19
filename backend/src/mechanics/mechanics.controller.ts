import { Body, Controller, Get, Inject, Patch, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { AuthenticatedIdentity } from '../auth/authenticated-identity.interface';
import { UserRole } from '../users/user-role.enum';
import { NearbyMechanicsQueryDto } from './dto/nearby-mechanics-query.dto';
import { NearbyMechanicResponse } from './dto/nearby-mechanic.response';
import { LocationUpdateResponse } from './dto/location-update.response';
import { MechanicProfileResponse } from './dto/mechanic-profile.response';
import { UpdateMechanicAvailabilityDto } from './dto/update-mechanic-availability.dto';
import { UpdateMechanicLocationDto } from './dto/update-mechanic-location.dto';
import { UpsertMechanicProfileDto } from './dto/upsert-mechanic-profile.dto';
import { MechanicsService } from './mechanics.service';

@ApiTags('mechanics')
@ApiBearerAuth()
@Controller('mechanics')
@UseGuards(SupabaseAuthGuard)
export class MechanicsController {
  constructor(@Inject(MechanicsService) private readonly mechanicsService: MechanicsService) {}

  @Get('nearby')
  @ApiOperation({ summary: 'Find online mechanics near a location' })
  @ApiQuery({ type: NearbyMechanicsQueryDto })
  @ApiOkResponse({ type: NearbyMechanicResponse, isArray: true })
  findNearby(@Query() query: NearbyMechanicsQueryDto): Promise<NearbyMechanicResponse[]> {
    return this.mechanicsService.findNearby(query);
  }

  @Get('me')
  @Roles(UserRole.MECHANIC)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get the signed-in mechanic profile' })
  @ApiOkResponse({ type: MechanicProfileResponse })
  getOwnProfile(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
  ): Promise<MechanicProfileResponse> {
    return this.mechanicsService.getOwnProfile(identity.id);
  }

  @Put('me/profile')
  @Roles(UserRole.MECHANIC)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create or replace the signed-in mechanic profile' })
  @ApiBody({ type: UpsertMechanicProfileDto })
  @ApiOkResponse({ type: MechanicProfileResponse })
  upsertProfile(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Body() dto: UpsertMechanicProfileDto,
  ): Promise<MechanicProfileResponse> {
    return this.mechanicsService.upsertProfile(identity.id, dto);
  }

  @Patch('me/availability')
  @Roles(UserRole.MECHANIC)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Switch the signed-in mechanic online or offline' })
  @ApiBody({ type: UpdateMechanicAvailabilityDto })
  @ApiOkResponse({ type: MechanicProfileResponse })
  updateAvailability(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Body() dto: UpdateMechanicAvailabilityDto,
  ): Promise<MechanicProfileResponse> {
    return this.mechanicsService.updateAvailability(identity.id, dto);
  }

  @Put('me/location')
  @Roles(UserRole.MECHANIC)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Update the signed-in mechanic location after moving at least 50 metres',
  })
  @ApiBody({ type: UpdateMechanicLocationDto })
  @ApiOkResponse({ type: LocationUpdateResponse })
  updateLocation(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Body() dto: UpdateMechanicLocationDto,
  ): Promise<LocationUpdateResponse> {
    return this.mechanicsService.updateLocation(identity.id, dto);
  }
}
