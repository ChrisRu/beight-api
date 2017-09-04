import * as http from 'http';
import * as ws from 'ws';
import * as uuid from 'uuid';
import Logger from '@/services/logger';
import app from '@/components/app';
import store, { Stream } from '@/components/store';

export interface Message {
  /**
   * Game GUID
   */
  g: string;
  /**
   * Stream numbers
   */
  s: number[];
  /**
   * Type of message
   */
  t?: string;
  /**
   * Id of message origin
   */
  o?: string;
  /**
   * Change
   */
  c?: any;
  /**
   * Change Number
   */
  n?: number;
  /**
   * Full value
   */
  f?: string;
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
    this.wss = new ws.Server({
      server: this.server,
      perMessageDeflate: true
    });

    this.wss.on('connection', socket => {
      socket.id = uuid.v4();

      this.logger.info(`User ${socket.id} connected`);

      socket.on('message', (message: string) => {
        let parsedMessage;
        try {
          parsedMessage = JSON.parse(message);
        } catch {
          this.logger.error(`Can't parse socket message from ${socket.id}`);
          return;
        }

        const data: Message = {
          ...parsedMessage,
          o: socket.id
        };

        if (data.t == null || data.g == null || data.s == null) {
          this.logger.warn('Not all data values supplied');
          return;
        }

        switch (data.t) {
          /**
           * Get a Refetch
           */
          case 'r':
            this.refetch(data.g, data.s[0], socket);
            break;
          /**
           * Get latest change
           */
          case 'l':
            this.sendValue(data.g, data.s[0], socket, store.games[data.g][data.s[0]].lastChange);
            break;
          /**
           * Send info about user and send full stream values
           */
          case 'i':
            store.addConnection(socket.id, data.g, data.s);
            this.sendStreamsValues(data.g, data.s, socket);
            break;
          /**
           * Send value update/change
           */
          case 'u':
            this.updateStreamValue(socket.id, data);
            break;
          default:
            this.logger.warn(`User ${socket.id} sent message with unknown type ${data.t.toString()}`);
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
    const streamStrings = streams.map((stream, index) => `${game}_${stream}`);
    store.streamIdentifiers.forEach(stream => {
      const index = streamStrings.indexOf(stream);
      if (index > -1) {
        this.refetch(game, streams[index], socket);
      }
    });
  }

  /**
   * Send the full value to the socket
   * @param game Game identifier
   * @param stream Stream identifier
   * @param socket Socket target
   */
  sendValue(game: string, stream: number, socket: any, value?: Message): void {
    if (!game || !stream) {
      this.logger.warn('Game or stream not supplied to send value');
      return;
    }

    if (!value) {
      this.logger.warn('No value supplied to send to socket');
      return;
    }

    if (!socket) {
      this.logger.warn('Socket not supplied to send value');
      return;
    }

    if (store.games[game][stream]) {
      try {
        socket.send(JSON.stringify(value, null, 0));
      } catch (error) {
        this.logger.warn(`Can't send message to socket ${socket.id}: ${error}`);
      }
    }
  }

  /**
   * Send full value to client
   * @param game Game GUID
   * @param stream Stream identifier
   * @param socket Socket to send to
   */
  refetch(game: string, stream: number, socket: any) {
    this.logger.info(`Sending value of game ${game} to stream ${stream} to user ${socket.id}`);
    this.sendValue(game, stream, socket, {
      f: store.games[game][stream].value,
      n: store.nextId(game, stream),
      s: [stream],
      g: game
    });
  }

  /**
   * Update the value of the stream and broadcast the change
   * @param id Connection identifier
   * @param message Edit object
   */
  updateStreamValue(id: string, message: Message): void {
    if (message.g == null || message.s == null || message.s[0] == null) {
      this.logger.warn('User did not supply game or stream identifier');
      return;
    }

    if (store.games[message.g] == null || store.games[message.g][message.s[0]] == null) {
      this.logger.warn('Game or stream does not exist');
      return;
    }

    const item: Message = store.addChange(message.g, message.s[0], {
      ...message,
      n: store.nextId(message.g, message.s[0])
    });

    this.wss.clients.forEach(socket => {
      const connection = store.connections.find(conn => conn.id === socket.id) || {
        id: null,
        streams: [],
        game: 'null'
      };
      const streams: number[] = connection.streams;

      console.log(socket.id === item.o ? 'same origin' : 'different origin');

      if (connection.game === message.g && streams.includes(message.s[0]) && socket.id !== item.o) {
        this.sendValue(message.g, message.s[0], socket, item);
        this.logger.info(`Sent stream ${message.s} from game ${message.g} value from ${item.o} to ${socket.id}`);
      }
    });
  }
}

export default new WebSocketServer();
