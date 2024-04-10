#!/bin/bash

# Check if argument is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <keyword>"
    exit 1
fi

# Keyword to search for
keyword=$1

# Check if package-lock.json, pnpm-lock.yaml, or yarn.lock exists
if [ -f "package-lock.json" ]; then
    lockfile="package-lock.json"
    manager="npm"
elif [ -f "pnpm-lock.yaml" ]; then
    lockfile="pnpm-lock.yaml"
    manager="pnpm"
elif [ -f "yarn.lock" ]; then
    lockfile="yarn.lock"
    manager="yarn"
elif [ -f "bun.lockb" ]; then
    lockfile="bun.lockb"
    manager="bun"
else
    echo "Error: Lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock or bun.lockb) not found in the current directory."
    exit 1
fi

# Get list of dependencies containing the keyword
dependencies=$(jq -r '.dependencies | keys[]' package.json)
devDependencies=$(jq -r '.devDependencies | keys[]' package.json)

# Combine dependencies and devDependencies
allDependencies="$dependencies $devDependencies"

# Filter dependencies containing the keyword
filteredDependencies=$(echo "$allDependencies" | grep "$keyword")

# Check if there are any dependencies to remove
if [ -z "$filteredDependencies" ]; then
    echo "No dependencies found containing the keyword '$keyword'."
    exit 0
fi

# Confirm with the user before proceeding
echo "The following dependencies will be removed:"
echo "$filteredDependencies"
echo # Add a new line for better readability
read -p "Do you want to proceed? (y/n): " choice

if [ "$choice" != "y" ]; then
    echo "Aborted."
    exit 0
fi

# Construct the removal command with dependencies in a single line
dependenciesToRemove=$(echo "$filteredDependencies" | tr '\n' ' ' | sed 's/ *$//')

# Remove dependencies containing the keyword based on the detected package manager
if [ "$manager" == "npm" ]; then
    npm uninstall --save $dependenciesToRemove
elif [ "$manager" == "pnpm" ]; then
    pnpm remove $dependenciesToRemove
elif [ "$manager" == "yarn" ]; then
    yarn remove $dependenciesToRemove
elif [ "$manager" == "bun" ]; then
    bun remove $dependenciesToRemove
fi

echo "Dependencies containing the keyword '$keyword' have been removed using $manager."
