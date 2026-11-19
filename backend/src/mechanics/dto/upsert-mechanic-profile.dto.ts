import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimAndDeduplicateStrings = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? [...new Set(value.map((item) => (typeof item === 'string' ? item.trim() : item)))]
    : value;

export class UpsertMechanicProfileDto {
  @ApiProperty({ example: 'Rahim Auto Care' })
  @Transform(trimString)
  @IsString()
  @Length(1, 100)
  displayName!: string;

  @ApiPropertyOptional({ example: 'Car and motorcycle mechanic with roadside experience.' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 500)
  bio?: string;

  @ApiProperty({ example: ['car', 'motorcycle'] })
  @Transform(trimAndDeduplicateStrings)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Length(1, 50, { each: true })
  serviceTypes!: string[];
}
