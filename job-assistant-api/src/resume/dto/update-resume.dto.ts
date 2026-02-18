import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateResumeDto {
  @IsObject()
  parsed!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MinLength(1)
  templateId?: string;
}
