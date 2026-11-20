import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ServiceRequestStatus } from '../service-request-status.enum';
import { VehicleType } from '../../vehicles/vehicle-type.enum';

export class RequestVehicleResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Family car' })
  label!: string;

  @ApiProperty({ enum: VehicleType })
  type!: VehicleType;

  @ApiPropertyOptional({ example: 'Toyota', nullable: true })
  make!: string | null;

  @ApiPropertyOptional({ example: 'Corolla', nullable: true })
  model!: string | null;

  @ApiPropertyOptional({ example: 2019, nullable: true })
  productionYear!: number | null;

  @ApiPropertyOptional({ example: 'DHAKA METRO GA 12-3456', nullable: true })
  registrationNumber!: string | null;
}

export class AssignedMechanicResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Rahim Auto Care' })
  displayName!: string;
}

export class AvailableRequestVehicleResponse {
  @ApiProperty({ example: 'Family car' })
  label!: string;

  @ApiProperty({ enum: VehicleType })
  type!: VehicleType;

  @ApiPropertyOptional({ example: 'Toyota', nullable: true })
  make!: string | null;

  @ApiPropertyOptional({ example: 'Corolla', nullable: true })
  model!: string | null;

  @ApiPropertyOptional({ example: 2019, nullable: true })
  productionYear!: number | null;
}

export class AvailableServiceRequestResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ServiceRequestStatus, example: ServiceRequestStatus.OPEN })
  status!: ServiceRequestStatus.OPEN;

  @ApiProperty({ example: 'flat_tire' })
  serviceType!: string;

  @ApiProperty({ example: 'Rear-left tire is flat.' })
  description!: string;

  @ApiProperty({ type: AvailableRequestVehicleResponse })
  vehicle!: AvailableRequestVehicleResponse;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class ServiceRequestResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ServiceRequestStatus })
  status!: ServiceRequestStatus;

  @ApiProperty({ example: 'flat_tire' })
  serviceType!: string;

  @ApiProperty({ example: 'Rear-left tire is flat; I am parked safely beside the road.' })
  description!: string;

  @ApiProperty({ example: 23.7525 })
  latitude!: number;

  @ApiProperty({ example: 90.3742 })
  longitude!: number;

  @ApiProperty({ type: RequestVehicleResponse })
  vehicle!: RequestVehicleResponse;

  @ApiPropertyOptional({ type: AssignedMechanicResponse, nullable: true })
  mechanic!: AssignedMechanicResponse | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  acceptedAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  completedAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  paidAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  cancelledAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
