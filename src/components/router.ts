import Router from 'koa-router';
import app from '@/components/app';
import Database from '@/services/database';

const router = new Router();
const database = new Database('streams');
database.connect();

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
