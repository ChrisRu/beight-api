import * as passport from 'koa-passport';
import { Strategy } from 'passport-local';
import Logger from '@/services/logger';
import database from '@/components/database';
import * as bcrypt from 'bcrypt';

function getStrategy() {
  return new Strategy(async (username, password, done) => {
    return database
      .query('SELECT * FROM account WHERE username = $1', [username])
      .then(async data => {
        if (data.rows.length === 0) {
          throw new Error('Username not found');
        } else {
          const success = await bcrypt.compare(password, data.rows[0].password);
          if (success) {
            return data.rows[0];
          } else {
            throw new Error('Incorrect password');
          }
        }
      })
      .then((user) => {
        Logger.info('auth', `Logged in user: ${user.username}`);
        return done(null, user);
      })
      .catch(error => {
        Logger.warn('auth', `Can't login user: ${error}`);
        return done(null, false);
      });
  });
}

function deserializeUser(id, done) {
  return database
    .query('SELECT * FROM account WHERE id = $1', [id])
    .then(user => done(null, user))
    .catch(error => done(error, null));
}

function serializeUser(user, done) {
  return done(null, user.id);
}

passport.serializeUser(serializeUser);
passport.deserializeUser(deserializeUser);
passport.use(getStrategy());
