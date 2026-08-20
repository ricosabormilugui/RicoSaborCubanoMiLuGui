function log(level, event, data = {}) {
  const payload = {
    level,
    event,
    at: new Date().toISOString(),
    ...data
  };

  console[level === 'error' ? 'error' : 'log'](JSON.stringify(payload));
}

export const logger = {
  info(event, data) {
    log('info', event, data);
  },
  warn(event, data) {
    log('warn', event, data);
  },
  error(event, data) {
    log('error', event, data);
  }
};
