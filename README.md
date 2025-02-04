# Nest.js Serverless

### Serverless HTTP route

http://localhost:3001/dev/api

```
import serverlessExpress from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Callback, Context, Handler } from 'aws-lambda';
import { ReplaySubject } from 'rxjs';

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

export const handler: Handler = async (
  event: EventPayload,
  context: Context,
  callback: Callback,
) => {
  if (event.path === '' || event.path === undefined) event.path = '/';

  server = server ?? (await bootstrap());
  return server(event, context, callback);
};
```

Run `serverless login`
Run `sls offline`
Run `npm run start:dev`
Run `sls deploy`
