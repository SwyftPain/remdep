#!/usr/bin/env node
import { existsSync, readFileSync } from "fs";
import { createInterface } from "readline";
import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";

const execAsync = promisify(exec);

function displayHelp() {
  console.log(
    chalk.green(`
Usage: ${chalk.bold("remdep <keywords> [options]")}
Keywords should be comma-separated without spaces.
Options:
  ${chalk.blue("--help")}            Display this help message
  ${chalk.blue("--force")}           Remove dependencies without confirmation
  ${chalk.blue(
    "--retry <times>"
  )}   Retry the remove command on failure, specifying how many times to retry
Examples:
  ${chalk.yellow("remdep eslint,babel --force")}
  ${chalk.yellow("remdep react,vue --retry 3")}
    `)
  );
}

async function removeDependenciesContainingKeywords(
  keywords: string[],
  options: {
    force: boolean;
    retry: number;
    help: boolean;
    initialRetry: number;
  }
) {
  if (options.help || keywords.length === 0) {
    displayHelp();
    return;
  }

  if (
    keywords.some(
      (keyword) =>
        keyword !== undefined &&
        (keyword.trim() === "" || keyword.includes(" "))
    ) ||
    keywords.some((keyword) => keyword === undefined)
  ) {
    console.log(
      chalk.red(
        "Error: Keywords should be comma-separated without spaces or empty elements."
      )
    );
    return;
  }

  let manager = "npm"; // Default to npm if no lock file is found

  if (existsSync("package-lock.json")) {
    manager = "npm";
  } else if (existsSync("pnpm-lock.yaml")) {
    manager = "pnpm";
  } else if (existsSync("yarn.lock")) {
    manager = "yarn";
  } else if (existsSync("bun.lockb")) {
    manager = "bun";
  } else {
    console.log(
      chalk.yellow(
        "No lock file found, defaulting to npm as the package manager."
      )
    );
  }

  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const dependencies = Object.keys(packageJson.dependencies || {});
  const devDependencies = Object.keys(packageJson.devDependencies || {});
  const allDependencies = dependencies.concat(devDependencies);
  const filteredDependencies = allDependencies.filter((dep) =>
    keywords.some((keyword) => dep.includes(keyword))
  );

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

  const proceedRemoval = async (attempt = 1) => {
    try {
      console.log(
        chalk.magenta(
          `Removing dependencies using ${manager}. Attempt ${attempt} of ${
            options.initialRetry + 1
          }`
        )
      );
      const command = `${manager} remove ${filteredDependencies.join(" ")}`;
      const { stdout, stderr } = await execAsync(command);
      console.log(chalk.green(stdout));
      if (stderr) {
        console.error(chalk.red(stderr));
      }

      console.log(
        chalk.green(
          `Dependencies containing the specified keywords have been removed using ${manager}.`
        )
      );
    } catch (error) {
      console.error(chalk.red(`Error executing command: ${error}`));
      if (options.retry > 0) {
        console.log(
          chalk.yellow(
            `Retrying... Attempt ${attempt + 1} of ${options.initialRetry + 1}`
          )
        );
        options.retry--;
        await proceedRemoval(attempt + 1);
      }
    }
  };

  if (options.force) {
    await proceedRemoval();
  } else {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      chalk.blue("Do you want to proceed? (y/n): "),
      async (answer) => {
        rl.close();
        if (answer.toLowerCase() === "y") {
          await proceedRemoval();
        } else {
          console.log(chalk.yellow("Aborted."));
        }
      }
    );
  }
}

const args = process.argv.slice(2);
const keywordArg = args.find((arg) => !arg.startsWith("--"));
const keywords = keywordArg ? keywordArg.split(",").map((k) => k.trim()) : [];
const force = args.includes("--force");
const help = args.includes("--help");
const retryIndex = args.indexOf("--retry");
const retry = retryIndex !== -1 ? parseInt(args[retryIndex + 1], 10) : 0;

removeDependenciesContainingKeywords(
  keywords.length > 1 ? keywords : [keywords[0]],
  { force, help, retry, initialRetry: retry }
);
