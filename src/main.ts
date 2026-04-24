import { Request, Response } from 'express';
import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import { AppModule } from './app.module';
import { ENVEnum } from './common/enum/env.enum';
import { AllExceptionsFilter } from './core/filter/http-exception.filter';

import { CORS_ORIGINS } from './common/constants/cors-origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  // * enable cors
  app.enableCors({
    origin: CORS_ORIGINS,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // * add global pipes
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // * add global filters
  app.useGlobalFilters(new AllExceptionsFilter());

  // * Swagger config with Bearer Auth
  const config = new DocumentBuilder()
    .setTitle('Backend API')
    .setDescription('The API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // * add body parser
  app.use('/webhook/stripe', bodyParser.raw({ type: 'application/json' }));

  // * set port
  // * health check endpoint for Docker/load balancer
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  const port = parseInt(configService.get<string>(ENVEnum.PORT) ?? '3000', 10);
  await app.listen(port);
}
bootstrap();
