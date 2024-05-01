#!/usr/bin/env node
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { createInterface } from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function displayHelp() {
    console.log(`
Usage: remdep <keyword> [options]
Options:
  --help            Display this help message
  --force           Remove dependencies without confirmation
  --retry <times>   Retry the remove command on failure, specifying how many times to retry
Examples:
  remdep eslint --force
  remdep eslint --retry 3
    `);
}

async function removeDependenciesContainingKeyword(keyword: string, options: { force: boolean, retry: number, help: boolean }) {
    if (!keyword || options.help) {
        displayHelp();
        return;
    }

    let manager = 'npm';  // Default to npm if no lock file is found

    if (existsSync('package-lock.json')) {
        manager = 'npm';
    } else if (existsSync('pnpm-lock.yaml')) {
        manager = 'pnpm';
    } else if (existsSync('yarn.lock')) {
        manager = 'yarn';
    } else if (existsSync('bun.lockb')) {
        manager = 'bun';
    }

    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const dependencies = Object.keys(packageJson.dependencies || {});
    const devDependencies = Object.keys(packageJson.devDependencies || {});
    const allDependencies = dependencies.concat(devDependencies);
    const filteredDependencies = allDependencies.filter(dep => dep.includes(keyword));

    if (filteredDependencies.length === 0) {
        console.log(`No dependencies found containing the keyword '${keyword}'.`);
        return;
    }

    console.log('The following dependencies will be removed:');
    filteredDependencies.forEach(dep => console.log(dep));

    const proceedRemoval = async () => {
        try {
            const command = `${manager} remove ${filteredDependencies.join(' ')}`;
            const { stdout, stderr } = await execAsync(command);
            console.log(stdout);
            console.error(stderr);

            if (keyword === 'eslint' && existsSync('.eslintrc.cjs')) {
                unlinkSync('.eslintrc.cjs');
                console.log('.eslintrc.cjs file has been removed.');
            }

            console.log(`Dependencies containing the keyword '${keyword}' have been removed using ${manager}.`);
        } catch (error) {
            console.error(`Error executing command: ${error}`);
            if (options.retry > 0) {
                console.log(`Retrying... Attempts left: ${options.retry}`);
                options.retry--;
                await proceedRemoval();
            }
        }
    };

    if (options.force) {
        await proceedRemoval();
    } else {
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('Do you want to proceed? (y/n): ', async (answer) => {
            rl.close();
            if (answer.toLowerCase() === 'y') {
                await proceedRemoval();
            } else {
                console.log('Aborted.');
            }
        });
    }
}

const args = process.argv.slice(2);
const keyword = args.find(arg => !arg.startsWith('--'));
const force = args.includes('--force');
const help = args.includes('--help');
const retryIndex = args.indexOf('--retry');
const retry = retryIndex !== -1 ? parseInt(args[retryIndex + 1], 10) : 0;

if (!keyword) {
    console.error('Error: No keyword specified.');
    process.exit(1);
}

removeDependenciesContainingKeyword(keyword, { force, help, retry });
