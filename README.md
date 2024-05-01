# RemDep
### Remove dependencies based on a keyword from a project easy and fast

First install it using:
``npm install -g remdep``

Then restart your terminal/command prompt.

Now you can use it like this:
``remdep <keyword>``

Replace ``<keyword>`` with the name of the package you want to remove.

Alternatively, you can use it like this:
``npx remdep <keyword>``

## Gotcha's

This will use your preferred package manager based on the lock file.

That means you need to have a lock file before using it.

The upside to this is that it will remove dependencies much faster.