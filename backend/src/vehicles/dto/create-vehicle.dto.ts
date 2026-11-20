import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { VehicleType } from '../vehicle-type.enum';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimAndUppercaseString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateVehicleDto {
  @ApiProperty({ example: 'Family car' })
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  label!: string;

  @ApiProperty({ enum: VehicleType, example: VehicleType.CAR })
  @IsEnum(VehicleType)
  type!: VehicleType;

  @ApiPropertyOptional({ example: 'Toyota' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  make?: string;

  @ApiPropertyOptional({ example: 'Corolla' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  model?: string;

  @ApiPropertyOptional({ example: 2019, minimum: 1886, maximum: 2100 })
  @IsOptional()
  @IsInt()
  @Min(1886)
  @Max(2100)
  productionYear?: number;

  @ApiPropertyOptional({ example: 'DHAKA METRO GA 12-3456' })
  @IsOptional()
  @Transform(trimAndUppercaseString)
  @IsString()
  @Length(1, 32)
  registrationNumber?: string;
}
