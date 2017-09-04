import { Pool, QueryResult } from 'pg';
import { generateUrl, serialPromise } from '@/services/util';
import Logger from '@/services/logger';

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

  /**
   * Connect to database
   */
  async connect(): Promise<any> {
    return this.pool.connect(async error => {
      if (error) {
        this.logger.warn(`Can't connect to database: ${error}`);

        return new Promise(r => setTimeout(r, 3000)).then(() => {
          this.logger.info('Retrying to connect to database...');
          return this.connect();
        });
      } else {
        this.connected = true;
        this.logger.info(
          `Connected to database on postgres://${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}`
        );

        return this.createTables(['Game', 'Stream', 'Account']);
      }
    });
  }

  /**
   * Execute query to database
   * @param query Query to execute
   * @param data Query data
   */
  query(query: string, data?: any[]): Promise<any> {
    if (!query) {
      this.logger.error(`Query '${query}' is not valid`);
      return Promise.reject(`Query '${query}' is not valid`);
    }

    if (data && !Array.isArray(data)) {
      this.logger.warn(`Query data is not an array, converting`);
      data = [].concat(data);
    }

    return this.pool.query(query, data).catch(error => {
      this.logger.error(error);
    });
  }

  /**
   * Drop a table in the database
   * @param table Table name
   */
  dropTable(table: string): Promise<any> {
    if (!table) {
      this.logger.error(`Can't drop table: ${table}`);
      return Promise.reject(`Can't drop table: ${table}`);
    }

    const query = `DROP TABLE ${table}`;
    return this.query(query)
      .then(() => {
        this.logger.warn(`Dropped table ${table}`);
      })
      .catch(error => {
        this.logger.error(`Can't drop table: ${error}`);
      });
  }

  /**
   * Update value in the database
   * @param game Game identifier
   * @param stream Stream Identifier
   * @param value Stream value
   */
  updateValue(game: number, stream: number, value: string): Promise<any> {
    if (!game || !stream) {
      return Promise.reject('Game or stream not supplied');
    }

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

  /**
   * Create tables if they don't exist
   * @param tables Table names
   */
  async createTables(tables: string[]): Promise<Promise<any>[]> {
    const getPromise = (table: string) => (): Promise<any> => {
      if (!table) {
        this.logger.error(`Table '${table}' is not valid`);
        return Promise.reject(`Table '${table}' is not valid`);
      }

      return this.query(`SELECT to_regclass('${table.toLowerCase()}')`)
        .then(res => {
          if (res.rows[0].to_regclass === null) {
            return this[`create${table}Table`]();
          }
        })
        .catch(error => {
          this.logger.error(`Can't execute query: ${error}`);
        });
    };

    return serialPromise((tables || []).map(table => getPromise(table)));
  }

  /**
   * Create Account Table
   */
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

  /**
   * Create Game Table
   */
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

  /**
   * Create Stream Table
   */
  createStreamTable(): Promise<any> {
    const query = `
      CREATE TABLE stream (
        id        integer   NOT NULL,
        game      integer   NOT NULL REFERENCES game(id),
        language  integer   NOT NULL,
        active    boolean   NOT NULL DEFAULT FALSE,
        value     text      NOT NULL,

        PRIMARY KEY(id, game)
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

  /**
   * Get all active games sorted by date
   */
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

  /**
   * Get game by guid
   * @param guid Game guid
   */
  getGame(guid): Promise<void | object[]> {
    if (!guid) {
      this.logger.error(`GUID '${guid}' is not valid`);
      return Promise.reject(`GUID '${guid}' is not valid`);
    }

    const streamQuery =
      'SELECT id, language, active, value FROM stream WHERE game in (SELECT id FROM game WHERE guid = $1)';

    return this.query(streamQuery, [guid])
      .then(data => data.rows)
      .catch(error => {
        this.logger.error(`Can't get games ${error}`);
      });
  }

  /**
   * Get a new unused GUID
   */
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
