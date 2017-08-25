import * as Koa from 'koa';
import * as cors from 'kcors';
import * as json from 'koa-json';
import Logger from '@/services/logger';

const app = new Koa();
const port = process.env.SERVER_PORT;
const logger = new Logger('router');

app
  .use(cors())
  .use(json())
  .use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    logger.info(`${ctx.method} ${ctx.url} - ${ms}ms`);
  })
  .listen(port, () => {
    logger.info(`Started on http://localhost:${port}`);
  });

export default app;
