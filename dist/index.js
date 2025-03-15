#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const path_1 = __importDefault(require("path"));
const fs_2 = __importDefault(require("fs"));
const ts_morph_1 = require("ts-morph");
const glob = __importStar(require("glob"));
const fuzzy_1 = __importDefault(require("fuzzy"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const program = new commander_1.Command();
const inUse = new Set();
const checkInUse = (filteredDependencies) => __awaiter(void 0, void 0, void 0, function* () {
    const sourceFiles = glob.sync("**/*.{ts,tsx}", { ignore: "node_modules/**" });
    const allDependencies = filteredDependencies; // Dependencies selected for removal
    const project = new ts_morph_1.Project();
    sourceFiles.forEach((file) => project.addSourceFileAtPath(file));
    project.getSourceFiles().forEach((sourceFile) => {
        sourceFile.getImportDeclarations().forEach((importDecl) => {
            const moduleName = importDecl.getModuleSpecifierValue();
            if (allDependencies.includes(moduleName)) {
                inUse.add(moduleName);
                if (allDependencies.includes("react")) {
                    inUse.add("react");
                    inUse.add("react-dom");
                    inUse.add("@types/react");
                    inUse.add("@types/react-dom");
                }
                if (allDependencies.includes("typescript")) {
                    inUse.add("typescript");
                }
                if (allDependencies.includes("vite")) {
                    inUse.add("vite");
                }
                if (allDependencies.includes("vitest")) {
                    inUse.add("vitest");
                }
                if (allDependencies.includes("@types/node")) {
                    inUse.add("@types/node");
                }
            }
        });
    });
    return inUse; // Return the populated set
});
/**
 * Takes a version string (e.g. "1.2.3") and splits it into an array of numbers
 * (e.g. [1, 2, 3])
 *
 * @param {string} version - The version string to parse
 * @returns {number[]} - The version as an array of numbers
 */
const parseVersion = (version) => {
    return version.split(".").map(Number);
};
// Read package.json of this project
const packageJsonPath = path_1.default.join(__dirname, "..", "package.json");
const thisProjectJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, "utf8"));
/**
 * Compares two version strings (e.g. "1.2.3") and returns a number indicating
 * the result of the comparison.
 *
 * The comparison is performed by comparing the major, minor, and patch
 * numbers of the two version strings. If the major numbers are different,
 * the comparison result is based on them. If the minor numbers are different,
 * the comparison result is based on them. Otherwise, the comparison result is
 * based on the patch numbers.
 *
 * The return value is one of the following:
 * * 1 if version1 is greater than version2
 * * -1 if version1 is less than version2
 * * 0 if version1 is equal to version2
 *
 * @param {string} version1 - The first version string to compare
 * @param {string} version2 - The second version string to compare
 * @returns {number} - The result of the comparison
 */
const compareVersions = (version1, version2) => {
    const [major1, minor1, patch1] = parseVersion(version1);
    const [major2, minor2, patch2] = parseVersion(version2);
    if (major1 > major2)
        return 1;
    if (major1 < major2)
        return -1;
    if (minor1 > minor2)
        return 1;
    if (minor1 < minor2)
        return -1;
    if (patch1 > patch2)
        return 1;
    if (patch1 < patch2)
        return -1;
    return 0; // Versions are equal
};
// Set up command options
program
    .name("remdep")
    .description("Remove dependencies from package.json by specifying keywords.")
    .argument("<keywords>", "Comma-separated list of keywords")
    .option("-f, --force", "Remove dependencies without confirmation", false)
    .option("-d, --dry-run", "Dry run the remove command", false)
    .option("-di, --dependency-impact", "Show whether any dependency is currently used in the project", false)
    .option("-fm, --fuzz-matching", "Find keywords using fuzzy matching with regex", false)
    .option("-b, --backup", "Backup the original package.json file", false)
    .option("-rs, --restore", "Restore the original package.json file", false)
    .option("-s, --skip-in-use", "Skip dependencies that are currently used in the project", false)
    .option("-r, --retry <times>", "Retry the remove command on failure", parseInt, 0)
    .version(thisProjectJson.version, "-v, --version", "Output the current version")
    .showHelpAfterError(true)
    .showSuggestionAfterError(true)
    .summary("Remove dependencies from package.json by specifying keywords.")
    .usage("<keywords> [options]")
    .helpOption("-h, --help", "Display help for command")
    .action((keywords, options) => __awaiter(void 0, void 0, void 0, function* () {
    // Check for updates
    try {
        const data = yield fetch("https://registry.npmjs.org/remdep");
        const result = yield data.json();
        const npmVersion = result["dist-tags"].latest;
        const comparisonResult = compareVersions(npmVersion, thisProjectJson.version);
        switch (true) {
            case comparisonResult > 0:
                console.log(chalk_1.default.yellow(`RemDep has a new version: "${npmVersion}". Your version: "${thisProjectJson.version}".\nUpdate by running:\nnpm install -g remdep@latest\n`));
                break;
            case comparisonResult < 0:
                console.log(chalk_1.default.red(`You are running a higher version than is available.\nNPM version: "${npmVersion}". Your version: "${thisProjectJson.version}".\n`));
                break;
            case comparisonResult === 0:
                console.log(chalk_1.default.green(`You have the latest version of RemDep. NPM version: "${npmVersion}" is equal to "${thisProjectJson.version}".\n`));
                break;
            default:
                console.log(`Unexpected comparison result.\n`);
                break;
        }
    }
    catch (err) {
        console.error(chalk_1.default.red(`Error getting NPM version: ${err}\n`));
    }
    const keywordList = keywords.split(",").map((k) => k.trim());
    // Check if keywords are valid
    if (keywordList.some((k) => k === "")) {
        console.error(chalk_1.default.red("Error: Keywords should be comma-separated without spaces or empty elements."));
        process.exit(1);
    }
    // Remove dependencies
    yield removeDependenciesContainingKeywords(keywordList, options);
}));
program.parse(process.argv);
/**
 * Removes dependencies from package.json by specifying keywords.
 *
 * @param {string[]} keywords - Comma-separated list of keywords to remove
 * @param {Options} options - Options to customize behavior
 * @returns {Promise<void>} - Resolves when dependencies have been removed
 */
