import * as Router from 'koa-router';
import * as passport from 'koa-passport';
import app from '@/components/app';
import database from '@/components/database';
import store from '@/components/store';

const router = new Router();

router
  // Get games
  .get('/games', async (ctx, next) => {
    ctx.type = 'application/json';
    ctx.body = await database.getGames();
  })
  // Get game by guid
  .get('/games/:guid', async (ctx, next) => {
    ctx.type = 'application/json';
    ctx.body = await database.getGame(ctx.params.guid);
  })
  // Create a new Game
  .post('/create', async (ctx, next) => {
    ctx.type = 'application/json';

    if (ctx.isAuthenticated()) {
      return store
        .createGame(ctx.request.body)
        .then(games => {
          ctx.body = { guid: games[0].game };
        })
        .catch(error => {
          console.log(error);
          ctx.body = { success: false, error: "Can't create game" };
        });
    } else {
      ctx.body = { success: false, error: 'Unauthorized' };
    }
  })
  // Check if user is logged in
  .get('/loggedin', (ctx, next) => {
    ctx.type = 'application/json';
    ctx.body = { authenticated: ctx.isAuthenticated() };
  })
  // Log user out
  .post('/logout', (ctx, next) => {
    ctx.logout();
    ctx.type = 'application/json';
    ctx.body = { authenticated: ctx.isAuthenticated() };
  })
  // Log user in
  .post('/login', passport.authenticate('local'), (ctx, next) => {
    ctx.type = 'application/json';
    ctx.body = { authenticated: ctx.isAuthenticated() };
  })
  // Sign up a new user
  .post('/signup', async (ctx, next) => {
    ctx.type = 'application/json';

    const { username, password } = ctx.request.body;

    return store
      .createUser(username, password)
      .then(() => {
        ctx.body = { success: true };
        return;
      })
      .catch(error => {
        ctx.body = { success: false };
        return;
      });
  });

app.use(router.routes()).use(router.allowedMethods());

export default router;
