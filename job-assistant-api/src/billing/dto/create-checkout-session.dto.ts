import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsString()
  @MinLength(1)
  priceId!: string;

  @IsString()
  @MinLength(1)
  successUrl!: string;

  @IsString()
  @MinLength(1)
  cancelUrl!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  trialDays?: number;
}
