#!/usr/bin/env node

import { existsSync, readFileSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import { Command } from "commander";
import { createInterface } from "readline";
import path from "path";
import type { Deps, JSON, Options } from "./types";

const execAsync = promisify(exec);
const program = new Command();

/**
 * Takes a version string (e.g. "1.2.3") and splits it into an array of numbers
 * (e.g. [1, 2, 3])
 *
 * @param {string} version - The version string to parse
 * @returns {number[]} - The version as an array of numbers
 */
const parseVersion = (version: string) => {
  return version.split(".").map(Number);
};

// Read package.json of this project
const packageJsonPath = path.join(__dirname, "..", "package.json");
const thisProjectJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

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

const compareVersions = (version1: string, version2: string) => {
  const [major1, minor1, patch1] = parseVersion(version1);
  const [major2, minor2, patch2] = parseVersion(version2);

  if (major1 > major2) return 1;
  if (major1 < major2) return -1;

  if (minor1 > minor2) return 1;
  if (minor1 < minor2) return -1;

  if (patch1 > patch2) return 1;
  if (patch1 < patch2) return -1;

  return 0; // Versions are equal
};

// Set up command options
program
  .name("remdep")
  .description("Remove dependencies from package.json by specifying keywords.")
  .argument("<keywords>", "Comma-separated list of keywords")
  .option("-f, --force", "Remove dependencies without confirmation", false)
  .option("-d, --dry-run", "Dry run the remove command", false)
  .option(
    "-r, --retry <times>",
    "Retry the remove command on failure",
    parseInt,
    0
  )
  .version(
    thisProjectJson.version,
    "-v, --version",
    "Output the current version"
  )
  .showHelpAfterError(true)
  .showSuggestionAfterError(true)
  .summary("Remove dependencies from package.json by specifying keywords.")
  .usage("<keywords> [options]")
  .helpOption("-h, --help", "Display help for command")
  .action(async (keywords: string, options: Options) => {
    // Check for updates
    try {
      const data = await fetch("https://registry.npmjs.org/remdep");
      const result = await data.json();

      const npmVersion = result["dist-tags"].latest;

      const comparisonResult = compareVersions(
        npmVersion,
        thisProjectJson.version
      );

      switch (true) {
        case comparisonResult > 0:
          console.log(
            chalk.yellow(
              `RemDep has a new version: "${npmVersion}". Your version: "${thisProjectJson.version}".\nUpdate by running:\nnpm install -g remdep@latest\n`
            )
          );
          break;
        case comparisonResult < 0:
          console.log(
            chalk.red(
              `You are running a higher version than is available.\nNPM version: "${npmVersion}". Your version: "${thisProjectJson.version}".\n`
            )
          );
          break;
        case comparisonResult === 0:
          console.log(
            chalk.green(
              `You have the latest version of RemDep. NPM version: "${npmVersion}" is equal to "${thisProjectJson.version}".\n`
            )
          );
          break;
        default:
          console.log(`Unexpected comparison result.\n`);
          break;
      }
    } catch (err) {
      console.error(chalk.red(`Error getting NPM version: ${err}\n`));
    }

    const keywordList = keywords.split(",").map((k) => k.trim());

    // Check if keywords are valid
    if (keywordList.some((k) => k === "")) {
      console.error(
        chalk.red(
          "Error: Keywords should be comma-separated without spaces or empty elements."
        )
      );
      process.exit(1);
    }

    // Remove dependencies
    await removeDependenciesContainingKeywords(keywordList, options);
  });

program.parse(process.argv);

/**
 * Removes dependencies from package.json by specifying keywords.
 *
 * @param {string[]} keywords - Comma-separated list of keywords to remove
 * @param {Options} options - Options to customize behavior
 * @returns {Promise<void>} - Resolves when dependencies have been removed
 */
async function removeDependenciesContainingKeywords(
  keywords: string[],
  options: Options
) {
  // Detect package manager
  const manager = detectPackageManager();

  // Check if package manager lock file exists
  if (!manager) {
    console.error(
      chalk.red(
        "Error: No package manager lock file found. Ensure you are in a Node.js project directory."
      )
    );
    process.exit(1);
  }

  // Load package.json
  const packageJson = loadPackageJson();

  // Check if package.json exists
  if (!packageJson) {
    console.error(
      chalk.red("Error: No package.json file found in the current directory.")
    );
    process.exit(1);
  }

  // Find dependencies containing keywords
  const filteredDependencies = findDependencies(packageJson, keywords);

  // Check if any dependencies were found
  if (filteredDependencies.length === 0) {
    console.log(
      chalk.blue(
        `No dependencies found containing any of the specified keywords: ${chalk.bold(
          keywords.join(", ")
        )}.`
      )
    );

    return;
  }

  // Log dependencies to be removed
  if (options.dryRun) {
    console.log(
      chalk.magenta(
        `The following dependencies would be removed using ${manager}:\n`
      )
    );
    filteredDependencies.forEach((dep) => console.log(chalk.cyan(dep)));

    return;
  }

  // Log dependencies to be removed
  console.log(
    chalk.magenta(
      `The following dependencies will be removed using ${manager}:\n`
    )
  );
  filteredDependencies.forEach((dep) => console.log(chalk.cyan(dep)));

  // Prompt user for confirmation if --force is not set, otherwise proceed
  if (options.force) {
    await proceedRemoval(manager, filteredDependencies, options.retry);
  } else {
    const confirmation = await askConfirmation();

    if (confirmation) {
      await proceedRemoval(manager, filteredDependencies, options.retry);
    } else {
      console.log(chalk.yellow(`\nAborted.`));
    }
  }
}

/**
 * Detects the package manager to use based on the presence of lock files.
 *
 * @returns The name of the package manager to use.
 */
function detectPackageManager() {
  if (existsSync("package-lock.json")) return "npm";
  if (existsSync("pnpm-lock.yaml")) return "pnpm";
  if (existsSync("yarn.lock")) return "yarn";
  if (existsSync("bun.lockb")) return "bun";

  console.log(
    chalk.yellow(
      "No lock file found, defaulting to npm as the package manager."
    )
  );

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
    return JSON.parse(readFileSync("package.json", "utf8"));
  } catch (error) {
    return null;
  }
}

