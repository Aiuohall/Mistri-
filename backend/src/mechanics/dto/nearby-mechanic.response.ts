import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NearbyMechanicResponse {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional({ nullable: true })
  bio!: string | null;

  @ApiProperty({ type: [String] })
  serviceTypes!: string[];

  @ApiProperty({ example: 372 })
  distanceMeters!: number;

  @ApiProperty({ format: 'date-time' })
  locationUpdatedAt!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  averageRating?: number | null;

  @ApiPropertyOptional()
  reviewCount?: number;
}
