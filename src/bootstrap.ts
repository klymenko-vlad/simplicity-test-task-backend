import './config/load-env';

import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Http2ServerRequest } from 'node:http2';

import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { REQUEST_ID_HEADER } from './common/logger/logger.module';
import { AppConfigService } from './config/app-config.service';
import { validateEnv } from './config/env.schema';
import { parseTrustProxy } from './config/trust-proxy';

export async function createApp(): Promise<NestFastifyApplication> {
  const env = validateEnv(process.env);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      genReqId: (req: IncomingMessage | Http2ServerRequest) => {
        const incoming = req.headers[REQUEST_ID_HEADER];
        return typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
      },
      trustProxy: parseTrustProxy(env.TRUSTED_PROXIES),
      bodyLimit: env.BODY_LIMIT_BYTES,
    }),
    { bufferLogs: true },
  );

  const config = app.get(AppConfigService);

  app.useLogger(app.get(Logger));
  app.flushLogs();

  await app.register(helmet, {
    contentSecurityPolicy: config.graphiqlEnabled ? false : undefined,
  });
  await app.register(compress, { encodings: ['br', 'gzip', 'deflate'], threshold: 1024 });

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', (request, reply, _payload, done) => {
      reply.header(REQUEST_ID_HEADER, request.id);
      done();
    });

  const { corsOrigins } = config.http;
  app.enableCors({
    origin: corsOrigins,
    credentials: corsOrigins !== true,
    maxAge: 86_400,
  });

  app.setGlobalPrefix(config.http.apiPrefix, {
    exclude: ['health', 'health/live', 'health/ready', 'graphql'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();

  return app;
}
