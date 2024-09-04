#!/usr/bin/env node

import { existsSync, readFileSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import { Command } from "commander";
import { createInterface } from "readline";

const execAsync = promisify(exec);
const program = new Command();

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
  .helpOption("-h, --help", "Display help for command")
  .action(
    async (
      keywords: string,
      options: {
        force: boolean;
        retry: number;
        help: boolean;
        initialRetry: number;
      }
    ) => {
      const keywordList = keywords.split(",").map((k) => k.trim());

      if (keywordList.some((k) => k === "")) {
        console.error(
          chalk.red(
            "Error: Keywords should be comma-separated without spaces or empty elements."
          )
        );
        process.exit(1);
      }

      await removeDependenciesContainingKeywords(keywordList, options);
    }
  );

program.parse(process.argv);

async function removeDependenciesContainingKeywords(
  keywords: string[],
  options: {
    force: boolean;
    retry: number;
    help: boolean;
    initialRetry: number;
  }
) {
  const manager = detectPackageManager();
  if (!manager) {
    console.error(
      chalk.red(
        "Error: No package manager lock file found. Ensure you are in a Node.js project directory."
      )
    );
    process.exit(1);
  }

  const packageJson = loadPackageJson();
  if (!packageJson) {
    console.error(
      chalk.red("Error: No package.json file found in the current directory.")
    );
    process.exit(1);
  }

  const filteredDependencies = findDependencies(packageJson, keywords);

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

  console.log(chalk.magenta("The following dependencies will be removed:"));
  filteredDependencies.forEach((dep) => console.log(chalk.cyan(dep)));

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

function loadPackageJson() {
  try {
    return JSON.parse(readFileSync("package.json", "utf8"));
  } catch (error) {
    return null;
  }
}

interface Deps {
  [key: string]: string;
}

interface JSON {
  dependencies: Deps;
  devDependencies: Deps;
}

function findDependencies(packageJson: JSON, keywords: string[]) {
  const dependencies = Object.keys(packageJson.dependencies || {});
  const devDependencies = Object.keys(packageJson.devDependencies || {});
  return [...dependencies, ...devDependencies].filter((dep) =>
    keywords.some((keyword) => dep.includes(keyword))
  );
}

async function proceedRemoval(
  manager: string,
  dependencies: string[],
  retries: number
) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      console.log(
        chalk.magenta(
          `Removing dependencies using ${manager}. Attempt ${attempt} of ${
            retries + 1
          }`
        )
      );
      const command = `${manager} remove ${dependencies.join(" ")}`;
      const { stdout, stderr } = await execAsync(command);
      console.log(chalk.green(stdout));
      if (stderr) console.error(chalk.red(stderr));
      console.log(chalk.green("Dependencies removed successfully."));
      break;
    } catch (error) {
      console.error(chalk.red(`Error executing command: ${error}`));
      if (attempt > retries) throw error;
      console.log(
        chalk.yellow(`Retrying... Attempt ${attempt + 1} of ${retries + 1}`)
      );
    }
  }
}

function askConfirmation() {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(chalk.blue("Do you want to proceed? (y/n): "), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}
