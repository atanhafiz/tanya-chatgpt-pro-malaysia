const fs = require('fs-extra');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');

// Ensure logs directory exists
fs.ensureDirSync(LOGS_DIR);

/**
 * Get log file path for today
 */
function getLogFilePath() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(LOGS_DIR, `${today}.log`);
}

/**
 * Format log entry
 */
function formatLogEntry(level, message, metadata = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(metadata).length > 0
    ? ' ' + JSON.stringify(metadata)
    : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
}

/**
 * Write log to file
 */
function writeLog(level, message, metadata) {
  const logFile = getLogFilePath();
  const logEntry = formatLogEntry(level, message, metadata);

  try {
    fs.appendFileSync(logFile, logEntry, 'utf8');
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

/**
 * Logger object with different log levels
 */
const logger = {
  /**
   * Log a message with level and optional metadata
   */
  log(level, message, metadata = {}) {
    writeLog(level, message, metadata);
    
    // Also output to console in development
    if (process.env.NODE_ENV !== 'production') {
      const emoji = {
        info: 'ℹ️',
        error: '❌',
        warning: '⚠️',
        success: '✅',
        comment: '💬',
        answer: '📝',
        post: '📤',
        telegram: '🤖',
        webhook: '🔗',
        server: '🚀',
        request: '📥',
        action: '⚡'
      }[level] || '📋';
      
      console.log(`${emoji} [${level.toUpperCase()}] ${message}`, 
        Object.keys(metadata).length > 0 ? metadata : '');
    }
  },

  /**
   * Convenience methods
   */
  info(message, metadata) {
    this.log('info', message, metadata);
  },

  error(message, metadata) {
    this.log('error', message, metadata);
  },

  warning(message, metadata) {
    this.log('warning', message, metadata);
  },

  success(message, metadata) {
    this.log('success', message, metadata);
  }
};

module.exports = logger;