/**
 * Finds all dependencies in package.json that match any of the given keywords.
 *
 * @param packageJson The package.json object
 * @param keywords The keywords to search for
 * @returns An array of dependency names that match any of the given keywords
 */
function findDependencies(packageJson: JSON, keywords: string[]) {
  const dependencies = Object.keys(packageJson.dependencies || {});
  const devDependencies = Object.keys(packageJson.devDependencies || {});

  return [...dependencies, ...devDependencies].filter((dep) =>
    keywords.some((keyword) => dep.includes(keyword))
  );
}

/**
 * Attempts to remove the given dependencies using the given package manager.
 * If the command fails, it will retry up to the given number of times.
 *
 * @param manager The package manager to use (e.g. "npm", "yarn", "pnpm")
 * @param dependencies The list of dependencies to remove
 * @param retries The number of times to retry if the command fails
 */
async function proceedRemoval(
  manager: string,
  dependencies: string[],
  retries: number
) {
  // For each attempt execute the command
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      console.log(
        chalk.magenta(
          `\nRemoving dependencies using ${manager}. Attempt ${attempt} of ${
            retries + 1
          }`
        )
      );

      // Execute the command
      const command = `${manager} remove ${dependencies.join(" ")}`;
      const { stdout, stderr } = await execAsync(command);

      // Log the output
      console.log(chalk.green(stdout));

      // Log any errors
      if (stderr) console.error(chalk.red(stderr));

      console.log(
        chalk.green(`\nDependencies removed successfully using ${manager}.`)
      );
      break;
    } catch (error) {
      console.error(chalk.red(`\nError executing command: ${error}`));

      // If this was the last attempt, throw the error
      if (attempt > retries) throw error;
      console.log(
        chalk.yellow(`\nRetrying... Attempt ${attempt + 1} of ${retries + 1}`)
      );
    }
  }
}

/**
 * Asks the user for confirmation and returns a promise that resolves to true if the user confirms
 * or false if they do not.
 *
 * @returns {Promise<boolean>}
 */
function askConfirmation() {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Ask the user for confirmation
    rl.question(chalk.blue(`\nDo you want to proceed? (y/n): `), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}
