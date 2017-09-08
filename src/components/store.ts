import * as bcrypt from 'bcrypt';
import database from '@/components/database';
import { Message } from '@/components/ws';
import { parseEdit } from '@/services/util';
import Logger from '@/services/logger';

export interface Stream {
  lastChange: Message;
  changeCount: number;
  value: string;
  language: number;
  active: boolean;
  game: string;
  id: number;
}

export interface Connection {
  id: string;
  game: string;
  streams: number[];
}

export class Store {
  games: {
    [gameGuid: string]: {
      [streamId: number]: Stream;
    };
  };
  connections: Connection[];
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
            lastChange: null,
            changeCount: 0,
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
   * @param streams Streams to listen to
   * @returns Streams to listen to
   */
  addConnection(id: string, game: string, streams: number[]): number[] {
    this.connections.push({
      id,
      game,
      streams
    });
    this.logger.info(`User ${id} subscribed on game ${game} to streams: ${streams.join(', ')}`);
    return streams;
  }

  /**
   * Remove a connection
   * @param id Connection identifier
   * @returns Connection identifier
   */
  removeConnection(id: string): string {
    const index = this.connections.findIndex(connection => connection.id === id);
    if (index > -1) {
      this.connections.splice(index, 1);
    }
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
      this.games[game][stream].lastChange = item;
      this.games[game][stream].changeCount++;
      this.setValue(game, stream, parseEdit(this.games[game][stream].value, item.change.changes));
    } else {
      this.logger.warn(`Can't add change game ${game} stream ${stream} is undefined`);
    }
    return item;
  }

  /**
   * Create a new game
   * @param values Stream create data
   */
  async createGame(values): Promise<Stream[]> {
    const guid = await database.getUnusedGuid();
    const answer = await database.query(`INSERT INTO game(guid) VALUES($1) RETURNING id, guid`, [guid]).catch(error => {
      this.logger.error(`Can't create game: ${error}`);
      throw new Error(`Can't create game: ${error}`);
    });

    const { id } = answer.rows[0];
    this.streamCount[guid] = 0;
    this.games[guid] = {};

    const streams: Stream[] = values.map(value =>
      this.createStream(id, guid, value.language, value.active, value.content)
    );

    return Promise.all(streams)
      .then(data => {
        this.logger.info(`Created game ${guid}`);
        this.streamCount[data[0].game] = data.length;
        return data;
      })
      .catch(error => {
        this.logger.error(`Can't create game: ${error}`);
        throw new Error(`Can't create game: ${error}`);
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
      lastChange: null,
      changeCount: 0,
      value,
      language,
      active,
      id,
      game: gameGuid
    };
    this.games[gameGuid][id] = stream;
    return stream;
  }

  async createUser(username: string, password: string): Promise<any> {
    if (!username || !password) {
      this.logger.error('Missing username or password');
      throw new Error('Missing username or password');
    }

    const hashedPassword = await bcrypt.hash(password, 10).catch(error => {
      this.logger.error(`Can't hash password: ${error}`);
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
        this.logger.error(`Can't create new user: ${error}`);
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
    return this.games[game][stream].changeCount + 1;
  }

  /**
   * Get all stream identifiers
   * @returns Stream identifiers
   */
  get streamIdentifiers(): string[] {
    return [].concat(
      Object.values(this.games).map(game => {
        return Object.keys(game).map(stream => {
          return game[stream].game + '_' + game[stream].id;
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
