import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

type BillingCycle = 'weekly' | 'monthly' | 'yearly';

export class CreateCheckoutSessionDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  priceId?: string;

  @IsOptional()
  @IsIn(['weekly', 'monthly', 'yearly'])
  billingCycle?: BillingCycle;

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
