#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const readline_1 = require("readline");
const child_process_1 = require("child_process");
const util_1 = require("util");
const chalk_1 = __importDefault(require("chalk"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
function displayHelp() {
    console.log(chalk_1.default.green(`
Usage: ${chalk_1.default.bold("remdep <keywords> [options]")}
Keywords should be comma-separated without spaces.
Options:
  ${chalk_1.default.blue("--help")}            Display this help message
  ${chalk_1.default.blue("--force")}           Remove dependencies without confirmation
  ${chalk_1.default.blue("--retry <times>")}   Retry the remove command on failure, specifying how many times to retry
Examples:
  ${chalk_1.default.yellow("remdep eslint,babel --force")}
  ${chalk_1.default.yellow("remdep react,vue --retry 3")}
    `));
}
function removeDependenciesContainingKeywords(keywords, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (options.help || keywords.length === 0) {
            displayHelp();
            return;
        }
        if (keywords.some((keyword) => keyword !== undefined &&
            (keyword.trim() === "" || keyword.includes(" "))) ||
            keywords.some((keyword) => keyword === undefined)) {
            console.log(chalk_1.default.red("Error: Keywords should be comma-separated without spaces or empty elements."));
            return;
        }
        let manager = "npm"; // Default to npm if no lock file is found
        if ((0, fs_1.existsSync)("package-lock.json")) {
            manager = "npm";
        }
        else if ((0, fs_1.existsSync)("pnpm-lock.yaml")) {
            manager = "pnpm";
        }
        else if ((0, fs_1.existsSync)("yarn.lock")) {
            manager = "yarn";
        }
        else if ((0, fs_1.existsSync)("bun.lockb")) {
            manager = "bun";
        }
        else {
            console.log(chalk_1.default.yellow("No lock file found, defaulting to npm as the package manager."));
        }
        if (!(0, fs_1.existsSync)("package.json")) {
            console.error(chalk_1.default.red("Error: No package.json file found in the current directory."));
            return;
        }
        const packageJson = JSON.parse((0, fs_1.readFileSync)("package.json", "utf8"));
        const dependencies = Object.keys(packageJson.dependencies || {});
        const devDependencies = Object.keys(packageJson.devDependencies || {});
        const allDependencies = dependencies.concat(devDependencies);
        const filteredDependencies = allDependencies.filter((dep) => keywords.some((keyword) => dep.includes(keyword)));
        if (filteredDependencies.length === 0) {
            console.log(chalk_1.default.blue(`No dependencies found containing any of the specified keywords: ${chalk_1.default.bold(keywords.join(", "))}.`));
            return;
        }
        console.log(chalk_1.default.magenta("The following dependencies will be removed:"));
        filteredDependencies.forEach((dep) => console.log(chalk_1.default.cyan(dep)));
        const proceedRemoval = (...args_1) => __awaiter(this, [...args_1], void 0, function* (attempt = 1) {
            try {
                console.log(chalk_1.default.magenta(`Removing dependencies using ${manager}. Attempt ${attempt} of ${options.initialRetry + 1}`));
                const command = `${manager} remove ${filteredDependencies.join(" ")}`;
                const { stdout, stderr } = yield execAsync(command);
                console.log(chalk_1.default.green(stdout));
                if (stderr) {
                    console.error(chalk_1.default.red(stderr));
                }
                console.log(chalk_1.default.green(`Dependencies containing the specified keywords have been removed using ${manager}.`));
            }
            catch (error) {
                console.error(chalk_1.default.red(`Error executing command: ${error}`));
                if (options.retry > 0) {
                    console.log(chalk_1.default.yellow(`Retrying... Attempt ${attempt + 1} of ${options.initialRetry + 1}`));
                    options.retry--;
                    yield proceedRemoval(attempt + 1);
                }
            }
        });
        if (options.force) {
            yield proceedRemoval();
        }
        else {
            const rl = (0, readline_1.createInterface)({
                input: process.stdin,
                output: process.stdout,
            });
            rl.question(chalk_1.default.blue("Do you want to proceed? (y/n): "), (answer) => __awaiter(this, void 0, void 0, function* () {
                rl.close();
                if (answer.toLowerCase() === "y") {
                    yield proceedRemoval();
                }
                else {
                    console.log(chalk_1.default.yellow("Aborted."));
                }
            }));
        }
    });
}
const args = process.argv.slice(2);
const keywordArg = args.find((arg) => !arg.startsWith("--"));
const keywords = keywordArg ? keywordArg.split(",").map((k) => k.trim()) : [];
const force = args.includes("--force");
const help = args.includes("--help");
const retryIndex = args.indexOf("--retry");
const retry = retryIndex !== -1 ? parseInt(args[retryIndex + 1], 10) : 0;
removeDependenciesContainingKeywords(keywords.length > 1 ? keywords : [keywords[0]], { force, help, retry, initialRetry: retry });
