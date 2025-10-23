"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.LogLevel = void 0;
const isDebug = true;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["info"] = 0] = "info";
    LogLevel[LogLevel["log"] = 1] = "log";
    LogLevel[LogLevel["warn"] = 2] = "warn";
    LogLevel[LogLevel["error"] = 3] = "error";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
function log(level, ...args) {
    if (isDebug) {
        switch (level) {
            case LogLevel.log:
                console.log(...args);
                break;
            case LogLevel.info:
                console.info(...args);
                break;
            case LogLevel.warn:
                console.warn(...args);
                break;
            case LogLevel.error:
                console.error(...args);
                break;
        }
    }
}
exports.log = log;
//# sourceMappingURL=log.js.map