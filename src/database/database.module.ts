import { Global, Module } from '@nestjs/common';

import { PrismaReadService, PrismaService } from './prisma.service';
import { TransactionHost } from './transaction.host';

@Global()
@Module({
  providers: [PrismaService, PrismaReadService, TransactionHost],
  exports: [PrismaService, PrismaReadService, TransactionHost],
})
export class DatabaseModule {}
