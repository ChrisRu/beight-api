import * as passport from 'koa-passport';
import * as bcrypt from 'bcrypt';
import { Strategy } from 'passport-local';
import database from '@/components/database';
import Logger from '@/services/logger';

const logger = new Logger('auth');

/**
 * Get the local strategy
 * @returns Local strategy
 */
function getStrategy() {
  return new Strategy(async (username, password, done) =>
    database
      .query('SELECT * FROM account WHERE LOWER(username) = LOWER($1)', [username])
      .then(async data => {
        const user = data.rows[0];

        if (!user) {
          logger.warn(`Username ${username} not found`);
          return done(new Error(`Username ${username} not found`), false);
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

/**
 * Deserialize the user
 * @param id User identifier
 * @param done Callback
 * @returns Promise deserialize
 */
function deserializeUser(id, done) {
  return database
    .query('SELECT * FROM account WHERE id = $1', [id])
    .then(data => done(null, data.rows[0] || false))
    .catch(error => {
      logger.warn(`Can't deserialize user ${id}: ${error}`);
      done(error, false);
    });
}

/**
 * Serialize the user
 * @param user User data
 * @param done Callback
 * @returns The executed callback
 */
function serializeUser(user, done) {
  return done(null, user.id);
}

passport.serializeUser(serializeUser);
passport.deserializeUser(deserializeUser);
passport.use(getStrategy());
