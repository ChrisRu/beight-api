import * as Router from 'koa-router';
import app from '@/components/app';
import database from '@/components/database';

const router = new Router();

router
  .get('/', ctx => {
    ctx.body = 'Hello world!';
  })
  .get('/games', async (ctx) => {
    ctx.type = 'application/json';
    ctx.body = (await database.query('SELECT * FROM streams')).rows;
  });

app.use(router.routes()).use(router.allowedMethods());

export default router;
