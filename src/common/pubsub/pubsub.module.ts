import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import mqEmitterRedis from 'mqemitter-redis';

import { AppConfigService } from '../../config/app-config.service';

import { MQ_EMITTER, type MqEmitter } from './pubsub.tokens';

@Global()
@Module({
  providers: [
    {
      provide: MQ_EMITTER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): MqEmitter =>
        mqEmitterRedis({
          port: config.redis.port,
          host: config.redis.host,
          password: config.redis.password,
          db: config.redis.db,
          tls: config.redis.tls ? {} : undefined,
        }),
    },
  ],
  exports: [MQ_EMITTER],
})
export class PubSubModule implements OnApplicationShutdown {
  constructor(@Inject(MQ_EMITTER) private readonly emitter: MqEmitter) {}

  onApplicationShutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.emitter.close(resolve);
    });
  }
}
