import Logger from '@/services/logger';
import { Pool } from 'pg';

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
    return this.pool.connect(error => {
      if (error) {
        this.logger.error(`Can't connect to database: ${error}`);
        return;
      }

      this.connected = true;
      this.logger.info(`Connected to database on postgres://${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}`);

      return this.query(`SELECT to_regclass('games')`)
        .then(res => {
          if (res.rows[0].to_regclass === null) {
            return this.createTable();
          }
        })
        .catch(error => {
          return this.createTable();
        });
    });
  }

  query(query: string, data?: any[]): Promise<any> {
    return this.pool.query(query, data).catch(error => {
      this.logger.error(error);
    });
  }

  dropTable(table: string): Promise<any> {
    const query = 'DROP TABLE $1';
    return this.query(query, [table])
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
      streams(value)
      VALUES($1)
      WHERE game = $2
      AND id = $3
    `;

    return this.query(query, [value, game, stream])
      .catch(error => {
        this.logger.error(`Can't update value: ${error}`);
       });
  }

  createGame() : Promise<any> {
    const query = `
      CREATE TABLE games (
        id   serial    PRIMARY KEY,
        guid UUID      UNIQUE DEFAULT uuid_generate_v4(),
        date timestamp NOT NULL DEFAULT NOW(),
        name text,
        type smallint  NOT NULL
      )
    `;

    return this.query(query)
      .then(() => {
        this.logger.info(`Created table games`);
      })
      .catch(error => {
        this.logger.error(`Can't create table: error`);
      });
  }

  createTable(): Promise<any> {
    const query = `
      CREATE TABLE streams (
        id    serial    PRIMARY KEY,
        game  integer   NOT NULL REFERENCES games(id),
        value text      NOT NULL
      )
    `;

    return this.query(query)
      .then(() => {
        this.logger.info(`Created table streams`);
      })
      .catch(error => {
        this.logger.error(`Can't create table: ${error}`);
      });
  }
}

export default new Database();
