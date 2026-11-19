import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateMechanicAvailabilityDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isOnline!: boolean;
}
