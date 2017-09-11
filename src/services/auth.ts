import * as passport from 'koa-passport';
import * as bcrypt from 'bcrypt';
import { Strategy } from 'passport-local';
import database from '@/components/database';
import Logger from '@/services/logger';

const logger = new Logger('auth');

function getStrategy() {
  return new Strategy(async (username, password, done) =>
    database
      .query('SELECT * FROM account WHERE username = $1', [username])
      .then(async data => {
        const user = data.rows[0];

        if (!user) {
          logger.warn(`Username ${username} not found`);
          return done(new Error('Username not found'), false);
        }

        if (await bcrypt.compare(password, user.password)) {
          logger.info(`Logged in user: ${user.username}`);
          return done(null, user);
        }

        logger.warn('Incorrect password');
        return done(new Error('Incorrect password'), false);
      })
      .catch(error => {
        logger.warn(`Can't login user: ${error}`);
        return done(error, false);
      })
  );
}

function deserializeUser(id, done) {
  return database
    .query('SELECT * FROM account WHERE id = $1', [id])
    .then(user => done(null, user))
    .catch(error => done(error, false));
}

function serializeUser(user, done) {
  return done(null, user.id);
}

passport.serializeUser(serializeUser);
passport.deserializeUser(deserializeUser);
passport.use(getStrategy());
