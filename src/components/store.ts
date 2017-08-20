import logger from '@/services/logger';
import Database from '@/services/database';
import { message } from '@/components/ws';
import { parseEdit, getCharacters } from '@/services/util';

export interface stream {
  changes: message[];
  value: string;
}

export default class Store {
  streams: { [id: number]: stream };
  connections: { [id: string]: number[] };
  database: Database;

  constructor() {
    this.streams = {};
    this.connections = {};

    this.database = new Database('streams');
    this.database.connect();
    this.database.query('SELECT * FROM streams').then(streams => {
      streams.rows.forEach(stream => {
        this.streams[stream.id] = {
          changes: [],
          value: stream.value
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
  addConnection(id: string, items: number[]): number[] {
    this.connections[id] = items.filter(item => this.streams[item]);
    logger.info('store', `User ${id} subscribed to streams: ${this.connections[id].join(', ')}`);
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
  setValue(stream: number, value: string): string {
    if (this.streams[stream]) {
      this.streams[stream].value = value;
      this.logStreamValue(stream);
      this.database.query('UPDATE streams SET value = $1 WHERE id = $2', [value, stream]);
      return value;
    }
  }

  /**
   * Add a change to a stream
   * @param stream Stream identifier
   * @param item Change object
   * @returns Change object
   */
  addChange(stream: number, item: message): message {
    if (this.streams[stream]) {
      this.streams[stream].changes.push(item);
      this.setValue(item.stream, parseEdit(this.streams[item.stream].value, item.changes));
      return item;
    }
  }

  /**
   * Create a new stream
   * @returns Stream identifier
   */
  async createStream(): Promise<number> {
    const answer = await this.database.query(`INSERT INTO streams(value) VALUES('') RETURNING id`);
    const { id } = answer.rows[0];
    this.streams[id] = {
      changes: [],
      value: ''
    };
    logger.info('store', `Stream ${id} created`);
    return id;
  }

  /**
   * Get the next change identifier
   * @param stream Stream identifier
   * @returns Change identifier
   */
  nextId(stream: number): number {
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
  get streamIdentifiers(): number[] {
    return Object.keys(this.streams).map(key => parseInt(key, 10));
  }

  /**
   * Log the new stream value
   * @param stream Stream identifier
   */
  private logStreamValue(stream: number): void {
    logger.info(
      'store',
      `Stream ${stream} updated to value:
      ${getCharacters(12)}${this.streams[stream].value}`
    );
  }
}
