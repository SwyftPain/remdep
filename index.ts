#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import { createInterface } from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function removeDependenciesContainingKeyword(keyword: string) {
    if (!keyword) {
        console.error('Usage: remdep <keyword>');
        process.exit(1);
    }

    let manager: string | undefined;

    if (existsSync('package-lock.json')) {
        manager = 'npm';
    } else if (existsSync('pnpm-lock.yaml')) {
        manager = 'pnpm';
    } else if (existsSync('yarn.lock')) {
        manager = 'yarn';
    } else if (existsSync('bun.lockb')) {
        manager = 'bun';
    } else {
        console.error('Error: Lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock, or bun.lockb) not found in the current directory.');
        process.exit(1);
    }

    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const dependencies = Object.keys(packageJson.dependencies || {});
    const devDependencies = Object.keys(packageJson.devDependencies || {});
    const allDependencies = dependencies.concat(devDependencies);
    const filteredDependencies = allDependencies.filter(dep => dep.includes(keyword));

    if (filteredDependencies.length === 0) {
        console.log(`No dependencies found containing the keyword '${keyword}'.`);
        process.exit(0);
    }

    console.log('The following dependencies will be removed:');
    filteredDependencies.forEach(dep => console.log(dep));

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Do you want to proceed? (y/n): ', async (answer) => {
        rl.close();
        if (answer.toLowerCase() !== 'y') {
            console.log('Aborted.');
            process.exit(0);
        }

        try {
            const command = `${manager} remove ${filteredDependencies.join(' ')}`;
            const { stdout, stderr } = await execAsync(command);
            console.log(stdout);
            console.error(stderr);
            console.log(`Dependencies containing the keyword '${keyword}' have been removed using ${manager}.`);
        } catch (error) {
            console.error(`Error executing command: ${error}`);
            process.exit(1);
        }
    });
}

const keyword = process.argv[2];
removeDependenciesContainingKeyword(keyword);

export { removeDependenciesContainingKeyword };