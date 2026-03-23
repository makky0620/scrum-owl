/* eslint-disable no-console */
export const logger = {
  log: (...args: unknown[]): void => {
    console.log(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
};
