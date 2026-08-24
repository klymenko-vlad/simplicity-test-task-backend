import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { Announcement, AnnouncementCategory, Category } from '@prisma/client';

import { CategoryType } from './category.entity';

export type AnnouncementWithCategories = Announcement & {
  categories: (AnnouncementCategory & { category: Category })[];
};

@ObjectType('Announcement')
export class AnnouncementType {
  @Field(() => ID) id!: string;
  @Field() title!: string;
  @Field() content!: string;
  @Field() publishedAt!: Date;
  @Field() createdAt!: Date;
  @Field() updatedAt!: Date;
  @Field(() => [CategoryType]) categories!: CategoryType[];

  static fromEntity(announcement: AnnouncementWithCategories): AnnouncementType {
    const dto = new AnnouncementType();

    dto.id = announcement.id;
    dto.title = announcement.title;
    dto.content = announcement.content;
    dto.publishedAt = announcement.publishedAt;
    dto.createdAt = announcement.createdAt;
    dto.updatedAt = announcement.updatedAt;
    dto.categories = announcement.categories.map((link) =>
      CategoryType.fromEntity(link.category),
    );

    return dto;
  }
}

@ObjectType('AnnouncementPage')
export class AnnouncementPageType {
  @Field(() => [AnnouncementType]) items!: AnnouncementType[];
  @Field() total!: number;
}
