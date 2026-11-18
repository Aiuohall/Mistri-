import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { UserRole } from '../../users/user-role.enum';

export class AuthUserResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ format: 'email', nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;
}
