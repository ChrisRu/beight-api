import * as bcrypt from 'bcrypt';
import Logger from '@/services/logger';
import database from '@/components/database';
import { Message } from '@/components/ws';
import { parseEdit } from '@/services/util';
import globals from '@/services/globals';

export interface Stream {
  changes: Message[];
  value: string;
  language: number;
  active: boolean;
  game: string;
  id: number;
}

export class Store {
  games: {
    [gameGuid: string]: {
      [streamId: number]: Stream;
    };
  };
  connections: {
    connectionId: string;
    game: string;
    streams: number[];
  }[];
  logger: Logger;
  streamCount: { [id: number]: number };

  constructor() {
    this.games = {};
    this.connections = [];
    this.logger = new Logger('store');
    this.streamCount = {};

    this.connect();
  }

  /**
   * Connect to the database and fetch games + streams
   */
  async connect() {
    await database.connect();
    return database
      .query(
        `
        SELECT stream.id, stream.language, stream.active, stream.value, game.guid
        FROM stream
        JOIN game
        ON stream.game = game.id
      `
      )
      .then(streams => {
        streams.rows.forEach(stream => {
          if (this.games.hasOwnProperty(stream.guid) === false) {
            this.games[stream.guid] = {};
          }
          this.games[stream.guid][stream.id] = {
            changes: [],
            value: stream.value,
            active: stream.active,
            language: stream.language,
            game: stream.guid,
            id: stream.id
          };
        });
        if (streams.rows.length > 0) {
          this.streamCount[streams.rows[0].guid] = streams.rows.length;
        }
        return streams;
      });
  }

  /**
   * Add a connection with streams
   * @param id Connecton identifier
   * @param game Game identifier
   * @param items Streams to listen to
   * @returns Streams to listen to
   */
  addConnection(id: string, game: string, items: any[]): number[] {
    const streams = items.map(item => item.id);
    this.connections.push({
      connectionId: id,
      game,
      streams
    });
    this.logger.info(`User ${id} subscribed on game ${game} to streams: ${streams.join(', ')}`);
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
   * @param game Game identifier
   * @param stream Stream identifier
   * @param value Stream value
   * @returns Stream value
   */
  setValue(game: string, stream: number, value: string): string {
    if (this.games[game][stream]) {
      this.games[game][stream].value = value;
      this.logStreamValue(stream);
      database.query('UPDATE stream SET value = $1 WHERE id = $2 AND game in (SELECT id FROM game WHERE guid = $3)', [
        value,
        stream,
        game
      ]);
      return value;
    }
  }

  /**
   * Add a change to a stream
   * @param game Game identifier
   * @param stream Stream identifier
   * @param item Change object
   * @returns Change object
   */
  addChange(game: string, stream: number, item: Message): Message {
    if (this.games[game][stream]) {
      this.games[game][stream].changes.push(item);
      this.setValue(game, stream, parseEdit(this.games[game][stream].value, item.changes));
      return item;
    }
  }

  /**
   * Create a new game
   * @param values Stream create data
   */
  async createGame(values): Promise<Stream[]> {
    const guid: string = await database.getUnusedGuid();
    const answer = await database.query(`INSERT INTO game(guid) VALUES($1) RETURNING id, guid`, [guid]);
    const { id } = answer.rows[0];
    this.streamCount[guid] = 0;
    this.games[guid] = {};

    const streams: Stream[] = values.map(value =>
      this.createStream(id, guid, value.language, value.active, value.content)
    );
    return Promise.all(streams).then(data => {
      this.logger.info(`Created game ${guid}`);
      this.streamCount[data[0].game] = data.length;
      return data;
    });
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
  ): Promise<Stream> {
    this.streamCount[gameGuid]++;
    const streamId = this.streamCount[gameGuid];

    const answer = await database.query(
      `
      INSERT INTO
        stream(id, game, language, active, value)
        VALUES($1, $2, $3, $4, $5)
      RETURNING id
    `,
      [streamId, gameId, language, active, value]
    );

    const { id } = answer.rows[0];

    this.logger.info(`Stream ${id} for game ${gameGuid} created`);

    const stream: Stream = {
      changes: [],
      value,
      language,
      active,
      id,
      game: gameGuid
    };
    this.games[gameGuid][id] = stream;
    return stream;
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
   * @param game Game identifier
   * @param stream Stream identifier
   * @returns Change identifier
   */
  nextId(game: string, stream: number): number {
    if (this.games[game][stream].changes) {
      return this.games[game][stream].changes.length + 1;
    } else {
      return 0;
    }
  }

  /**
   * Get all stream identifiers
   * @returns Stream identifiers
   */
  get streamIdentifiers(): string[] {
    return [].concat(
      Object.keys(this.games).map(game => {
        return Object.keys(this.games[game]).map(stream => {
          return this.games[game][stream].game + '_' + this.games[game][stream].id;
        });
      })
    );
  }

  /**
   * Log the new stream value
   * @param stream Stream identifier
   */
  private logStreamValue(stream: number): void {
    this.logger.info(`Stream ${stream} updated value`);
  }
}

export default new Store();
