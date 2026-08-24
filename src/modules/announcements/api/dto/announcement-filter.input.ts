import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const CATEGORY_IDS_MAX = 20;
const SEARCH_MAX_LENGTH = 200;

const trimToUndefined = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

@InputType()
export class AnnouncementFilterInput {
  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsUUID('4', { each: true })
  @ArrayUnique()
  @ArrayMaxSize(CATEGORY_IDS_MAX)
  categoryIds?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(SEARCH_MAX_LENGTH)
  search?: string;
}
