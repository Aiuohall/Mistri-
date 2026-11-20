import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { VehicleType } from '../vehicle-type.enum';

export class VehicleResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Family car' })
  label!: string;

  @ApiProperty({ enum: VehicleType, example: VehicleType.CAR })
  type!: VehicleType;

  @ApiPropertyOptional({ example: 'Toyota', nullable: true })
  make!: string | null;

  @ApiPropertyOptional({ example: 'Corolla', nullable: true })
  model!: string | null;

  @ApiPropertyOptional({ example: 2019, nullable: true })
  productionYear!: number | null;

  @ApiPropertyOptional({ example: 'DHAKA METRO GA 12-3456', nullable: true })
  registrationNumber!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
