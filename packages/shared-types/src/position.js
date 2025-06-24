// Symbol 列挙型追加
export var Symbol;
(function (Symbol) {
    Symbol["USDJPY"] = "USDJPY";
    Symbol["EURUSD"] = "EURUSD";
    Symbol["EURGBP"] = "EURGBP";
    Symbol["XAUUSD"] = "XAUUSD";
})(Symbol || (Symbol = {}));
// ExecutionType 列挙型追加
export var ExecutionType;
(function (ExecutionType) {
    ExecutionType["ENTRY"] = "ENTRY";
    ExecutionType["EXIT"] = "EXIT";
})(ExecutionType || (ExecutionType = {}));
// PositionStatus 更新
export var PositionStatus;
(function (PositionStatus) {
    PositionStatus["PENDING"] = "PENDING";
    PositionStatus["OPENING"] = "OPENING";
    PositionStatus["OPEN"] = "OPEN";
    PositionStatus["CLOSING"] = "CLOSING";
    PositionStatus["CLOSED"] = "CLOSED";
    PositionStatus["STOPPED"] = "STOPPED";
    PositionStatus["CANCELED"] = "CANCELED";
})(PositionStatus || (PositionStatus = {}));
