import * as Koa from 'koa';
import * as cors from 'kcors';
import * as bodyParser from 'koa-bodyparser';
import * as session from 'koa-session';
import * as passport from 'koa-passport';
import Logger from '@/services/logger';
import '@/services/auth';

const app = new Koa();
const port = process.env.SERVER_PORT;

app.keys = [process.env.COOKIE_KEY];

app
  .use(cors({
    allowHeaders: 'Content-Type',
    credentials: true
  }))
  .use(bodyParser())
  .use(session({}, app))
  .use(passport.initialize())
  .use(passport.session())
  .use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    Logger.info('router', `${ctx.method} ${ctx.url} - ${ms}ms`);
  })
  .listen(port, () => {
    Logger.info('server', `Started on http://localhost:${port}`);
  });

export default app;
