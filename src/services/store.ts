import logger from './logger';
import { message } from '../components/ws';
import { parseEdit, getCharacters } from './util';

export interface stream {
  changes: message[];
  value: string;
}

export default class Store {
  streams: { [id: number]: stream };
  connections: { [id: string]: number[] };

  constructor() {
    this.streams = {};
    this.connections = {};
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
      console.log(this.streams[item.stream]);
      this.setValue(item.stream, parseEdit(this.streams[item.stream].value, item.changes));
      return item;
    }
  }

  /**
   * Create a new stream if it doesn't exist yet
   * @param stream Stream identifier
   * @returns Stream
   */
  createStream(stream: number): stream {
    if (this.streams[stream] === undefined) {
      this.streams[stream] = {
        changes: [],
        value: ''
      };
      logger.info('store', `Stream ${stream} created`);
    }
    return this.streams[stream];
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
