# RemDep
### Remove dependencies based on a keyword from a project easy and fast

Do you find it annoying when frameworks include packages you do not want and there is like 5 or more related packages? 
Uninstalling them yourself manually takes time to copy/paste each one, one by one. 

Speed up the process and remove them all at once using a keyword.

This repo contains two files:

## Windows
``remdep.bat``

## Linux/Mac
``remdep.sh``

# Install

## Windows

Create a folder and put ``remdep.bat`` into it.

Open environment variables and add a folder to your ``PATH``.

Restart command prompt or powershell and in any project containing ``package.json``, you can run:
``remdep <keyword>``

And it will remove all the packages containing that keyword.

## Linux/Mac

Download ``remdep.sh`` file.

Execute following commands from the folder where you downloaded ``remdep.sh``:

1. ``sudo mv remdep.sh /usr/local/bin/remdep``
2. ``sudo chmod +x /usr/local/bin/remdep``

Restart your terminal or source your .bashrc and in any project containing ``package.json``, you can run:
``remdep <keyword>``

And it will remove all the packages containing that keyword.

# Source Bash

``source ~/.bashrc``

# Dependencies

This package is dependent on JQ on all platforms for parsing JSON.

# Note

It automatically detects package manager you used, be it ``npm``, ``yarn``, ``pnpm`` or ``bun`` and it uses that package manager to uninstall the commands.

# Warning

Due to it being a keyword based, you may run into an issue where a package you dont want to uninstall does appear in the list of packages about to be uninstalled.
In such cases, i recommend doing it manually still or making a PR.

This is mainly made as a starting point, when you install a new framework, to get rid of the extra packages you may not want.
What i used as a test when making this and what worked perfectly, was an example removing ``eslint`` from ``vite + react (typescript)`` project.
