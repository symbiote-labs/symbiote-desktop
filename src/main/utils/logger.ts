/**
 * 简单的日志工具
 */
export class Logger {
  /**
   * 输出信息日志
   */
  public static info(...args: any[]): void {
    console.log('[INFO]', ...args)
  }

  /**
   * 输出警告日志
   */
  public static warn(...args: any[]): void {
    console.warn('[WARN]', ...args)
  }

  /**
   * 输出错误日志
   */
  public static error(...args: any[]): void {
    console.error('[ERROR]', ...args)
  }

  /**
   * 输出调试日志
   */
  public static debug(...args: any[]): void {
    console.debug('[DEBUG]', ...args)
  }
}
