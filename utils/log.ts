const _log = (method: "log" | "warn" | "error", ...args: any[]) => {
  console[method](`[${new Date().toISOString()}]`, ...args);
};

export const log = (...args: any[]) => {
  _log("log", ...args);
};

export const warn = (...args: any[]) => {
  _log("warn", ...args);
};

export const error = (...args: any[]) => {
  _log("error", ...args);
};
