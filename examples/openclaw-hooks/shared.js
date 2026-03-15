import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function parseArgs(argv) {
  const args = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = value;
    index += 1;
  }

  return args;
}

export function assertNoPositionals(args) {
  if (args._.length > 0) {
    throw new Error(`Unexpected token: ${args._[0]}`);
  }
}

export function requireArg(args, key) {
  const value = args[key];

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing --${key}`);
  }

  return value;
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readText(path) {
  return readFileSync(path, "utf8");
}

export function writeJson(path, value) {
  const outputPath = resolve(path);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");

  return outputPath;
}

export function printUsage(lines) {
  console.error(lines.join("\n"));
}
