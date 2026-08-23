import { ParseUUIDPipe } from '@nestjs/common';
import { Args, Context, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';

import { PaginationInput } from '../../common/dto/pagination.types';
import { ANNOUNCEMENT_CHANGED_TOPIC } from '../../common/pubsub/pubsub.tokens';

import { AnnouncementChangedPayload } from './announcement-changed.type';
import { AnnouncementPageType, AnnouncementType } from './announcement.entity';
import { AnnouncementsService } from './announcements.service';
import { CategoryType } from './category.entity';
import { CreateAnnouncementInput } from './dto/create-announcement.input';
import { UpdateAnnouncementInput } from './dto/update-announcement.input';

interface MercuriusPubSub {
  subscribe(topic: string): Promise<AsyncIterable<AnnouncementChangedPayload>>;
}

const AnnouncementId = (): ParameterDecorator =>
  Args('id', { type: () => ID }, new ParseUUIDPipe({ version: '4' }));

@Resolver(() => AnnouncementType)
export class AnnouncementsResolver {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Query(() => AnnouncementPageType, { description: 'Announcements page, newest update first' })
  announcements(
    @Args('pagination', { nullable: true, type: () => PaginationInput })
    pagination?: PaginationInput,
  ): Promise<AnnouncementPageType> {
    return this.announcementsService.list(pagination ?? new PaginationInput());
  }

  @Query(() => AnnouncementType)
  announcement(@AnnouncementId() id: string): Promise<AnnouncementType> {
    return this.announcementsService.findOne(id);
  }

  @Query(() => [CategoryType])
  categories(): Promise<CategoryType[]> {
    return this.announcementsService.listCategories();
  }

  @Mutation(() => AnnouncementType)
  createAnnouncement(@Args('input') input: CreateAnnouncementInput): Promise<AnnouncementType> {
    return this.announcementsService.create(input);
  }

  @Mutation(() => AnnouncementType)
  updateAnnouncement(
    @AnnouncementId() id: string,
    @Args('input') input: UpdateAnnouncementInput,
  ): Promise<AnnouncementType> {
    return this.announcementsService.update(id, input);
  }

  @Mutation(() => Boolean)
  deleteAnnouncement(@AnnouncementId() id: string): Promise<boolean> {
    return this.announcementsService.remove(id);
  }

  @Subscription(() => AnnouncementChangedPayload, {
    resolve: (payload: AnnouncementChangedPayload) => payload,
  })
  announcementChanged(
    @Context('pubsub') pubsub: MercuriusPubSub,
  ): Promise<AsyncIterable<AnnouncementChangedPayload>> {
    return pubsub.subscribe(ANNOUNCEMENT_CHANGED_TOPIC);
  }
}
