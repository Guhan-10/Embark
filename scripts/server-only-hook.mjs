// Lets command-line scripts import server code: `server-only` only allows React Server Components,
// so resolve it to an empty module here (the same thing the tests do).
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
        return next(specifier, context);
      }`),
);
