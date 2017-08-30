import * as Router from 'koa-router';
import * as passport from 'koa-passport';
import * as bodyParser from 'koa-body';
import app from '@/components/app';
import database from '@/components/database';
import store from '@/components/store';

const router = new Router();

router
  .get('/games', async (ctx, next) => {
    await next();

    console.log(ctx.isAuthenticated());

    ctx.type = 'application/json';
    ctx.body = await database.getGames();
  })
  .post('/create', async (ctx, next) => {
    await next();

    return passport.authenticate('local', async (err, user, info, status) => {
      if (user === false) {
        ctx.body = { error: 'Not logged in' };
        ctx.throw(401);
      } else {
        const { value } = ctx.request['body'];
        const game = await store.createGame(JSON.parse(value));

        ctx.type = 'application/json';
        ctx.body = { guid: game[0] };
      }
    })(ctx);
  })
  .post('/login', bodyParser, async (ctx, next) => {
    console.log(ctx.request.body);
  })
  .post('/logout', async (ctx, next) => {
    return ctx.logout();
  })
  .post('/signup', async (ctx, next) => {
    await next();

    const saltRounds = 10;

    let username, password;
    try {
      const value = JSON.parse(ctx.request['body'].value);
      username = value.username;
      password = value.password;
    } catch (error) {
      this.logger.error("Can't convert post data to json");
      return;
    }

    if (!username || !password) {
      ctx.type = 'application/json';
      ctx.body = { success: false };
      return;
    }

    return store
      .createUser(username, password)
      .then(() => {
        ctx.type = 'application/json';
        ctx.body = { success: true };
        return;
      })
      .catch(error => {
        ctx.type = 'application/json';
        ctx.body = { success: false };
        return;
      });
  });

app.use(router.routes()).use(router.allowedMethods());

export default router;
