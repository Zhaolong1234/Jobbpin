import { IsString, MaxLength, MinLength } from 'class-validator';

export class ImplementPlanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  userId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  planId!: string;
}
