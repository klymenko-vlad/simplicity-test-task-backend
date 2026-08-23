import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { Category } from '@prisma/client';

@ObjectType('Category')
export class CategoryType {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field() slug!: string;

  static fromEntity(category: Category): CategoryType {
    const dto = new CategoryType();

    dto.id = category.id;
    dto.name = category.name;
    dto.slug = category.slug;

    return dto;
  }
}
