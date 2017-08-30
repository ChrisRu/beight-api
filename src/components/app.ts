import * as Koa from 'koa';
import * as cors from 'kcors';
import * as bodyParser from 'koa-bodyparser';
import * as session from 'koa-session';
import database from '@/components/database';
import * as passport from 'koa-passport';
import { Strategy } from 'passport-local';
import Logger from '@/services/logger';

passport.serializeUser((user, done) => {
  console.log('ser');
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  console.log('ay');
  return database
    .query('SELECT * FROM account WHERE id = $1', [id])
    .then(user => done(null, user))
    .catch(error => done(error, null));
});

passport.use(
  new Strategy(async (username, password, done) => {
    console.log(username, password);
    return database
      .query('SELECT * FROM account WHERE username = $1 AND password = $2', [username, password])
      .then(data => {
        if (data.rows[0].length === 0) {
          return done(null, false);
        }
        return done(null, data.rows[0]);
      })
      .catch(error => {
        return done(null, false);
      });
  })
);

const app = new Koa();
const port = process.env.SERVER_PORT;
const logger = new Logger('router');

app.keys = ['secret-key-dev'];

app
  .use(cors())
  .use(bodyParser())
  .use(session({}, app))
  .use(passport.initialize())
  .use(passport.session())
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
