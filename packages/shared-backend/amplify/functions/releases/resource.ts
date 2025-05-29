import { defineFunction } from "@aws-amplify/backend";

export const releasesFunction = defineFunction({
  name: "ArbitrageAssistantReleases",
  entry: "./handler.ts",
});