function removeDependenciesContainingKeywords(keywords, options) {
    return __awaiter(this, void 0, void 0, function* () {
        // Detect package manager
        const manager = detectPackageManager();
        // Check if package manager lock file exists
        if (!manager) {
            console.error(chalk_1.default.red("Error: No package manager lock file found. Ensure you are in a Node.js project directory."));
            process.exit(1);
        }
        // Load package.json
        const packageJson = loadPackageJson();
        // Check if package.json exists
        if (!packageJson) {
            console.error(chalk_1.default.red("Error: No package.json file found in the current directory."));
            process.exit(1);
        }
        if (options.backup) {
            // check if package.json exists
            if (!fs_2.default.existsSync("package.json")) {
                console.error(chalk_1.default.red("Error: No package.json file found in the current directory."));
                process.exit(1);
            }
            fs_2.default.renameSync("package.json", "package.json.bak");
            // clone it as package.json
            fs_2.default.copyFileSync("package.json.bak", "package.json");
            console.log(chalk_1.default.green("Original package.json file has been backed up as package.json.bak.\n"));
        }
        if (options.restore) {
            // check if backup exists
            if (!fs_2.default.existsSync("package.json.bak")) {
                console.error(chalk_1.default.red("Error: No package.json.bak file found in the current directory."));
                process.exit(1);
            }
            if (fs_2.default.existsSync("package.json")) {
                fs_2.default.rmSync("package.json");
            }
            fs_2.default.renameSync("package.json.bak", "package.json");
            console.log(chalk_1.default.green("Original package.json file has been restored from package.json.bak.\n"));
        }
        // Find dependencies containing keywords
        const filteredDependencies = findDependencies(packageJson, keywords, options);
        // Check if any dependencies were found
        if (filteredDependencies.length === 0) {
            console.log(chalk_1.default.blue(`No dependencies found containing any of the specified keywords: ${chalk_1.default.bold(keywords.join(", "))}.`));
            return;
        }
        let onlyRemove = filteredDependencies;
        if (options.skipInUse) {
            const depInUse = yield checkInUse(filteredDependencies); // Await for the result
            if (depInUse.size > 0) {
                onlyRemove = filteredDependencies.filter((dep) => !depInUse.has(dep));
            }
        }
        if (options.dependencyImpact) {
            // Check if dependencies are in use
            const usedDeps = yield checkInUse(filteredDependencies);
            if (usedDeps.size > 0) {
                console.log(chalk_1.default.yellow("\nWarning: The following dependencies are in use and should not be removed:"));
                usedDeps.forEach((dep) => console.log(chalk_1.default.red(`- ${dep}`)));
                console.log("\n");
            }
            else {
                console.log(chalk_1.default.green("\nNo selected dependencies are currently in use.\n"));
            }
        }
        // Log dependencies to be removed
        if (options.dryRun) {
            console.log(chalk_1.default.magenta(`The following dependencies would be removed using ${manager}:\n`));
            onlyRemove.forEach((dep) => console.log(chalk_1.default.cyan(dep)));
            return;
        }
        // Log dependencies to be removed
        console.log(chalk_1.default.magenta(`The following dependencies will be removed using ${manager}:\n`));
        onlyRemove.forEach((dep) => console.log(chalk_1.default.cyan(dep)));
        // Prompt user for confirmation if --force is not set, otherwise proceed
        if (options.force) {
            yield proceedRemoval(manager, onlyRemove, options.retry, options.skipInUse);
        }
        else {
            const confirmation = yield askConfirmation();
            if (confirmation) {
                yield proceedRemoval(manager, onlyRemove, options.retry, options.skipInUse);
            }
            else {
                console.log(chalk_1.default.yellow(`\nAborted.`));
            }
        }
    });
}
/**
 * Detects the package manager to use based on the presence of lock files.
 *
 * @returns The name of the package manager to use.
 */
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
/**
 * Loads package.json from the current working directory and returns it as a JSON
 * object, or null if the file does not exist or is invalid.
 *
 * @returns {JSON|null} The package.json object, or null if it could not be loaded.
 */
