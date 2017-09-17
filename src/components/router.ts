import * as Router from 'koa-router';
import * as passport from 'koa-passport';
import app from '@/components/app';
import database from '@/components/database';
import store from '@/components/store';

const authenticate = ctx =>
  new Promise((resolve, reject) => {
    if (ctx.isUnauthenticated()) {
      const error = 'Unauthorized';
      ctx.body = { error };
      ctx.throw(401);
      reject(error);
    }
    resolve();
  });

const router = new Router();

router
  // Get all games
  .get('/games', async ctx => {
    ctx.body = await store.getGames();
  })
  // Get all games that are created by the user
  .get('/games/manage', async ctx => {
    await authenticate(ctx);

    await store
      .getGamesByOwner(ctx.state.user.id)
      .then(games => {
        ctx.body = games;
      })
      .catch(error => {
        ctx.body = { error };
        ctx.throw(404);
      });
  })
  // Get a game by guid
  .get('/games/:guid', async ctx => {
    await store
      .getGame(ctx.params.guid)
      .then(game => {
        ctx.body = game;
      })
      .catch(() => {
        ctx.throw(404);
      });
  })
  // Edit an existing game
  .post('/games/:guid/edit', async ctx => {
    await authenticate(ctx);

    const { guid } = ctx.params;
    if (store.getGameOwner(guid) === ctx.state.user.id) {
      await store
        .editGame(guid, ctx.request.body)
        .then(() => {
          ctx.body = { success: true };
        })
        .catch(() => {
          ctx.body = {
            success: false,
            error: 'Incorrect data supplied (probably)'
          };
          ctx.throw(404);
        });
    }
  })
  // Create a new game
  .post('/games/create', async ctx => {
    await authenticate(ctx);

    const { body } = ctx.request;

    if (Object.prototype.toString.call(body) !== '[object Array]') {
      ctx.body = { error: 'Bad request' };
      ctx.throw(400);
    }

    await store
      .createGame(ctx.state.user.id, body)
      .then(games => {
        ctx.body = { guid: games[0].game };
      })
      .catch(() => {
        ctx.body = { error: "Can't create game" };
        ctx.throw(501, ctx.body.error);
      });
  })
  // Check if user is logged in
  .get('/auth/loggedin', ctx => {
    ctx.body = {
      success: true,
      authenticated: ctx.isAuthenticated(),
      username: ctx.state.user.username
    };
  })
  // Log user out
  .post('/auth/logout', ctx => {
    ctx.logout();
    ctx.body = { success: true, authenticated: ctx.isAuthenticated() };
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
  .post('/auth/signup', async ctx => {
    const { username, password } = ctx.request.body;

    await store
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

    const userExists = data.rows[0] !== undefined;

    ctx.body = { exists: userExists };
  })
  .get('/users/:username', async ctx => {
    await authenticate(ctx);

    ctx.body = database.getUsers(ctx.params.username);
  });

app.use(router.routes()).use(router.allowedMethods());

export default router;
