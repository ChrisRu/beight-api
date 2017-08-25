import * as http from 'http';
import * as ws from 'ws';
import * as uuid from 'uuid';
import Logger from '@/services/logger';
import app from '@/components/app';
import Store from '@/components/store';

export interface message {
  type: string;
  socketOrigin: string;
  stream?: string;
  streams?: string[];
  changes?: any;
}

export class WebSocketServer {
  store: Store;
  server: http.Server;
  wss: ws.Server;
  port: string | number;
  logger: Logger;

  constructor() {
    this.store = new Store();
    this.port = process.env.WEBSOCKET_PORT;
    this.logger = new Logger('websocket');

    this.server = http.createServer(app.callback());
    this.wss = new ws.Server({ server: this.server });

    this.wss.on('connection', socket => {
      socket.id = uuid.v4();
      socket.isAlive = true;

      this.logger.info(`User ${socket.id} connected`);

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
            this.logger.warn(`User ${socket.id} sent message with unknown type ${data.type}`);
            break;
        }
      });

      socket.on('close', () => {
        this.store.removeConnection(socket.id);
        this.logger.info(`User ${socket.id} disconnected`);
      });

      socket.on('pong', () => {
        socket.isAlive = true;
      });
    });

    this.server.listen(this.port, () => {
      const interval = setInterval(() => {
        this.wss.clients.forEach(socket => {
          if (socket.isAlive === false) {
            this.store.removeConnection(socket.id);
            this.logger.warn(`Lost connection to user ${socket.id}`);
            return socket.terminate();
          }
          socket.isAlive = false;
          socket.ping('', false, true);
        });
      }, 30000);

      this.logger.info(`Started on ws://localhost:${this.port}`);
    });
  }

  /**
   * Send the full value of multiple streams to the socket
   * @param streams Stream identifiers
   * @param socket Socket target
   */
  sendStreamsValues(streams: string[], socket): void {
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
  sendValue(stream: string, socket, value?: any): void {
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

    this.wss.clients.forEach(socket => {
      const streams: string[] = this.store.connections[socket.id] || [];
      if (streams.includes(message.stream) && socket.id !== item.socketOrigin) {
        this.sendValue(message.stream, socket, item);
        this.logger.info(`Sent stream ${message.stream} value from ${id} to ${item.socketOrigin}`);
      }
    });
  }
}

export default new WebSocketServer();
