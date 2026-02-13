import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SyncOnboardingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  userId!: string;

  @IsBoolean()
  profileCompleted!: boolean;

  @IsBoolean()
  resumeUploaded!: boolean;

  @IsBoolean()
  subscriptionActive!: boolean;

  @IsBoolean()
  @IsOptional()
  profileSkipped?: boolean;
}
