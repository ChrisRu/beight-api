import chalk from 'chalk';

export class Logger {
  /**
   * Show an info log
   * @param title Origin of log message
   * @param message Log message
   */
  info(title: string, message: string): void {
    this.log(title, message, 'info');
  }

  /**
   * Show a warning log
   * @param title Origin of log message
   * @param message Log message
   */
  warn(title: string, message: string): void {
    this.log(title, message, 'warn');
  }

  /**
   * Show an error log
   * @param title Origin of log message
   * @param message Log message
   */
  error(title: string, message: string): void {
    this.log(title, message, 'error');
  }

  /**
   * Print the message
   * @param title Title of the log
   * @param message Message of the log
   * @param type Type of the log
   */
  private log(title: string, message: string, type = 'info'): void {
    console.log(`${this.getTime()} [${this.chalkTitle(title)}] ${this.chalkMessage(type, message)}`);
  }

  /**
   * Get the color by type of the log
   * @param type Type of log message
   * @returns Color name
   */
  private getColorType(type: string): string {
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
  private getColorTitle(title: string): string {
    switch (title) {
      case 'server':
        return 'green';
      case 'router':
        return 'yellow';
      case 'ws':
        return 'red';
      case 'store':
        return 'blue';
      case 'debug':
        return 'magenta';
      default:
        return 'white';
    }
  }

  /**
   * Get the current time
   * @returns Time in HH:MM:SS format
   */
  private getTime(): string {
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
  private chalkTitle(title: string): string {
    const coloredTitle = this.getColorTitle(title);
    return chalk[coloredTitle](title);
  }

  /**
   * Add color to the message
   * @param type Type of the log
   * @param message Message of the log
   * @returns Message with color
   */
  private chalkMessage(type: string, message: string): string {
    const coloredType = this.getColorType(type);
    return chalk[coloredType](message);
  }
}

export default new Logger();
