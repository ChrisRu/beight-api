import * as bcrypt from 'bcrypt';
import database from '@/components/database';
import { Message } from '@/components/ws';
import { parseEdit } from '@/services/util';
import { getLanguage } from '@/services/globals';
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
   * @returns All streams
   */
  async connect(): Promise<Stream[]> {
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
        if (streams.rows[0]) {
          this.streamCount[streams.rows[0].guid] = streams.rows.length;
        }

        return streams.rows.map(stream => {
          if (!Object.prototype.hasOwnProperty.call(this.games, stream.guid)) {
            this.games[stream.guid] = {};
          }

          const game: Stream = {
            lastChange: null,
            changeCount: 0,
            value: stream.value,
            active: stream.active,
            language: stream.language,
            game: stream.guid,
            id: stream.id
          };

          this.games[stream.guid][stream.id] = game;
          return game;
        });
      })
      .catch(error => {
        this.logger.error(`Can't fetch games and streams: ${error}`);
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
    this.connections.push({ id, game, streams });
    this.logger.info(
      `User ${id} subscribed on game ${game} to streams: ${streams.join(', ')}`
    );
    return streams;
  }

  /**
   * Remove a connection
   * @param id Connection identifier
   * @returns Connection identifier
   */
  removeConnection(id: string): string {
    const index = this.connections.findIndex(
      connection => connection.id === id
    );
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
      database
        .query(
          'UPDATE stream SET value = $1 WHERE id = $2 AND game in (SELECT id FROM game WHERE guid = $3)',
          [value, stream, game]
        )
        .catch(error => {
          this.logger.error(`Can't update strema value: ${error}`);
        });
    }
    return value;
  }

  /**
   * Add a change to a stream
   * @param game Game identifier
   * @param stream Stream identifier
   * @param item Change object
   * @returns Change object
   */
  addChange(game: string, stream: number, item: Message): Message {
    if (this.games[game] && this.games[game][stream]) {
      this.games[game][stream].lastChange = item;
      this.games[game][stream].changeCount++;
      this.setValue(
        game,
        stream,
        parseEdit(this.games[game][stream].value, item.change.changes)
      );
    } else {
      this.logger.warn(
        `Can't add change game ${game} stream ${stream} is undefined`
      );
    }
    return item;
  }

  /**
   * Get all active games sorted by date
   * @returns All games sorted by date
   */
  getGames(): Promise<void | object[]> {
    const gameQuery = 'SELECT id, guid FROM game ORDER BY date';
    const streamQuery =
      'SELECT id, language, active, value FROM stream WHERE game = $1';

    return database
      .query(gameQuery)
      .then(data =>
        Promise.all(
          data.rows.map(async game => ({
            guid: game.guid,
            streams: (await database.query(streamQuery, [
              game.id
            ])).rows.map(item => ({
              ...item,
              language: getLanguage(item.language)
            }))
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
   * @returns Game
   */
  getGame(guid): Promise<void | object[]> {
    if (!guid) {
      this.logger.error(`GUID '${guid}' is not valid`);
      return Promise.reject(`GUID '${guid}' is not valid`);
    }

    const streamQuery =
      'SELECT id, language, active, value FROM stream WHERE game in (SELECT id FROM game WHERE guid = $1) ORDER BY id';

    return database.query(streamQuery, [guid]).then(data =>
      data.rows.map(item => ({
        ...item,
        language: getLanguage(item.language)
      }))
    );
  }

  /**
   * Create a new game
   * @param values Stream create data
   * @returns All new streams
   */
  async createGame(values): Promise<void | Stream[]> {
    const guid = await database.getUnusedGuid();
    const answer = await database
      .query('INSERT INTO game(guid) VALUES($1) RETURNING id, guid', [guid])
      .then(data => {
        this.logger.info(`Game ${data.rows[0].guid} created`);
        return data;
      })
      .catch(error => {
        this.logger.error(`Can't create game: ${error}`);
        throw new Error(`Can't create game: ${error}`);
      });

    this.streamCount[guid] = 0;
    this.games[guid] = {};

    const streams: Stream[] = values.map(value =>
      this.createStream(
        answer.rows[0].id,
        guid,
        getLanguage(value.name).id,
        value.active,
        value.content
      )
    );

    return Promise.all(streams)
      .then(data => {
        this.logger.info(`Successfully created game ${guid} with ${data.length} streams`);
        this.streamCount[guid] = data.length;
        return data;
      })
      .catch(async error => {
        await database
          .query('DELETE FROM game WHERE id = $1', [answer.rows[0].id])
          .catch(error => {
            this.logger.error(
              `Can't delete game after stream create failure: ${error}`
            );
          });

        throw error;
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

    const answer = await database
      .query(
        `
      INSERT INTO
        stream(id, game, language, active, value)
        VALUES($1, $2, $3, $4, $5)
      RETURNING id
    `,
        [this.streamCount[gameGuid], gameId, language, active, value]
      )
      .catch(error => {
        this.logger.error(`Can't create stream: ${error}`);
        throw new Error(`Can't create stream: ${error}`);
      });

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
    if (this.games[game] && this.games[game][stream]) {
      return this.games[game][stream].changeCount + 1;
    }
    return 0;
  }

  /**
   * Get all stream identifiers
   * @returns Stream identifiers
   */
  get streamIdentifiers(): string[] {
    return [].concat(
      ...Object.values(this.games).map(game =>
        Object.keys(game).map(
          stream => `${game[stream].game}_${game[stream].id}`
        )
      )
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
