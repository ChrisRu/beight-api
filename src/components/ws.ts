import * as http from 'http';
import * as ws from 'ws';
import * as uuid from 'uuid';
import Logger from '@/services/logger';
import app from '@/components/app';
import store from '@/components/store';

export interface Message {
  game: string;
  streams: number[];
  type?: string;
  origin?: string;
  change?: any;
  number?: number;
  full?: string;
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
      perMessageDeflate: false
    });

    this.wss.on('connection', async socket => {
      socket.id = uuid.v4(); // eslint-disable-line no-param-reassign
      this.logger.info(`User ${socket.id} connected`);

      socket.on('message', (message: string) => {
        let parsedMessage;
        try {
          parsedMessage = JSON.parse(message);
        } catch (error) {
          this.logger.error(`Can't parse socket message from ${socket.id}`);
          return;
        }

        const data: Message = {
          ...parsedMessage,
          origin: socket.id
        };

        if (data.type == null || data.game == null || data.streams == null) {
          this.logger.warn('Not all data values supplied');
          return;
        }

        switch (data.type) {
          /**
           * Get a Refetch
           */
          case 'fetch':
            this.refetch(data.game, data.streams[0], socket);
            break;
          /**
           * Get latest change
           */
          case 'latest':
            this.sendValue(
              data.game,
              data.streams[0],
              socket,
              store.games[data.game].streams[data.streams[0]].lastChange
            );
            break;
          /**
           * Send info about user and send full stream values
           */
          case 'info':
            store.addConnection(socket.id, data.game, data.streams);
            this.sendStreamsValues(data.game, data.streams, socket);
            break;
          /**
           * Send value update/change
           */
          case 'change':
            this.updateStreamValue(socket.id, data);
            break;
          default:
            this.logger.warn(
              `User ${socket.id} sent message with unknown type ${data.type.toString()}`
            );
            break;
        }
      });

      socket.on('close', () => {
        store.removeConnection(socket.id);
        this.logger.info(`User ${socket.id} disconnected`);
      });
    });

    this.server.listen(this.port, () => {
      setInterval(() => {
        this.wss.clients.forEach(socket => {
          try {
            socket.ping('', false, false);
          } catch (error) {
            store.removeConnection(socket.id);
            this.logger.warn(`Lost connection to user ${socket.id}`);
            socket.terminate();
          }
        });
      }, 30000);

      this.logger.info(`Started on ws://localhost:${this.port}`);
    });
  }

  /**
   * Send the full value of multiple streams to the socket
   * @param game Game identifier
   * @param streams Stream identifiers
   * @param socket Socket target
   */
  sendStreamsValues(game: string, streams: number[], socket): void {
    const streamStrings = streams.map(stream => `${game}_${stream}`);
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
   * @param value Message to send to the socket
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

    if (store.games[game].streams[stream]) {
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
    this.logger.info(
      `Sending value of game ${game} to stream ${stream} to user ${socket.id}`
    );
    this.sendValue(game, stream, socket, {
      full: store.games[game].streams[stream].value,
      number: store.nextId(game, stream),
      streams: [stream],
      game
    });
  }

  /**
   * Update the value of the stream and broadcast the change
   * @param id Connection identifier
   * @param message Edit object
   */
  updateStreamValue(id: string, message: Message): void {
    if (
      message.game == null ||
      message.streams == null ||
      message.streams[0] == null
    ) {
      this.logger.warn('User did not supply game or stream identifier');
      return;
    }

    if (
      store.games[message.game] == null ||
      store.games[message.game].streams[message.streams[0]] == null
    ) {
      this.logger.warn('Game or stream does not exist');
      return;
    }

    const item: Message = store.addChange(message.game, message.streams[0], {
      ...message,
      number: store.nextId(message.game, message.streams[0])
    });

    this.wss.clients.forEach(socket => {
      let connection = store.connections.find(conn => conn.id === socket.id);

      if (connection === undefined) {
        connection = {
          id: null,
          streams: [],
          game: 'null'
        };
      }

      const streams: number[] = connection.streams;

      if (
        connection.game === message.game &&
        streams.includes(message.streams[0]) &&
        socket.id !== item.origin
      ) {
        this.sendValue(message.game, message.streams[0], socket, item);
        this.logger.info(
          `Sent stream ${message
            .streams[0]} from game ${message.game} value from ${item.origin} to ${socket.id}`
        );
      }
    });
  }
}

export default new WebSocketServer();
