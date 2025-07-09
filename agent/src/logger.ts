export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export class WingmanLogger implements Logger {
  constructor(
    private level: LogLevel = 'info',
    private output: NodeJS.WriteStream = process.stderr
  ) {}

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];
    const currentIndex = levels.indexOf(this.level);
    const messageIndex = levels.indexOf(level);
    
    return this.level !== 'silent' && messageIndex >= currentIndex;
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.shouldLog(level)) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    this.output.write(`${prefix} ${message}\n`);
    
    if (args.length > 0) {
      this.output.write(`${JSON.stringify(args, null, 2)}\n`);
    }
  }

  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }
}

// Silent logger for production/CLI use
export class SilentLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

// Factory function
export function createLogger(
  level: LogLevel = (process.env.WINGMAN_LOG_LEVEL as LogLevel) || 'info'
): Logger {
  if (level === 'silent') {
    return new SilentLogger();
  }
  return new WingmanLogger(level);
}

// Serializable logger config for worker threads
export interface SerializableLoggerConfig {
  level: LogLevel;
}

// Create logger from serializable config (for worker threads)
export function createLoggerFromConfig(config: SerializableLoggerConfig): Logger {
  return createLogger(config.level);
}