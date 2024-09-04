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
}

export type { Deps, JSON, Options };
