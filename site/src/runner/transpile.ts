import { transform } from "sucrase";

/**
 * Transpile the editor's TypeScript to runnable JS for the sandbox.
 *
 * The preview injects the gamekit API into scope, so editor code is import-free;
 * we also strip any stray top-level `import` lines a user might add (they'd throw
 * in the `new Function` sandbox). Sucrase only strips types — no down-leveling,
 * no type-checking — which is exactly what a live editor wants.
 */
export function tsToJs(code: string): string {
  const withoutImports = code.replace(/^\s*import\s.*$/gm, "");
  try {
    return transform(withoutImports, {
      transforms: ["typescript"],
      disableESTransforms: true,
    }).code;
  } catch (err) {
    // Surface syntax errors as a thrown Error the caller can display.
    throw new Error(err instanceof Error ? err.message : String(err));
  }
}
