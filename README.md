# RemDep
### Remove dependencies based on keywords from a project easily and quickly

First, install it using:
```bash
npm install -g remdep
```

Then restart your terminal/command prompt.

Now you can use it like this:
```bash
remdep <keywords>
```

Replace ``<keywords>`` with the names of the packages you want to remove, separated by commas without spaces.

Alternatively, you can use it like this:
```bash
npx remdep <keywords>
```

## Optional

You can pass flags:

``--force`` to remove the confirmation prompt.
``--retry <#>`` to specify how many times to retry in case of an error.
``--help`` to print help information.
``--version`` to print the version.

## Examples:

Removing a single package:
```bash
remdep eslint
```

Removing multiple packages:
```bash
remdep eslint,babel
```

Using force and retry options:
```bash
remdep react,vue --force --retry 3
```

## Gotchas

If no lock file is found (package-lock.json, pnpm-lock.yaml, yarn.lock, or bun.lockb), it will default to using npm as the package manager.

It will remove the specified dependencies based on the keywords and can handle multiple packages simultaneously. Note that if a keyword does not match any dependency, no action will be taken for that keyword.

## Updates

Now supports multiple keywords: You can pass multiple keywords separated by commas to remove multiple dependencies in one go.

## TODO

+ ### Dependency Impact Analysis
Find if the dependency is being used anywhere in the project and warn upon attempted removal. 

Optional with a flag.

+ ### Multi-Keyword Matching
Add regex as a matching option for power users. (Possible complications with the way keywords are being split at the moment).

Optional with a flag.

+ ### Backup Option
Add an option that creates a backup of the current package.json before removal. Afterwards, provide an option to restore and reinstall packages using preferred package manager.

Optional with a flag.

+ ### Skip used
Skip matching dependencies if they are currently being used/imported in a project.

Optional with a flag.

## Example

![Screenshot Of The App In Action](https://i.imgur.com/cZqY2kt.png)