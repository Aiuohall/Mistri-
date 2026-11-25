import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SendMessageDto {
  @IsUUID()
  clientId!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 1000)
  body!: string;
}

export class ReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 500)
  comment?: string;
}

export class PushTokenDto {
  @IsString()
  @Length(1, 200)
  @Matches(/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/)
  token!: string;
}
