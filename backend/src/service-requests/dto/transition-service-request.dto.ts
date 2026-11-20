import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { MechanicServiceRequestAction } from '../mechanic-service-request-action.enum';

export class TransitionServiceRequestDto {
  @ApiProperty({ enum: MechanicServiceRequestAction })
  @IsEnum(MechanicServiceRequestAction)
  action!: MechanicServiceRequestAction;
}
