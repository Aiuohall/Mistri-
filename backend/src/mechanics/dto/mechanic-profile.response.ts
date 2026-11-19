import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MechanicProfileResponse {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional({ nullable: true })
  bio!: string | null;

  @ApiProperty({ type: [String] })
  serviceTypes!: string[];

  @ApiProperty()
  isOnline!: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  locationUpdatedAt!: string | null;
}
