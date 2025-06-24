// アクション列挙型
export var ActionType;
(function (ActionType) {
    ActionType["ENTRY"] = "ENTRY";
    ActionType["CLOSE"] = "CLOSE";
})(ActionType || (ActionType = {}));
export var ActionStatus;
(function (ActionStatus) {
    ActionStatus["PENDING"] = "PENDING";
    ActionStatus["EXECUTING"] = "EXECUTING";
    ActionStatus["EXECUTED"] = "EXECUTED";
    ActionStatus["FAILED"] = "FAILED";
})(ActionStatus || (ActionStatus = {}));
