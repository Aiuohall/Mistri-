import { Transform } from 'class-transformer';
import { IsLatitude, IsLongitude, IsString, IsUUID, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateServiceRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vehicleId!: string;

  @ApiProperty({ example: 'flat_tire' })
  @Transform(trimString)
  @IsString()
  @Length(1, 50)
  serviceType!: string;

  @ApiProperty({ example: 'Rear-left tire is flat; I am parked safely beside the road.' })
  @Transform(trimString)
  @IsString()
  @Length(1, 1000)
  description!: string;

  @ApiProperty({ example: 23.7525 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 90.3742 })
  @IsLongitude()
  longitude!: number;
}
