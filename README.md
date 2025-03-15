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

``--dry-run`` to show which packages would be removed without removing them.

``--dependency-impact`` to show which packages are imported and in use (likely shouldn't be deleted).

``--fuzz-matching`` to do fuzzy matching.

``--backup`` to backup your package.json file.

``--restore`` to restore your previous package.json file.

``--skip-in-use`` to skip dependencies that are in use from being deleted.

``--retry <#>`` to specify how many times to retry in case of an error.

``--regex-matching`` to search using regex.

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

Added a lot more flags and implemented their features.

## TODO

+ ### To be decided

## Example

![Screenshot Of The App In Action](https://i.imgur.com/cZqY2kt.png)