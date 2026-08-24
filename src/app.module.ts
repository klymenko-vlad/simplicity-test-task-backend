import { join } from 'node:path';

import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { MercuriusDriver, type MercuriusDriverConfig } from '@nestjs/mercurius';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { NoSchemaIntrospectionCustomRule } from 'graphql';

import { GqlExceptionFilter } from './common/graphql/gql-exception.filter';
import { GqlThrottlerGuard } from './common/graphql/gql-throttler.guard';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { LifecycleModule } from './common/lifecycle/lifecycle.module';
import { LoggerModule } from './common/logger/logger.module';
import { PubSubModule } from './common/pubsub/pubsub.module';
import { MQ_EMITTER, type MqEmitter } from './common/pubsub/pubsub.tokens';
import { RedisModule } from './common/redis/redis.module';
import { AppConfigService } from './config/app-config.service';
import { ConfigModule } from './config/config.module';
import { AppRole } from './config/env.schema';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QueueModule } from './queue/queue.module';

function workerModules(): DynamicModule[] {
  const role = AppRole.parse(process.env.ROLE ?? 'all');

  return role === 'api' ? [] : [QueueModule.forWorkers()];
}

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    LifecycleModule,
    RedisModule,
    PubSubModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    QueueModule.forRoot(),
    ...workerModules(),
    GraphQLModule.forRootAsync<MercuriusDriverConfig>({
      driver: MercuriusDriver,
      inject: [AppConfigService, MQ_EMITTER],
      useFactory: (config: AppConfigService, emitter: MqEmitter) => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        sortSchema: true,
        graphiql: config.graphiqlEnabled,
        ...(config.isProduction ? { validationRules: [NoSchemaIntrospectionCustomRule] } : {}),
        queryDepth: 12,
        subscription: {
          emitter,
          fullWsTransport: true,
        },
        context: (request: unknown, reply: unknown) => ({ req: request, reply }),
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.throttle.ttlMs,
            limit: config.throttle.limit,
          },
        ],
        storage: new ThrottlerStorageRedisService({
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
          db: config.redis.db,
          tls: config.redis.tls ? {} : undefined,
          keyPrefix: `${config.queue.prefix}:throttle:`,
        }),
      }),
    }),

    HealthModule,
    AnnouncementsModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: GqlThrottlerGuard },
    { provide: APP_FILTER, useClass: GqlExceptionFilter },
    {
      provide: APP_INTERCEPTOR,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new TimeoutInterceptor(config.http.requestTimeoutMs),
    },
  ],
})
export class AppModule {}
