import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = join(import.meta.dirname, "../../..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = join(root, "src", specifier.slice(2));
      const candidate = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find(
        (path) => existsSync(path),
      );
      if (candidate) return nextResolve(pathToFileURL(candidate).href, context);
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !/\.(ts|tsx|js|mjs|cjs|json)$/.test(specifier)
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
