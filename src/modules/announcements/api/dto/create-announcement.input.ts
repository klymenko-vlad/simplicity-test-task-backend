import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { IsUsDateTime } from '../../../../common/validators/us-datetime';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 200;
const CONTENT_MIN_LENGTH = 5;
const CONTENT_MAX_LENGTH = 5000;
const CATEGORIES_MAX = 5;

@InputType()
export class CreateAnnouncementInput {
  @Field()
  @Transform(trim)
  @IsString()
  @MinLength(TITLE_MIN_LENGTH)
  @MaxLength(TITLE_MAX_LENGTH)
  title!: string;

  @Field()
  @Transform(trim)
  @IsString()
  @MinLength(CONTENT_MIN_LENGTH)
  @MaxLength(CONTENT_MAX_LENGTH)
  content!: string;

  @Field()
  @IsUsDateTime()
  publishedAt!: string;

  @Field(() => [ID])
  @IsUUID('4', { each: true })
  @ArrayUnique()
  @ArrayMinSize(1)
  @ArrayMaxSize(CATEGORIES_MAX)
  categoryIds!: string[];
}
