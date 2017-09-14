import * as Router from 'koa-router';
import * as passport from 'koa-passport';
import app from '@/components/app';
import database from '@/components/database';
import store from '@/components/store';

const router = new Router();

router
  .get('/games', async ctx => {
    ctx.body = await store.getGames();
  })
  .get('/games/:guid', async ctx => {
    ctx.body = await store.getGame(ctx.params.guid).catch(() => {
      ctx.throw(404);
    });
  })
  .post('/games/create', async ctx => {
    if (ctx.isAuthenticated()) {
      const { body } = ctx.request;
      if (Object.prototype.toString.call(body) !== '[object Array]') {
        ctx.body = { success: false, error: 'Bad request' };
        ctx.throw(400);
        return;
      }

      await store
        .createGame(body)
        .then(games => {
          ctx.body = { guid: games[0].game };
        })
        .catch(() => {
          ctx.body = { success: false, error: "Can't create game" };
          ctx.throw(501);
        });
    } else {
      ctx.body = { success: false, error: 'Unauthorized' };
      ctx.throw(401);
    }
  })
  // Check if user is logged in
  .get('/auth/loggedin', ctx => {
    ctx.body = { authenticated: ctx.isAuthenticated() };
  })
  // Log user out
  .post('/auth/logout', ctx => {
    ctx.logout();
    ctx.body = { authenticated: ctx.isAuthenticated() };
  })
  // Log user in
  .post('/auth/login', (ctx, next) =>
    passport.authenticate('local', (error, user) => {
      if (error || !user) {
        ctx.body = { success: false };
        ctx.throw(401);
      } else {
        ctx.body = { success: true };
        ctx.login(user);
      }
    })(ctx, next)
  )
  // Sign up a new user
  .post('/auth/signup', ctx => {
    const { username, password } = ctx.request.body;

    return store
      .createUser(username, password)
      .then(() => {
        ctx.body = { success: true };
      })
      .catch(() => {
        ctx.body = { success: false };
      });
  })
  // Check if username exists
  .get('/exists/username/:username', async ctx => {
    const data = await database
      .findUser(ctx.params.username)
      .catch(() => ({ rows: [] }));
    const user = data.rows && data.rows[0];

    if (user) {
      ctx.body = { exists: true };
    } else {
      ctx.body = { exists: false };
    }
  });

app.use(router.routes()).use(router.allowedMethods());

export default router;
