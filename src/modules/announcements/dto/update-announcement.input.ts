import { InputType } from '@nestjs/graphql';

import { CreateAnnouncementInput } from './create-announcement.input';

@InputType()
export class UpdateAnnouncementInput extends CreateAnnouncementInput {}
