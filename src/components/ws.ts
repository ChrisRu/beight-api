import http from 'http';
import ws from 'ws';
import uuid from 'uuid';
import logger from '../services/logger';
import app from './app';
import Store from '../services/store';

export interface message {
  type: string;
  socketOrigin: string;
  stream?: number;
  streams?: number[];
  changes?: any;
}

export interface socket {
  id: string;
  isAlive: boolean;
  on: (type: string, callback: (message: string) => any) => void;
  send: (value: string) => void;
  terminate: () => void;
  ping: (data: any, mask: boolean, failSilently: boolean) => void;
}

export class WebSocket {
  store: Store;
  server: http.Server;
  wss: ws.Server;
  port: string | number;

  constructor() {
    this.store = new Store();
    this.port = process.env.WEBSOCKET_PORT || 8081;

    this.server = http.createServer(app.callback());
    this.wss = new ws.Server({ server: this.server });

    this.wss.on('connection', (socket: socket) => {
      socket.id = uuid.v4();
      socket.isAlive = true;

      logger.info('ws', `User ${socket.id} connected`);

      socket.on('message', (message: string) => {
        const data: message = {
          ...JSON.parse(message),
          socketOrigin: socket.id
        };

        switch (data.type) {
          case 'refetch':
            this.sendValue(data.stream, socket, null);
            break;
          case 'info':
            this.store.addConnection(socket.id, data.streams);
            this.sendStreamsValues(data.streams, socket);
            break;
          case 'update':
            this.updateStreamValue(socket.id, data);
            break;
          default:
            logger.warn('ws', `User ${socket.id} sent message with unknown type ${data.type}`);
            break;
        }
      });

      socket.on('pong', () => {
        socket.isAlive = true;
      });
    });

    this.wss.on('close', (socket: socket) => {
      this.store.removeConnection(socket.id);
      logger.info('ws', `User ${socket.id} disconnected`);
    });

    this.server.listen(this.port, () => {
      Array(5).fill(0).forEach((item, index) => {
        this.store.createStream(index);
      });

      const interval = setInterval(() => {
        this.wss.clients.forEach(socket => {
          if (socket.isAlive === false) {
            this.store.removeConnection(socket.id);
            logger.warn('ws', `Lost connection to user ${socket.id}`);
            return socket.terminate();
          }
          socket.isAlive = false;
          socket.ping('', false, true);
        });
      }, 30000);

      logger.info('ws', `Started on ws://localhost:${this.port}`);
    });
  }

  /**
   * Send the full value of multiple streams to the socket
   * @param streams Stream identifiers
   * @param socket Socket target
   */
  sendStreamsValues (streams: number[], socket: socket): void {
    this.store.streamIdentifiers.forEach(stream => {
      if (streams.includes(stream)) {
        this.sendValue(stream, socket, null);
      }
    });
  }

  /**
   * Send the full value to the socket
   * @param stream Stream identifier
   * @param socket Socket target
   */
  sendValue(stream: number, socket: socket, value?: any): void {
    let message = value;
    if (!message) {
      message = {
        fullValue: this.store.streams[stream].value,
        changeId: this.store.nextId(stream)
      };
    }

    if (this.store.streams[stream]) {
      socket.send(JSON.stringify(message));
    }
  }

  /**
   * Update the value of the stream and broadcast the change
   * @param id Connection identifier
   * @param message Edit object
   */
  updateStreamValue(id: string, message: message): void {
    if (!this.store.streams[message.stream]) {
      return;
    }

    const item: message = this.store.addChange(message.stream, {
      ...message
    });

    this.wss.clients.forEach((socket: socket) => {
      const streams: number[] = this.store.connections[socket.id] || [];
      if (streams.includes(message.stream) && socket.id !== item.socketOrigin) {
        this.sendValue(message.stream, socket, item);
        logger.info('ws', `Sent stream ${message.stream} value from ${id} to ${item.socketOrigin}`);
      }
    });
  }
}

export default new WebSocket();
