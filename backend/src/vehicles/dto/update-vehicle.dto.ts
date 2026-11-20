import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { VehicleType } from '../vehicle-type.enum';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimAndUppercaseString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class UpdateVehicleDto {
  @ApiPropertyOptional({ example: 'Family car' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  label?: string;

  @ApiPropertyOptional({ enum: VehicleType, example: VehicleType.CAR })
  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;

  @ApiPropertyOptional({ example: 'Toyota', nullable: true })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  make?: string | null;

  @ApiPropertyOptional({ example: 'Corolla', nullable: true })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  model?: string | null;

  @ApiPropertyOptional({ example: 2019, minimum: 1886, maximum: 2100, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1886)
  @Max(2100)
  productionYear?: number | null;

  @ApiPropertyOptional({ example: 'DHAKA METRO GA 12-3456', nullable: true })
  @IsOptional()
  @Transform(trimAndUppercaseString)
  @IsString()
  @Length(1, 32)
  registrationNumber?: string | null;
}
