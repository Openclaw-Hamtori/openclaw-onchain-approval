#!/usr/bin/env node

import { authorizeActionExecution } from "../../src/index.js";
import {
  assertNoPositionals,
  parseArgs,
  printUsage,
  readJson,
  requireArg,
} from "./shared.js";

const USAGE = [
  "Usage:",
  "  node ./examples/openclaw-hooks/gate-action.js --action <action.json> --policy <policy.json> [--receipt <receipt.json>] [--now <iso-time>]",
];

try {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage(USAGE);
    process.exit(0);
  }

  assertNoPositionals(args);

  const result = authorizeActionExecution({
    action: readJson(requireArg(args, "action")),
    policy: readJson(requireArg(args, "policy")),
    receipt: typeof args.receipt === "string" ? readJson(args.receipt) : undefined,
    now: typeof args.now === "string" ? args.now : undefined,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.allowed ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  printUsage(USAGE);
  process.exit(1);
}
