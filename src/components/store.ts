import * as bcrypt from 'bcrypt';
import Logger from '@/services/logger';
import database from '@/components/database';
import { Message } from '@/components/ws';
import { parseEdit } from '@/services/util';
import globals from '@/services/globals';

export interface stream {
  changes: Message[];
  value: string;
  language: number;
  active: boolean;
}

export class Store {
  streams: { [id: string]: stream };
  connections: { [id: string]: string[] };
  logger: Logger;

  constructor() {
    this.streams = {};
    this.connections = {};
    this.logger = new Logger('store');

    database.connect();
    database.query('SELECT * FROM stream').then(streams => {
      streams.rows.forEach(stream => {
        this.streams[stream.id] = {
          changes: [],
          value: stream.value,
          active: stream.active,
          language: stream.language
        };
      });
    });
  }

  /**
   * Add a connection with streams
   * @param id Connecton identifier
   * @param items Streams to listen to
   * @returns Streams to listen to
   */
  addConnection(id: string, items: string[]): string[] {
    this.connections[id] = items.filter(item => {
      return typeof item === 'string' && this.streams[item];
    });
    this.logger.info(`User ${id} subscribed to streams: ${this.connections[id].join(', ')}`);
    return this.connections[id];
  }

  /**
   * Remove a connection
   * @param id Connection identifier
   * @returns Connection identifier
   */
  removeConnection(id: string): string {
    delete this.connections[id];
    return id;
  }

  /**
   * Set a new stream value
   * @param stream Stream identifier
   * @param value Stream value
   * @returns Stream value
   */
  setValue(stream: string, value: string): string {
    if (this.streams[stream]) {
      this.streams[stream].value = value;
      this.logStreamValue(stream);
      database.query('UPDATE stream SET value = $1 WHERE guid = $2', [value, stream]);
      return value;
    }
  }

  /**
   * Add a change to a stream
   * @param stream Stream identifier
   * @param item Change object
   * @returns Change object
   */
  addChange(stream: string, item: Message): Message {
    if (this.streams[stream]) {
      this.streams[stream].changes.push(item);
      this.setValue(item.stream, parseEdit(this.streams[item.stream].value, item.changes));
      return item;
    }
  }

  /**
   * Create a new game
   * @param values Stream create data
   */
  async createGame(values): Promise<any> {
    const url = await database.getUnusedGuid();

    const answer = await database
      .query(`INSERT INTO game(guid) VALUES($1) RETURNING id, guid`, [url])
      .then(data => {
        this.logger.info(`Created game ${url}`);
        return data;
      })
      .catch(error => {
        this.logger.error(`Can't create game ${url}: ${error}`);
      });

    const { id, guid } = answer.rows[0];
    return Promise.all(values.map(value => this.createStream(id, guid, value.language, value.active, value.content)));
  }

  /**
   * Create a new stream
   * @param gameId Game identifier
   * @param gameGuid Game guid
   * @param language Language identifier
   * @param active Stream is being played
   * @param value Initial stream value
   * @returns Stream identifier
   */
  async createStream(
    gameId: number,
    gameGuid: string,
    language: number,
    active: boolean,
    value: string
  ): Promise<string> {
    const answer = await database.query(
      `
      INSERT INTO
        stream(game, language, active, value)
        VALUES($1, $2, $3, $4)
      RETURNING id
    `,
      [gameId, language, active, value]
    );

    const { id } = answer.rows[0];
    this.streams[id] = {
      changes: [],
      value,
      language,
      active
    };
    this.logger.info(`Stream ${id} for game ${gameGuid} created`);
    return gameGuid;
  }

  async createUser(username, password) {
    if (!username || !password) {
      throw new Error('Missing username or password');
    }

    const hashedPassword = await bcrypt.hash(password, 10).catch(error => {
      throw new Error(`Can't hash password: ${error}`);
    });

    return database
      .query(
        `
      INSERT INTO
        account(username, password)
        VALUES($1, $2)
    `,
        [username, hashedPassword]
      )
      .catch(error => {
        throw new Error(`Can't create new user: ${error}`);
      });
  }

  /**
   * Get the next change identifier
   * @param stream Stream identifier
   * @returns Change identifier
   */
  nextId(stream: string): number {
    if (this.streams[stream].value) {
      return this.streams[stream].value.length + 1;
    } else {
      return 0;
    }
  }

  /**
   * Get all stream identifiers
   * @returns Stream identifiers
   */
  get streamIdentifiers(): string[] {
    return Object.keys(this.streams).map(key => key);
  }

  /**
   * Log the new stream value
   * @param stream Stream identifier
   */
  private logStreamValue(stream: string): void {
    this.logger.info(`Stream ${stream} updated value`);
  }
}

export default new Store();