function loadPackageJson() {
    try {
        return JSON.parse((0, fs_1.readFileSync)("package.json", "utf8"));
    }
    catch (error) {
        return null;
    }
}
function fuzzyMatch(dep, keyword) {
    return fuzzy_1.default.filter(keyword, [dep]).length > 0; // Checks if the fuzzy match results are non-empty
}
/**
 * Finds all dependencies in package.json that match any of the given keywords.
 *
 * @param packageJson The package.json object
 * @param keywords The keywords to search for
 * @returns An array of dependency names that match any of the given keywords
 */
function findDependencies(packageJson, keywords, options) {
    const dependencies = Object.keys(packageJson.dependencies || {});
    const devDependencies = Object.keys(packageJson.devDependencies || {});
    if (options.fuzzMatching) {
        return [...dependencies, ...devDependencies].filter((dep) => keywords.some((keyword) => fuzzyMatch(dep, keyword)));
    }
    return [...dependencies, ...devDependencies].filter((dep) => keywords.some((keyword) => dep.includes(keyword)));
}
/**
 * Attempts to remove the given dependencies using the given package manager.
 * If the command fails, it will retry up to the given number of times.
 *
 * @param manager The package manager to use (e.g. "npm", "yarn", "pnpm")
 * @param dependencies The list of dependencies to remove
 * @param retries The number of times to retry if the command fails
 */
function proceedRemoval(manager, dependencies, retries, skipInUse) {
    return __awaiter(this, void 0, void 0, function* () {
        const onlyRemove = [];
        if (skipInUse) {
            const depInUse = yield checkInUse(dependencies); // Await for the result
            onlyRemove.concat(dependencies.filter((dep) => !depInUse.has(dep)));
            // show depenedencies that are in use and will not removed
            console.log("Dependencies that are in use and are not be removed:\n" +
                chalk_1.default.red(Array.from(depInUse).join("\n")));
        }
        // For each attempt execute the command
        for (let attempt = 1; attempt <= retries + 1; attempt++) {
            try {
                console.log(chalk_1.default.magenta(`\nRemoving dependencies using ${manager}. Attempt ${attempt} of ${retries + 1}`));
                // Execute the command
                const command = `${manager} remove ${onlyRemove.join(" ")}`;
                const { stdout, stderr } = yield execAsync(command);
                // Log the output
                console.log(chalk_1.default.green(stdout));
                // Log any errors
                if (stderr)
                    console.error(chalk_1.default.red(stderr));
                console.log(chalk_1.default.green(`\nDependencies removed successfully using ${manager}.`));
                break;
            }
            catch (error) {
                console.error(chalk_1.default.red(`\nError executing command: ${error}`));
                // If this was the last attempt, throw the error
                if (attempt > retries)
                    throw error;
                console.log(chalk_1.default.yellow(`\nRetrying... Attempt ${attempt + 1} of ${retries + 1}`));
            }
        }
    });
}
/**
 * Asks the user for confirmation and returns a promise that resolves to true if the user confirms
 * or false if they do not.
 *
 * @returns {Promise<boolean>}
 */
function askConfirmation() {
    return new Promise((resolve) => {
        const rl = (0, readline_1.createInterface)({
            input: process.stdin,
            output: process.stdout,
        });
        // Ask the user for confirmation
        rl.question(chalk_1.default.blue(`\nDo you want to proceed? (y/n): `), (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === "y");
        });
    });
}
