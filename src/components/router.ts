import Router from 'koa-router';
import app from '@/components/app';

const router = new Router();

router
  .get('/', ctx => {
    ctx.body = 'Hello world!';
  })
  .get('/hey', ctx => {
    ctx.body = 'oy';
  });

app.use(router.routes()).use(router.allowedMethods());

export default router;
