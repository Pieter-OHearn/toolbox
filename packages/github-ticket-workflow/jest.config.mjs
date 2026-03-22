export default {
  displayName: "github-ticket-workflow",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: {
          target: "es2022",
          parser: {
            syntax: "typescript",
          },
        },
        module: {
          type: "es6",
        },
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
};
