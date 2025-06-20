import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { websocketHandler } from "./functions/websocket-handler/resource";
import { createEntry } from "./functions/create-entry/resource";
import { closePosition } from "./functions/closePosition/resource";
import { batchClosePositions } from "./functions/batchClosePositions/resource";
import { createPositionRecord } from "./functions/createPositionRecord/resource";
import { updatePositionRecord } from "./functions/updatePositionRecord/resource";
import { getCloseHistory } from "./functions/getCloseHistory/resource";

const backend = defineBackend({
  auth,
  data,
  websocketHandler,
  createEntry,
  closePosition,
  batchClosePositions,
  createPositionRecord,
  updatePositionRecord,
  getCloseHistory,
});

// extract L1 CfnUserPool resources
const { cfnUserPool } = backend.auth.resources.cfnResources;
// modify cfnUserPool policies directly
cfnUserPool.policies = {
  passwordPolicy: {
    minimumLength: 8,
    requireLowercase: false,
    requireNumbers: false,
    requireSymbols: false,
    requireUppercase: false,
  },
};
