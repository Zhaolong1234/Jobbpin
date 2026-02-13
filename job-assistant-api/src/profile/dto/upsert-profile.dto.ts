import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  yearsExp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.trim().length > 0)
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  linkedinUrl?: string;

  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.trim().length > 0)
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  portfolioUrl?: string;

  @IsOptional()
  @IsBoolean()
  allowLinkedinAnalysis?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  employmentTypes?: string[];

  @IsOptional()
  @IsBoolean()
  profileSkipped?: boolean;
}
