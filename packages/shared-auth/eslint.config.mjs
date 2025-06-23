import baseConfig from "@repo/eslint-config/base";

export default [
  ...baseConfig,
  {
    rules: {
      "no-console": "warn",
    }
  }
];