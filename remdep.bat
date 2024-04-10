@echo off
setlocal enabledelayedexpansion

REM Check if argument is provided
if "%~1"=="" (
    echo Usage: %0 ^<keyword^>
    exit /b 1
)

REM Keyword to search for
set "keyword=%~1"

REM Check if package-lock.json, pnpm-lock.yaml, or yarn.lock exists
if exist "package-lock.json" (
    set "lockfile=package-lock.json"
    set "manager=npm"
) else if exist "pnpm-lock.yaml" (
    set "lockfile=pnpm-lock.yaml"
    set "manager=pnpm"
) else if exist "yarn.lock" (
    set "lockfile=yarn.lock"
    set "manager=yarn"
) else if exist "bun.lockb" (
    set "lockfile=bun.lockb"
    set "manager=bun"
) else (
    echo Error: Lockfile ^(package-lock.json, pnpm-lock.yaml, yarn.lock or bun.lockb^) not found in the current directory.
    exit /b 1
)

REM Get list of dependencies containing the keyword
for /f "tokens=*" %%a in ('jq -r ".dependencies | keys[]" package.json') do (
    set "dependencies=!dependencies! %%a"
)
for /f "tokens=*" %%a in ('jq -r ".devDependencies | keys[]" package.json') do (
    set "devDependencies=!devDependencies! %%a"
)

REM Combine dependencies and devDependencies
set "allDependencies=!dependencies! !devDependencies!"

REM Filter dependencies containing the keyword
set "filteredDependencies="
for %%a in (%allDependencies%) do (
    echo %%a | findstr /i /c:"%keyword%" >nul && set "filteredDependencies=!filteredDependencies! %%a"
)

REM Check if there are any dependencies to remove
if "!filteredDependencies!"=="" (
    echo No dependencies found containing the keyword '%keyword%'.
    exit /b 0
)

REM Confirm with the user before proceeding
echo The following dependencies will be removed:
for %%d in (%filteredDependencies%) do echo %%d
echo.
set /p "choice=Do you want to proceed? (y/n): "

if /i "%choice%" neq "y" (
    echo Aborted.
    exit /b 0
)

REM Construct the removal command with dependencies in a single line
set "dependenciesToRemove=!filteredDependencies:~1!"

REM Remove dependencies containing the keyword based on the detected package manager
if "%manager%"=="npm" (
    npm uninstall --save !dependenciesToRemove!
    echo Dependencies containing the keyword '%keyword%' have been removed using %manager%.
) else if "%manager%"=="pnpm" (
    pnpm remove !dependenciesToRemove!
    echo Dependencies containing the keyword '%keyword%' have been removed using %manager%.
) else if "%manager%"=="yarn" (
    yarn remove !dependenciesToRemove!
    echo Dependencies containing the keyword '%keyword%' have been removed using %manager%.
) else if "%manager%"=="bun" (
    bun remove !dependenciesToRemove!
    echo Dependencies containing the keyword '%keyword%' have been removed using %manager%.
)
