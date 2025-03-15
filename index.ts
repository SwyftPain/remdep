#!/usr/bin/env node

import { existsSync, readFileSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import { Command } from "commander";
import { createInterface } from "readline";
import path from "path";
import type { Deps, JSON, Options } from "./types";
import fs from "fs";
import { Project, SyntaxKind } from "ts-morph";
import * as glob from "glob";
import { get } from 'fast-levenshtein';

const levenshtein = get;

const execAsync = promisify(exec);
const program = new Command();

const inUse = new Set<string>();

function correctTyposWithLevenshteinDistance(
  keywords: string[],
  packageJson: any
): string[] {
  const allDependencies = [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
  ];

  return keywords.map((keyword) => {
    let correctedKeyword = keyword;
    let smallestDistance = Infinity; // To track the smallest Levenshtein distance
    let bestMatch = keyword;

    for (const dep of allDependencies) {
      const distance = levenshtein(dep, keyword); // Calculate Levenshtein distance
      if (distance < smallestDistance) {
        smallestDistance = distance;
        bestMatch = dep; // Keep track of the closest match
      }
    }

    // If a valid dependency is found with a smaller distance, use it
    if (smallestDistance < keyword.length / 2) {
      correctedKeyword = bestMatch;
    } else {
      console.log(chalk.yellow(`No close match found for "${keyword}". Using original keyword.`));
    }

    return correctedKeyword;
  });
}

const checkInUse = async (
  filteredDependencies: string[]
): Promise<Set<string>> => {
  const sourceFiles = glob.sync("**/*.{ts,tsx}", { ignore: "node_modules/**" });

  const allDependencies = filteredDependencies; // Dependencies selected for removal

  const project = new Project();
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
};

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
    "-di, --dependency-impact",
    "Show whether any dependency is currently used in the project",
    false
  )
  .option(
    "-fm, --fuzz-matching",
    "Find keywords using fuzzy matching with regex",
    false
  )
  .option("-b, --backup", "Backup the original package.json file", false)
  .option("-rs, --restore", "Restore the original package.json file", false)
  .option(
    "-s, --skip-in-use",
    "Skip dependencies that are currently used in the project",
    false
  )
  .option(
    "-r, --retry <times>",
    "Retry the remove command on failure",
    parseInt,
    0
  )
  .option(
    "-rm, --regex-matching",
    "Find dependencies using regular expressions (regex)",
    false
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

  if (options.backup) {
    // check if package.json exists
    if (!fs.existsSync("package.json")) {
      console.error(
        chalk.red("Error: No package.json file found in the current directory.")
      );
      process.exit(1);
    }

    fs.renameSync("package.json", "package.json.bak");

    // clone it as package.json
    fs.copyFileSync("package.json.bak", "package.json");

    console.log(
      chalk.green(
        "Original package.json file has been backed up as package.json.bak.\n"
      )
    );
  }

  if (options.restore) {
    // check if backup exists
    if (!fs.existsSync("package.json.bak")) {
      console.error(
        chalk.red(
          "Error: No package.json.bak file found in the current directory."
        )
      );
      process.exit(1);
    }

    if (fs.existsSync("package.json")) {
      fs.rmSync("package.json");
    }

    fs.renameSync("package.json.bak", "package.json");
    console.log(
      chalk.green(
        "Original package.json file has been restored from package.json.bak.\n"
      )
    );
  }

  // Find dependencies containing keywords
  const filteredDependencies = findDependencies(packageJson, keywords, options);

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

  let onlyRemove = filteredDependencies;

  if (options.fuzzMatching) {
    // use levenshtein distance to find keywords
    onlyRemove = correctTyposWithLevenshteinDistance(keywords, packageJson);
  }

  if (options.skipInUse) {
    const depInUse = await checkInUse(filteredDependencies); // Await for the result
    if (depInUse.size > 0) {
      onlyRemove = filteredDependencies.filter((dep) => !depInUse.has(dep));
    }
  }

  if (options.dependencyImpact) {
    // Check if dependencies are in use
    const usedDeps = await checkInUse(filteredDependencies);

    if (usedDeps.size > 0) {
      console.log(
        chalk.yellow(
          "\nWarning: The following dependencies are in use and should not be removed:"
        )
      );
      usedDeps.forEach((dep) => console.log(chalk.red(`- ${dep}`)));
      console.log("\n");
    } else {
      console.log(
        chalk.green("\nNo selected dependencies are currently in use.\n")
      );
    }
  }

  // Log dependencies to be removed
  if (options.dryRun) {
    console.log(
      chalk.magenta(
        `The following dependencies would be removed using ${manager}:\n`
      )
    );
    onlyRemove.forEach((dep) => console.log(chalk.cyan(dep)));

    return;
  }

  if (options.regexMatching) {
    // use regex matching on the keywords
    onlyRemove = onlyRemove.filter((dep) =>
      keywords.some((keyword) => new RegExp(keyword, "i").test(dep))
    );
  }

  if (options.fuzzMatching && options.regexMatching) {
    // fix typos using levenshtein distance, then use regex matching on the corrected keywords
    keywords = correctTyposWithLevenshteinDistance(keywords, packageJson);

    // use regex matching on the corrected keywords
    onlyRemove = onlyRemove.filter((dep) =>
      keywords.some((keyword) => new RegExp(keyword, "i").test(dep))
    );

    console.log(
      chalk.green(
        `Keywords have been corrected using regex and levenshtein distance. New keywords: ${onlyRemove.join(
          ", "
        )}\n`
      )
    );
  }

  // Log dependencies to be removed
  console.log(
    chalk.magenta(
      `The following dependencies will be removed using ${manager}:\n`
    )
  );
  onlyRemove.forEach((dep) => console.log(chalk.cyan(dep)));

  // Prompt user for confirmation if --force is not set, otherwise proceed
  if (options.force) {
    await proceedRemoval(manager, onlyRemove.length < 1 ? keywords : onlyRemove, options.retry, options.skipInUse);
  } else {
    const confirmation = await askConfirmation();

    if (confirmation) {
      await proceedRemoval(
        manager,
        onlyRemove.length < 1 ? keywords : onlyRemove,
        options.retry,
        options.skipInUse
      );
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

function escapeRegexString(str: string) {
  return str.replace(/[.*+?^=!:${}()|\[\]\/\\]/g, "\\$&");
}

function regexMatch(dep: string, keyword: string) {
  const escapedKeyword = escapeRegexString(keyword); // Escape special regex characters
  const regex = new RegExp(escapedKeyword, "i"); // 'i' makes it case-insensitive
  return regex.test(dep); // Test if the regex matches the dependency name
}

/**
 * Finds all dependencies in package.json that match any of the given keywords.
 *
 * @param packageJson The package.json object
 * @param keywords The keywords to search for
 * @returns An array of dependency names that match any of the given keywords
 */
function findDependencies(
  packageJson: JSON,
  keywords: string[],
  options: Options
) {
  const dependencies = Object.keys(packageJson.dependencies || {});
  const devDependencies = Object.keys(packageJson.devDependencies || {});

  const allDependencies = [...dependencies, ...devDependencies];

  if (options.regexMatching && options.fuzzMatching) {
    // first correct keywords using Levenshtein distance, then use regex matching on the corrected keywords
    const correctedKeywords = correctTyposWithLevenshteinDistance(keywords, packageJson);
    return [...dependencies, ...devDependencies].filter((dep) => {
      // Iterate over the corrected keywords and check if any regex pattern matches the dependency
      return correctedKeywords.some((keyword) => {
        try {
          // Create a RegExp object with the provided keyword pattern
          const regex = new RegExp(keyword, "i"); // "i" for case-insensitive matching
          return regex.test(dep); // Test if the dependency name matches the regex
        } catch (e) {
          console.error(chalk.red(`Invalid regex pattern: ${keyword}`));
          return false; // If the regex is invalid, return false
        }
      });
    });
  }

  if (options.regexMatching) {
    return [...dependencies, ...devDependencies].filter((dep) => {
      // Iterate over the keywords and check if any regex pattern matches the dependency
      return keywords.some((keyword) => {
        try {
          // Create a RegExp object with the provided keyword pattern
          const regex = new RegExp(keyword, "i"); // "i" for case-insensitive matching
          return regex.test(dep); // Test if the dependency name matches the regex
        } catch (e) {
          console.error(chalk.red(`Invalid regex pattern: ${keyword}`));
          return false; // If the regex is invalid, return false
        }
      });
    });
  }

  if (options.fuzzMatching) {
    // Get corrected keywords using Levenshtein distance
    const correctedKeywords = correctTyposWithLevenshteinDistance(keywords, packageJson);

    // Now return dependencies for all corrected keywords (including original and corrected ones)
    const allKeywords = [...keywords, ...correctedKeywords];

    // Filter dependencies based on any keyword (original or corrected)
    return allDependencies.filter((dep) => {
      return allKeywords.some((keyword) => dep.toLowerCase().includes(keyword.toLowerCase()));
    });
  }

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
  retries: number,
  skipInUse: boolean
) {
  const onlyRemove: string[] = [];

  if (skipInUse) {
    const depInUse = await checkInUse(dependencies); // Await for the result
    onlyRemove.concat(dependencies.filter((dep) => !depInUse.has(dep)));
    // show depenedencies that are in use and will not removed
    console.log(
      "Dependencies that are in use and are not be removed:\n" +
        chalk.red(Array.from(depInUse).join("\n"))
    );
  }

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
      const command = `${manager} remove ${(onlyRemove.length < 1 ? dependencies : onlyRemove).join(" ")}`;
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
