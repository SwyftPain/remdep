interface Deps {
  [key: string]: string;
}

interface JSON {
  dependencies: Deps;
  devDependencies: Deps;
}

interface Options {
  force: boolean;
  retry: number;
  help: boolean;
  initialRetry: number;
  dryRun: boolean;
  dependencyImpact: boolean;
  fuzzMatching: boolean;
  backup: boolean;
  restore: boolean;
  skipInUse: boolean;
  regexMatching: boolean;
}

export type { Deps, JSON, Options };
