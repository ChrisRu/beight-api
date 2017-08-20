import Koa from 'koa';
import cors from 'kcors';
import logger from '@/services/logger';

const app = new Koa();
const port = process.env.SERVER_PORT;

app
  .use(cors())
  .use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    logger.info('router', `${ctx.method} ${ctx.url} - ${ms}ms`);
  })
  .listen(port, () => {
    logger.info('server', `Started on http://localhost:${port}`);
  });

export default app;
