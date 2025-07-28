const path = require("path");

module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    rootDir: "./",
    testMatch: [
        "**/tests/**/*.test.ts",
        "**/tests/**/*.spec.ts"
    ],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1"
    },
    modulePaths: [path.resolve(__dirname, "src")],
    setupFilesAfterEnv: [],
    collectCoverageFrom: [
        "src/**/*.{ts,js}",
        "!src/**/*.d.ts",
        "!src/**/*.test.{ts,js}",
        "!src/**/*.spec.{ts,js}"
    ],
    transform: {
        "^.+\\.ts$": "ts-jest"
    },
    moduleFileExtensions: ["ts", "js", "json", "node"]
};