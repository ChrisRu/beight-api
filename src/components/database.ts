import Logger from '@/services/logger';
import { Pool, QueryResult } from 'pg';
import { generateUrl } from '@/services/util';

export class Database {
  pool: Pool;
  connected: boolean;
  logger: Logger;

  constructor() {
    this.connected = false;
    this.pool = new Pool({
      host: process.env.DATABASE_HOST,
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      port: parseInt(process.env.DATABASE_PORT, 10),
      max: 20,
      idleTimeoutMillis: 30000
    });
    this.logger = new Logger('database');
  }

  async connect(): Promise<any> {
    return this.pool.connect(async error => {
      if (error) {
        this.logger.error(`Can't connect to database: ${error}`);
        setTimeout(this.connect, 3000);
        return;
      }

      this.connected = true;
      this.logger.info(`Connected to database on postgres://${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}`);

      await this.createTables(['Game', 'Stream', 'Account']);
    });
  }

  query(query: string, data?: any[]): Promise<any> {
    return this.pool.query(query, data).catch(error => {
      this.logger.error(error);
    });
  }

  dropTable(table: string): Promise<any> {
    const query = `DROP TABLE ${table}`;
    return this.query(query)
      .then(() => {
        this.logger.warn(`Dropped table ${table}`);
      })
      .catch(error => {
        this.logger.error(`Can't drop table: ${error}`);
      });
  }

  updateValue(game: number, stream: number, value: string): Promise<any> {
    const query = `
      INSERT INTO
        stream(value)
        VALUES($1)
        WHERE game = $2
        AND id = $3
    `;

    return this.query(query, [value, game, stream]).catch(error => {
      this.logger.error(`Can't update value: ${error}`);
    });
  }

  async createTables(tables: string[]): Promise<Promise<any>[]> {
    return Promise.all(
      tables.map(table =>
        this.query(`SELECT to_regclass('${table}')`)
          .then(res => {
            if (res.rows[0].to_regclass === null) {
              return this[`create${table}Table`]();
            }
          })
          .catch(error => {
            this.logger.error(`Can't execute query: ${error}`);
          })
      )
    );
  }

  createAccountTable(): Promise<any> {
    const query = `
      CREATE TABLE account (
        id        serial    PRIMARY KEY,
        username  text      UNIQUE NOT NULL,
        password  text      NOT NULL,
        date      timestamp NOT NULL DEFAULT NOW()
      )
    `;

    return this.query(query)
      .then(() => {
        this.logger.info(`Created table 'account' for users`);
      })
      .catch(error => {
        this.logger.error(`Can't create table: ${error}`);
      });
  }

  createGameTable(): Promise<any> {
    const query = `
      CREATE TABLE game (
        id   serial    PRIMARY KEY,
        guid text      UNIQUE NOT NULL,
        date timestamp NOT NULL DEFAULT NOW()
      )
    `;

    return this.query(query)
      .then(() => {
        this.logger.info(`Created table 'game' for games`);
      })
      .catch(error => {
        this.logger.error(`Can't create table: ${error}`);
      });
  }

  createStreamTable(): Promise<any> {
    const query = `
      CREATE TABLE stream (
        id        serial    PRIMARY KEY,
        game      integer   NOT NULL REFERENCES game(id),
        language  integer   NOT NULL,
        active    boolean   NOT NULL DEFAULT FALSE,
        value     text      NOT NULL
      )
    `;

    return this.query(query)
      .then(() => {
        this.logger.info(`Created table 'stream' for streams`);
      })
      .catch(error => {
        this.logger.error(`Can't create table: ${error}`);
      });
  }

  getGames(): Promise<void | object[]> {
    const gameQuery = 'SELECT id, guid FROM game ORDER BY date';
    const streamQuery = 'SELECT id, language, active, value FROM stream WHERE game = $1';

    return this.query(gameQuery)
      .then(data =>
        Promise.all(
          data.rows.map(async game => ({
            guid: game.guid,
            streams: (await this.query(streamQuery, [game.id])).rows
          }))
        )
      )
      .catch(error => {
        this.logger.error(`Can't get games ${error}`);
      });
  }

  getGame(guid): Promise<void | object[]> {
    const streamQuery =
      'SELECT id, language, active, value FROM stream WHERE game in (SELECT id FROM game WHERE guid = $1)';

    return this.query(streamQuery, [guid])
      .then(data => data.rows)
      .catch(error => {
        this.logger.error(`Can't get games ${error}`);
      });
  }

  async getUnusedGuid(): Promise<string> {
    const url = generateUrl(6);
    return this.query(`SELECT guid FROM game WHERE guid = $1`, [url]).then(data => {
      if (data.rows.length === 0) {
        return url;
      }
      return this.getUnusedGuid();
    });
  }
}

export default new Database();
