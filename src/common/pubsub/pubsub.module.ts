import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import mqEmitterRedis from 'mqemitter-redis';

import { AppConfigService } from '../../config/app-config.service';
import { redisOptions } from '../redis/redis.tokens';

import { MQ_EMITTER, type MqEmitter } from './pubsub.tokens';

@Global()
@Module({
  providers: [
    {
      provide: MQ_EMITTER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): MqEmitter => mqEmitterRedis(redisOptions(config)),
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
