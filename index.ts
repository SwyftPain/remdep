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

// Read package.json of this project
const packageJsonPath = path.join(__dirname, "..", "package.json");
const thisProjectJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

// Set up command options
program
  .name("remdep")
  .description("Remove dependencies from package.json by specifying keywords.")
  .argument("<keywords>", "Comma-separated list of keywords")
  .option("-f, --force", "Remove dependencies without confirmation")
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
  .helpOption("-h, --help", "Display help for command")
  .action(async (keywords: string, options: Options) => {
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
  console.log(chalk.magenta(`The following dependencies will be removed using ${manager}:`));
  filteredDependencies.forEach((dep) => console.log(chalk.cyan(dep)));

  // Prompt user for confirmation if --force is not set, otherwise proceed
  if (options.force) {
    await proceedRemoval(manager, filteredDependencies, options.retry);
  } else {
    const confirmation = await askConfirmation();

    if (confirmation) {
      await proceedRemoval(manager, filteredDependencies, options.retry);
    } else {
      console.log(chalk.yellow("Aborted."));
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
          `Removing dependencies using ${manager}. Attempt ${attempt} of ${
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

      console.log(chalk.green(`Dependencies removed successfully using ${manager}.`));
      break;
    } catch (error) {
      console.error(chalk.red(`Error executing command: ${error}`));

      // If this was the last attempt, throw the error
      if (attempt > retries) throw error;
      console.log(
        chalk.yellow(`Retrying... Attempt ${attempt + 1} of ${retries + 1}`)
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
    rl.question(chalk.blue("Do you want to proceed? (y/n): "), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}
