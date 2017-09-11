import * as Router from 'koa-router';
import * as passport from 'koa-passport';
import app from '@/components/app';
import database from '@/components/database';
import store from '@/components/store';

const router = new Router();

router
  // Get games
  .get('/games', async ctx => {
    ctx.body = await database.getGames();
  })
  // Get game by guid
  .get('/games/:guid', async ctx => {
    ctx.body = await database.getGame(ctx.params.guid);
  })
  // Create a new Game
  .post('/create', async ctx => {
    if (ctx.isAuthenticated()) {
      await store
        .createGame(ctx.request.body)
        .then(games => {
          ctx.body = { guid: games[0].game };
        })
        .catch(() => {
          ctx.body = { success: false, error: "Can't create game" };
        });
    } else {
      ctx.body = { success: false, error: 'Unauthorized' };
    }
  })
  // Check if user is logged in
  .get('/loggedin', ctx => {
    ctx.body = { authenticated: ctx.isAuthenticated() };
  })
  // Log user out
  .post('/logout', ctx => {
    ctx.logout();
    ctx.body = { authenticated: ctx.isAuthenticated() };
  })
  // Log user in
  .post('/login', (ctx, next) =>
    passport.authenticate('local', (error, user) => {
      if (error) {
        ctx.body = { success: false };
        ctx.throw(401);
      } else {
        ctx.body = { success: true };
        ctx.login(user);
      }
    })(ctx, next)
  )
  // Sign up a new user
  .post('/signup', async ctx => {
    const { username, password } = ctx.request.body;

    return store
      .createUser(username, password)
      .then(() => {
        ctx.body = { success: true };
      })
      .catch(() => {
        ctx.body = { success: false };
      });
  });

app.use(router.routes()).use(router.allowedMethods());

export default router;
