import serverlessExpress from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Callback, Context, Handler } from 'aws-lambda';
import { ReplaySubject } from 'rxjs';
import { MessageProcessorService } from './message-processor.service';

type EventPayload = {
  [key: string]: any;
};

let server: Handler;
const serverSubject = new ReplaySubject<Handler>();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('/api');
  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

bootstrap().then((server) => serverSubject.next(server));

export const httpHandler: Handler = async (
  event: EventPayload,
  context: Context,
  callback: Callback,
) => {
  if (event.path === '' || event.path === undefined) event.path = '/';

  server = server ?? (await bootstrap());
  return server(event, context, callback);
};

export const sqsHandler: Handler = async (
  event: AWSLambda.SQSEvent,
  context: Context,
) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const messageProcessor = app.get(MessageProcessorService);

  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    await messageProcessor.processMessage(message);
  }
};
