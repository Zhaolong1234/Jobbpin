import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateOnboardingStepDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  userId!: string;

  @IsInt()
  @Min(1)
  @Max(4)
  currentStep!: number;

  @IsOptional()
  @IsBoolean()
  profileSkipped?: boolean;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}
