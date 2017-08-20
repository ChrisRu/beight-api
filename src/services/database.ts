import logger from '@/services/logger';
import { Pool } from 'pg';

export class Database {
  pool: Pool;
  connected: boolean;
  table: string;

  constructor(table: string) {
    this.connected = false;
    this.table = table;
    this.pool = new Pool({
      host: process.env.DATABASE_HOST,
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      port: parseInt(process.env.DATABASE_PORT, 10),
      max: 20,
      idleTimeoutMillis: 30000
    });
  }

  async connect(): Promise<any> {
    return this.pool.connect(error => {
      if (error) {
        logger.error('database', `Can't connect to database: ${error}`);
        return;
      }

      this.connected = true;
      logger.info('database', `Connected to database on postgres://${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}`);

      return this.query(`SELECT to_regclass('${this.table}')`)
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
      logger.error('database', error);
    });
  }

  dropTable(): Promise<any> {
    const query = 'DROP TABLE $1';
    return this.query(query, [this.table])
      .then(() => {
        logger.warn('database', `Dropped table ${this.table}`);
      })
      .catch(error => {
        logger.error('database', `Can't drop table: ${error}`);
      });
  }

  createTable(): Promise<any> {
    const query = `CREATE TABLE ${this.table} (
      id    serial PRIMARY KEY,
      guid  UUID   UNIQUE DEFAULT uuid_generate_v4(),
      value text   NOT NULL
    )`;

    return this.query(query)
      .then(() => {
        logger.info('database', `Created table ${this.table}`);
      })
      .catch(error => {
        logger.error('database', `Can't create table: ${error}`);
      });
  }
}

export default Database;
