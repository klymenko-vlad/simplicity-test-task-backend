import { Injectable } from '@nestjs/common';

import { PaginationInput } from '../../../common/dto/pagination.types';
import { EntityNotFoundError, InvalidInputError } from '../../../common/errors/domain.error';
import { parseUsDateTime } from '../../../common/validators/us-datetime';
import { NotificationsService } from '../../notifications/notifications.service';
import { AnnouncementPageType, AnnouncementType } from '../api/announcement.entity';
import { CategoryType } from '../api/category.entity';
import { AnnouncementFilterInput } from '../api/dto/announcement-filter.input';
import { CreateAnnouncementInput } from '../api/dto/create-announcement.input';
import { UpdateAnnouncementInput } from '../api/dto/update-announcement.input';
import {
  AnnouncementsRepository,
  type AnnouncementData,
  type AnnouncementSortField,
} from '../persistence/announcements.repository';
import { CategoriesRepository } from '../persistence/categories.repository';

import { AnnouncementRemindersScheduler } from './announcement-reminders.scheduler';

const PUBLISHED_AT_PAST_TOLERANCE_MS = 60_000;
const PUBLISHED_AT_MAX_FUTURE_YEARS = 5;

const SORTABLE_FIELDS: Record<string, AnnouncementSortField> = {
  publishedAt: 'publishedAt',
  updatedAt: 'updatedAt',
  createdAt: 'createdAt',
  title: 'title',
};

const DEFAULT_SORT_FIELD: AnnouncementSortField = 'updatedAt';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly reminders: AnnouncementRemindersScheduler,
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(
    pagination: PaginationInput,
    filter?: AnnouncementFilterInput,
  ): Promise<AnnouncementPageType> {
    const { items, total } = await this.announcementsRepository.findPageWithCategories({
      limit: pagination.limit,
      offset: pagination.offset,
      sortBy: this.sortField(pagination.sortBy),
      order: pagination.order,
      categoryIds: filter?.categoryIds,
      search: filter?.search,
    });

    const page = new AnnouncementPageType();
    page.items = items.map((item) => AnnouncementType.fromEntity(item));
    page.total = total;

    return page;
  }

  async findOne(id: string): Promise<AnnouncementType> {
    const found = await this.announcementsRepository.findByIdWithCategories(id);
    if (!found) throw new EntityNotFoundError('announcement', id);

    return AnnouncementType.fromEntity(found);
  }

  async listCategories(): Promise<CategoryType[]> {
    const categories = await this.categoriesRepository.findAllOrdered();

    return categories.map((category) => CategoryType.fromEntity(category));
  }

  async create(input: CreateAnnouncementInput): Promise<AnnouncementType> {
    const data = await this.prepare(input);
    this.assertPublishableAt(data.publishedAt);

    const created = await this.announcementsRepository.transaction((tx) =>
      this.announcementsRepository.createWithCategories(data, input.categoryIds, tx),
    );

    await this.reminders.onCreated(created.id, created.publishedAt);

    return AnnouncementType.fromEntity(created);
  }

  async update(id: string, input: UpdateAnnouncementInput): Promise<AnnouncementType> {
    const data = await this.prepare(input);

    const result = await this.announcementsRepository.transaction(async (tx) => {
      const existing = await this.announcementsRepository.findByIdWithCategories(id, tx);
      if (!existing) throw new EntityNotFoundError('announcement', id);

      const dateChanged = data.publishedAt.getTime() !== existing.publishedAt.getTime();
      if (dateChanged) this.assertPublishableAt(data.publishedAt);

      const updated = await this.announcementsRepository.updateWithCategories(
        id,
        data,
        input.categoryIds,
        tx,
      );
      if (!updated) throw new EntityNotFoundError('announcement', id);

      return { updated, dateChanged };
    });

    if (result.dateChanged) {
      await this.reminders.onRescheduled(id, data.publishedAt);
    }

    return AnnouncementType.fromEntity(result.updated);
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.announcementsRepository.transaction((tx) =>
      this.announcementsRepository.softDeleteWithOutbox(id, tx),
    );
    if (!deleted) throw new EntityNotFoundError('announcement', id);

    await this.reminders.onDeleted(id);
    await this.notificationsService.discardForAnnouncement(id);

    return true;
  }

  private async prepare(
    input: CreateAnnouncementInput | UpdateAnnouncementInput,
  ): Promise<AnnouncementData> {
    await this.assertCategoriesExist(input.categoryIds);

    return {
      title: input.title,
      content: input.content,
      publishedAt: this.parsePublishedAt(input.publishedAt),
    };
  }

  private sortField(sortBy: string | undefined): AnnouncementSortField {
    if (sortBy === undefined) return DEFAULT_SORT_FIELD;

    const field = SORTABLE_FIELDS[sortBy];
    if (!field) {
      throw new InvalidInputError(
        'INVALID_SORT_FIELD',
        `sortBy must be one of ${Object.keys(SORTABLE_FIELDS).join(', ')}`,
      );
    }

    return field;
  }

  private parsePublishedAt(value: string): Date {
    const parsed = parseUsDateTime(value);
    if (!parsed) {
      throw new InvalidInputError(
        'INVALID_PUBLISHED_AT',
        'publishedAt must be MM/DD/YYYY HH:mm',
      );
    }

    return parsed;
  }

  private assertPublishableAt(publishedAt: Date): void {
    const now = new Date();

    if (publishedAt.getTime() < now.getTime() - PUBLISHED_AT_PAST_TOLERANCE_MS) {
      throw new InvalidInputError('PUBLISHED_AT_IN_PAST', 'publishedAt cannot be in the past');
    }

    const latest = new Date(now);
    latest.setUTCFullYear(latest.getUTCFullYear() + PUBLISHED_AT_MAX_FUTURE_YEARS);

    if (publishedAt.getTime() > latest.getTime()) {
      throw new InvalidInputError(
        'PUBLISHED_AT_TOO_FAR_AHEAD',
        `publishedAt cannot be more than ${PUBLISHED_AT_MAX_FUTURE_YEARS} years ahead`,
      );
    }
  }

  private async assertCategoriesExist(categoryIds: string[]): Promise<void> {
    const exist = await this.categoriesRepository.allIdsExist(categoryIds);
    if (!exist) {
      throw new InvalidInputError(
        'INVALID_CATEGORY_IDS',
        'One or more categories do not exist',
      );
    }
  }
}
