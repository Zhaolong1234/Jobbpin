import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class ChatHistoryItemDto {
  @IsString()
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  content!: string;
}

export class ChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  message!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  userId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItemDto)
  history?: ChatHistoryItemDto[];
}

