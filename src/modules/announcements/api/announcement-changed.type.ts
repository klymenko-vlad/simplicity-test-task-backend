import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

enum AnnouncementChangedEventType {
  created = 'created',
  updated = 'updated',
  deleted = 'deleted',
}

registerEnumType(AnnouncementChangedEventType, { name: 'AnnouncementChangedEventType' });

@ObjectType('AnnouncementChanged')
export class AnnouncementChangedPayload {
  @Field(() => AnnouncementChangedEventType) eventType!: AnnouncementChangedEventType;
  @Field(() => ID) announcementId!: string;
  @Field({ nullable: true }) title?: string;
}
