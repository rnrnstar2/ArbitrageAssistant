// Core MVP types exports
// Position types
export * from './position';
// Action types 
export * from './action';
// Account types (from trading.ts)
export * from './trading';
// WebSocket types
export * from './websocket';
// User types (core MVP)
export var UserRole;
(function (UserRole) {
    UserRole["CLIENT"] = "CLIENT";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (UserRole = {}));
export var PCStatus;
(function (PCStatus) {
    PCStatus["ONLINE"] = "ONLINE";
    PCStatus["OFFLINE"] = "OFFLINE";
})(PCStatus || (PCStatus = {}));
