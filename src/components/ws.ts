import * as http from 'http';
import * as ws from 'ws';
import * as uuid from 'uuid';
import Logger from '@/services/logger';
import app from '@/components/app';
import store from '@/components/store';

export interface Message {
  type: string;
  socketOrigin: string;
  game?: string;
  stream?: number;
  streams?: number[];
  changes?: any;
}

export class WebSocketServer {
  server: http.Server;
  wss: ws.Server;
  port: string | number;
  logger: Logger;

  constructor() {
    this.port = process.env.WEBSOCKET_PORT;
    this.logger = new Logger('websocket');

    this.server = http.createServer(app.callback());
    this.wss = new ws.Server({ server: this.server });

    this.wss.on('connection', socket => {
      socket.id = uuid.v4();

      this.logger.info(`User ${socket.id} connected`);

      socket.on('message', (message: string) => {
        let parsedMessage;
        try {
          parsedMessage = JSON.parse(message);
        } catch (error) {
          this.logger.error(`Can't parse socket message from ${socket.id}`);
        }

        const data: Message = {
          ...parsedMessage,
          socketOrigin: socket.id
        };

        switch (data.type) {
          case 'refetch':
            this.sendValue(data.game, data.stream, socket, null);
            break;
          case 'info':
            store.addConnection(socket.id, data.game, data.streams);
            this.sendStreamsValues(data.game, data.streams, socket);
            break;
          case 'update':
            this.updateStreamValue(socket.id, data);
            break;
          default:
            this.logger.warn(`User ${socket.id} sent message with unknown type ${data.type.toString()}`);
            break;
        }
      });

      socket.on('close', () => {
        store.removeConnection(socket.id);
        this.logger.info(`User ${socket.id} disconnected`);
      });
    });

    this.server.listen(this.port, () => {
      const interval = setInterval(() => {
        this.wss.clients.forEach(socket => {
          try {
            socket.ping('', false, false);
          } catch (error) {
            store.removeConnection(socket.id);
            this.logger.warn(`Lost connection to user ${socket.id}`);
            return socket.terminate();
          }
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
  sendStreamsValues(game: string, streams: number[], socket): void {
    store.streamIdentifiers.forEach(stream => {
      if (streams.map(stream => `${game}_${stream}`).includes(stream)) {
        this.sendValue(stream, socket, null);
      }
    });
  }

  /**
   * Send the full value to the socket
   * @param game Game identifier
   * @param stream Stream identifier
   * @param socket Socket target
   */
  sendValue(game: string, stream: number, socket, value?: any): void {
    let message = value;
    if (!message && store.games[game][stream]) {
      message = {
        fullValue: store.games[game][stream].value,
        changeId: store.nextId(game, stream)
      };
    }

    if (store.games[game][stream]) {
      socket.send(JSON.stringify(message));
    }
  }

  /**
   * Update the value of the stream and broadcast the change
   * @param id Connection identifier
   * @param message Edit object
   */
  updateStreamValue(id: string, message: Message): void {
    if (!store.games[message.game][message.stream]) {
      return;
    }

    const item: Message = store.addChange(message.game, message.stream, {
      ...message
    });

    this.wss.clients.forEach(socket => {
      const streams: number[] = store.connections[socket.id] || [];
      if (streams.includes(message.stream) && socket.id !== item.socketOrigin) {
        this.sendValue(message.game, message.stream, socket, item);
        this.logger.info(`Sent stream ${message.stream} from game ${message.game} value from ${id} to ${item.socketOrigin}`);
      }
    });
  }
}

export default new WebSocketServer();
