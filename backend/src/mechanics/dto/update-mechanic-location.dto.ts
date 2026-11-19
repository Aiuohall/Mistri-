import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude } from 'class-validator';

export class UpdateMechanicLocationDto {
  @ApiProperty({ example: 23.7525 })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 90.3742 })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;
}
