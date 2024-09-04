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
const child_process_1 = require("child_process");
const util_1 = require("util");
const chalk_1 = __importDefault(require("chalk"));
const commander_1 = require("commander");
const readline_1 = require("readline");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const program = new commander_1.Command();
program
    .name("remdep")
    .description("Remove dependencies from package.json by specifying keywords.")
    .argument("<keywords>", "Comma-separated list of keywords")
    .option("-f, --force", "Remove dependencies without confirmation")
    .option("-r, --retry <times>", "Retry the remove command on failure", parseInt, 0)
    .helpOption("-h, --help", "Display help for command")
    .action((keywords, options) => __awaiter(void 0, void 0, void 0, function* () {
    const keywordList = keywords.split(",").map((k) => k.trim());
    if (keywordList.some((k) => k === "")) {
        console.error(chalk_1.default.red("Error: Keywords should be comma-separated without spaces or empty elements."));
        process.exit(1);
    }
    yield removeDependenciesContainingKeywords(keywordList, options);
}));
program.parse(process.argv);
function removeDependenciesContainingKeywords(keywords, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const manager = detectPackageManager();
        if (!manager) {
            console.error(chalk_1.default.red("Error: No package manager lock file found. Ensure you are in a Node.js project directory."));
            process.exit(1);
        }
        const packageJson = loadPackageJson();
        if (!packageJson) {
            console.error(chalk_1.default.red("Error: No package.json file found in the current directory."));
            process.exit(1);
        }
        const filteredDependencies = findDependencies(packageJson, keywords);
        if (filteredDependencies.length === 0) {
            console.log(chalk_1.default.blue(`No dependencies found containing any of the specified keywords: ${chalk_1.default.bold(keywords.join(", "))}.`));
            return;
        }
        console.log(chalk_1.default.magenta("The following dependencies will be removed:"));
        filteredDependencies.forEach((dep) => console.log(chalk_1.default.cyan(dep)));
        if (options.force) {
            yield proceedRemoval(manager, filteredDependencies, options.retry);
        }
        else {
            const confirmation = yield askConfirmation();
            if (confirmation) {
                yield proceedRemoval(manager, filteredDependencies, options.retry);
            }
            else {
                console.log(chalk_1.default.yellow("Aborted."));
            }
        }
    });
}
function detectPackageManager() {
    if ((0, fs_1.existsSync)("package-lock.json"))
        return "npm";
    if ((0, fs_1.existsSync)("pnpm-lock.yaml"))
        return "pnpm";
    if ((0, fs_1.existsSync)("yarn.lock"))
        return "yarn";
    if ((0, fs_1.existsSync)("bun.lockb"))
        return "bun";
    console.log(chalk_1.default.yellow("No lock file found, defaulting to npm as the package manager."));
    return "npm";
}
function loadPackageJson() {
    try {
        return JSON.parse((0, fs_1.readFileSync)("package.json", "utf8"));
    }
    catch (error) {
        return null;
    }
}
function findDependencies(packageJson, keywords) {
    const dependencies = Object.keys(packageJson.dependencies || {});
    const devDependencies = Object.keys(packageJson.devDependencies || {});
    return [...dependencies, ...devDependencies].filter((dep) => keywords.some((keyword) => dep.includes(keyword)));
}
function proceedRemoval(manager, dependencies, retries) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let attempt = 1; attempt <= retries + 1; attempt++) {
            try {
                console.log(chalk_1.default.magenta(`Removing dependencies using ${manager}. Attempt ${attempt} of ${retries + 1}`));
                const command = `${manager} remove ${dependencies.join(" ")}`;
                const { stdout, stderr } = yield execAsync(command);
                console.log(chalk_1.default.green(stdout));
                if (stderr)
                    console.error(chalk_1.default.red(stderr));
                console.log(chalk_1.default.green("Dependencies removed successfully."));
                break;
            }
            catch (error) {
                console.error(chalk_1.default.red(`Error executing command: ${error}`));
                if (attempt > retries)
                    throw error;
                console.log(chalk_1.default.yellow(`Retrying... Attempt ${attempt + 1} of ${retries + 1}`));
            }
        }
    });
}
function askConfirmation() {
    return new Promise((resolve) => {
        const rl = (0, readline_1.createInterface)({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(chalk_1.default.blue("Do you want to proceed? (y/n): "), (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === "y");
        });
    });
}
