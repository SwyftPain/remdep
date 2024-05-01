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
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const readline_1 = require("readline");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
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
function removeDependenciesContainingKeyword(keyword, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!keyword || options.help) {
            displayHelp();
            return;
        }
        let manager = 'npm'; // Default to npm if no lock file is found
        if ((0, fs_1.existsSync)('package-lock.json')) {
            manager = 'npm';
        }
        else if ((0, fs_1.existsSync)('pnpm-lock.yaml')) {
            manager = 'pnpm';
        }
        else if ((0, fs_1.existsSync)('yarn.lock')) {
            manager = 'yarn';
        }
        else if ((0, fs_1.existsSync)('bun.lockb')) {
            manager = 'bun';
        }
        const packageJson = JSON.parse((0, fs_1.readFileSync)('package.json', 'utf8'));
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
        const proceedRemoval = () => __awaiter(this, void 0, void 0, function* () {
            try {
                const command = `${manager} remove ${filteredDependencies.join(' ')}`;
                const { stdout, stderr } = yield execAsync(command);
                console.log(stdout);
                console.error(stderr);
                if (keyword === 'eslint' && (0, fs_1.existsSync)('.eslintrc.cjs')) {
                    (0, fs_1.unlinkSync)('.eslintrc.cjs');
                    console.log('.eslintrc.cjs file has been removed.');
                }
                console.log(`Dependencies containing the keyword '${keyword}' have been removed using ${manager}.`);
            }
            catch (error) {
                console.error(`Error executing command: ${error}`);
                if (options.retry > 0) {
                    console.log(`Retrying... Attempts left: ${options.retry}`);
                    options.retry--;
                    yield proceedRemoval();
                }
            }
        });
        if (options.force) {
            yield proceedRemoval();
        }
        else {
            const rl = (0, readline_1.createInterface)({
                input: process.stdin,
                output: process.stdout
            });
            rl.question('Do you want to proceed? (y/n): ', (answer) => __awaiter(this, void 0, void 0, function* () {
                rl.close();
                if (answer.toLowerCase() === 'y') {
                    yield proceedRemoval();
                }
                else {
                    console.log('Aborted.');
                }
            }));
        }
    });
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
