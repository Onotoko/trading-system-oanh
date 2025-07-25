const path = require("path");

module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    rootDir: "./",
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1"
    },
    modulePaths: [path.resolve(__dirname, "src")],
};