import { ApiProperty } from '@nestjs/swagger';

export class LocationUpdateResponse {
  @ApiProperty({ format: 'date-time' })
  locationUpdatedAt!: string;
}
