import * as chalk from 'chalk';

export class Logger {
  title: string;

  constructor(type) {
    this.title = Logger.chalkTitle(type);
  }

  /**
   * Show an info log
   * @param message Log message
   */
  info(message: string): void {
    this.log(message, 'info');
  }

  /**
   * Show an info log
   * @param title Log title
   * @param message Log message
   */
  static info(title: string, message: string): void {
    Logger.log(title, message, 'info');
  }

  /**
   * Show a warning log
   * @param message Log message
   */
  warn(message: string): void {
    this.log(message, 'warn');
  }

  /**
   * Show a warning log
   * @param title Log title
   * @param message Log message
   */
  static warn(title: string, message: string): void {
    Logger.log(title, message, 'warn');
  }

  /**
   * Show an error log
   * @param message Log message
   */
  error(message: string): void {
    this.log(message, 'error');
  }

  /**
   * Show an error log
   * @param title Log title
   * @param message Log message
   */
  static error(title: string, message: string): void {
    Logger.log(title, message, 'error');
  }

  /**
   * Print the message
   * @param message Message of the log
   * @param type Type of the log
   */
  private log(message: string, type = 'info'): void {
    // eslint-disable-next-line no-console
    console.log(
      `${Logger.getTime()} [${this.title}] ${Logger.chalkMessage(
        type,
        message
      )}`
    );
  }

  /**
   * Print the message
   * @param title Title of the log
   * @param message Message of the log
   * @param type Type of the log
   */
  private static log(title: string, message: string, type = 'info'): void {
    // eslint-disable-next-line no-console
    console.log(
      `${this.getTime()} [${Logger.chalkTitle(title)}] ${this.chalkMessage(
        type,
        message
      )}`
    );
  }

  /**
   * Get the color by type of the log
   * @param type Type of log message
   * @returns Color name
   */
  private static getColorType(type: string): string {
    switch (type) {
      case 'warn':
        return 'yellow';
      case 'error':
        return 'red';
      default:
        return 'white';
    }
  }

  /**
   * Get the color by title of the log message
   * @param title Origin of log message
   * @returns Color name
   */
  private static getColorTitle(title: string): string {
    switch (title) {
      case 'websocket':
        return 'red';
      case 'router':
        return 'yellow';
      case 'server':
        return 'green';
      case 'store':
        return 'blue';
      case 'database':
        return 'magenta';
      case 'auth':
        return 'cyan';
      default:
        return 'white';
    }
  }

  /**
   * Get the current time
   * @returns Time in HH:MM:SS format
   */
  private static getTime(): string {
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    return chalk.gray(new Date().toLocaleString('en-GB', options));
  }

  /**
   * Add color to the title
   * @param title Title of the log
   * @returns Title with color
   */
  private static chalkTitle(title: string): string {
    const coloredTitle = Logger.getColorTitle(title);
    return chalk[coloredTitle](title);
  }

  /**
   * Add color to the message
   * @param type Type of the log
   * @param message Message of the log
   * @returns Message with color
   */
  private static chalkMessage(type: string, message: string): string {
    const coloredType = Logger.getColorType(type);
    return chalk[coloredType](message);
  }
}

export default Logger;
