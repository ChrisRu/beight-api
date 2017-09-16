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
  player: number;
}

export interface Connection {
  id: string;
  game: string;
  streams: number[];
}

export class Store {
  games: {
    [gameGuid: string]: {
      guid: string;
      owner: number;
      streams: {
        [streamId: number]: Stream;
      };
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

    const query = `
      SELECT stream.id, stream.language, stream.active, stream.value, stream.player, game.guid, game.account as owner
      FROM stream
      JOIN game
      ON stream.game = game.id
    `;
    return database
      .query(query)
      .then(streams => {
        if (streams.rows[0]) {
          this.streamCount[streams.rows[0].guid] = streams.rows.length;
        }

        return streams.rows.map(async stream => {
          if (!Object.prototype.hasOwnProperty.call(this.games, stream.guid)) {
            this.games[stream.guid] = {
              guid: stream.guid,
              owner: stream.owner,
              streams: {}
            };
          }

          let player = null;
          if (stream.player != null) {
            player = await database.findUser(stream.player).catch(() => null);
          }

          const newStream: Stream = {
            lastChange: null,
            changeCount: 0,
            value: stream.value,
            active: stream.active,
            language: stream.language,
            game: stream.guid,
            id: stream.id,
            player
          };

          this.games[stream.guid].streams[stream.id] = newStream;
          return newStream;
        });
      })
      .catch(error => {
        this.logger.error(`Can't fetch games and streams: ${error}`);
      });
  }

  /**
   * Check if game or game and stream exist
   * @param game Game identifier
   * @param stream Stream identifier
   * @returns If game or game and stream exist
   */
  streamExists(game: string, stream?: number) {
    return !!(
      game &&
      this.games[game] &&
      (stream ? this.games[game].streams[stream] : true)
    );
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
    if (this.streamExists(game, stream)) {
      this.games[game].streams[stream].value = value;
      this.logStreamValue(stream);

      const query = `
        UPDATE stream
        SET value = $1
        WHERE id = $2 AND game in (SELECT id FROM game WHERE guid = $3)
      `;
      database.query(query, [value, stream, game]).catch(error => {
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
    if (this.streamExists(game, stream)) {
      this.games[game].streams[stream].lastChange = item;
      this.games[game].streams[stream].changeCount++;
      this.setValue(
        game,
        stream,
        parseEdit(this.games[game].streams[stream].value, item.change.changes)
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
  getGames(): Promise<object[]> {
    return Promise.all(
      Object.values(this.games).map(({ guid }) => this.getGame(guid))
    );
  }

  /**
   * Get game by guid
   * @param guid Game guid
   * @returns Game
   */
  getGame(guid: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!guid) {
        this.logger.error(`GUID ${guid} is not valid`);
        reject(`GUID ${guid} is not valid`);
      }

      if (!this.games[guid]) {
        this.logger.error(`GUID ${guid} not found`);
        reject(`GUID ${guid} not found`);
      }

      resolve({
        guid,
        streams: {
          ...Object.values(this.games[guid].streams).map((stream: Stream) => ({
            ...stream,
            language: getLanguage(stream.language)
          }))
        }
      });
    });
  }

  /**
   * Get owner of game by guid
   * @param game Game identifier
   * @returns Owner identifier
   */
  getGameOwner(game: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.streamExists(game)) {
        resolve(this.games[game].owner);
      }
      reject(`Game ${game} not found`);
    });
  }

  /**
   * Get games by owner
   * @param owner User identifier
   * @returns Games
   */
  async getGamesByOwner(owner: number): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!owner) {
        this.logger.error(`Owner ${owner} is not valid`);
        reject(`Owner ${owner} is not valid`);
      }

      const games = Object.values(this.games).filter(
        game => game.owner === owner
      );

      resolve(Promise.all(games.map(({ guid }) => this.getGame(guid))));
    });
  }

  /**
   * Edit existing game
   * @param game Game identifier
   * @param newData New data
   */
  async editGame(game: string, newData) {
    const { streams } = newData;
    Object.values(streams).forEach(async stream => {
      if (stream.id && this.streamExists(game, stream.id)) {
        const player = await database
          .findUser(stream.playerName)
          .catch(error => {
            this.logger.error(`Can't find user ${stream.player}: ${error}`);
          });
        this.games[game].streams[stream.id].player = player;

        const query = `
          WITH game AS (
            SELECT id FROM game WHERE guid = $1
          )
          UPDATE stream
          SET
            player = $3
          FROM game
          WHERE stream.game = game.id AND stream.id = $2
        `;
        await database
          .query(query, [game, stream.id, player.id])
          .then(() => {
            this.logger.info(
              `Updated player ${stream.playerName} for game ${game} on stream ${stream.id}`
            );
          })
          .catch(error => {
            this.logger.error(`Can't update stream info: ${error}`);
          });
      } else {
        this.logger.warn(
          'Failed editing game: player, stream id, or game and/or stream does not exist'
        );
      }
    });
  }

  /**
   * Create a new game
   * @param user User identifier
   * @param values Stream create data
   * @returns All new streams
   */
  async createGame(user: number, values: any[]): Promise<void | Stream[]> {
    const guid = await database.getUnusedGuid();

    const query =
      'INSERT INTO game(guid, account) VALUES($1, $2) RETURNING id, guid';
    const answer = await database
      .query(query, [guid, user])
      .then(data => {
        this.logger.info(`Game ${data.rows[0].guid} created`);
        return data;
      })
      .catch(error => {
        this.logger.error(`Can't create game: ${error}`);
        throw new Error(`Can't create game: ${error}`);
      });

    this.streamCount[guid] = 0;
    this.games[guid] = {
      guid,
      owner: user,
      streams: {}
    };

    const streams = values.map(value =>
      this.createStream(
        answer.rows[0].id,
        guid,
        getLanguage(value.name).id,
        value.active,
        user,
        value.content
      )
    );

    return Promise.all(streams)
      .then(data => {
        this.logger.info(
          `Successfully created game ${guid} with ${data.length} streams`
        );
        this.streamCount[guid] = data.length;
        return data;
      })
      .catch(async error => {
        const query = 'DELETE FROM game WHERE id = $1';
        await database.query(query, [answer.rows[0].id]).catch(error => {
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
   * @param player User identifier
   * @param value Initial stream value
   * @returns Stream identifier
   */
  async createStream(
    gameId: number,
    gameGuid: string,
    language: number,
    active: boolean,
    player: number,
    value: string
  ): Promise<Stream> {
    this.streamCount[gameGuid]++;

    const query = `
      INSERT INTO
        stream(id, game, language, active, value)
        VALUES($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const answer = await database
      .query(query, [
        this.streamCount[gameGuid],
        gameId,
        language,
        active,
        value
      ])
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
      player,
      game: gameGuid
    };
    this.games[gameGuid].streams[id] = stream;
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

    const query = `
      INSERT INTO
        account(username, password)
        VALUES ($1, $2)
    `;

    return database.query(query, [username, hashedPassword]).catch(error => {
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
    if (this.games[game] && this.games[game].streams[stream]) {
      return this.games[game].streams[stream].changeCount + 1;
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
        Object.keys(game.streams).map(
          stream => `${game.streams[stream].game}_${game.streams[stream].id}`
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
