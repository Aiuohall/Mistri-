import { IsIn, IsInt, Matches, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class AmountDto {
  @ApiProperty({ description: 'Amount in integer BDT poisha', minimum: 1, maximum: 100000000 })
  @IsInt()
  @Min(1)
  @Max(100000000)
  amount!: number;
}
export class QuoteDto extends AmountDto {
  @ApiProperty({ minimum: 1, description: 'Next sequential quote version' })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  version!: number;
}
export class TopupDto extends AmountDto {
  @ApiProperty({ example: 'TEST123456' })
  @Matches(/^[a-z0-9]{6,40}$/i)
  reference!: string;
}
class ReasonDto {
  @ApiProperty({ maxLength: 500 })
  @Matches(/\S/)
  @MaxLength(500)
  reason!: string;
}
export class DecisionDto extends ReasonDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';
}
export class CorrectionDto extends ReasonDto {
  @ApiProperty({ enum: ['refund', 'release'] })
  @IsIn(['refund', 'release'])
  action!: 'refund' | 'release';
}
