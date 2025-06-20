import { Amplify } from "aws-amplify";
import config from "@repo/shared-backend/amplify_outputs.json";

Amplify.configure(config);

export { Amplify };