#!/usr/bin/env node

import { readFileSync } from "node:fs";

import { evaluateApprovalRequirement, verifyApprovalReceipt } from "../src/index.js";

function usage() {
  console.error(
    [
      "Usage:",
      "  openclaw-approval evaluate --action <action.json> [--policy <policy.json>]",
      "  openclaw-approval verify --receipt <receipt.json> [--action <action.json>] [--now <iso-time>]",
    ].join("\n"),
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected token: ${token}`);
    }

    const key = token.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

const [command, ...rest] = process.argv.slice(2);

try {
  if (command === "evaluate") {
    const args = parseArgs(rest);

    if (!args.action) {
      throw new Error("evaluate requires --action");
    }

    const action = readJson(args.action);
    const policy = args.policy ? readJson(args.policy) : {};
    const result = evaluateApprovalRequirement(action, policy);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  if (command === "verify") {
    const args = parseArgs(rest);

    if (!args.receipt) {
      throw new Error("verify requires --receipt");
    }

    const receipt = readJson(args.receipt);
    const action = args.action ? readJson(args.action) : undefined;
    const result = verifyApprovalReceipt({ receipt, action, now: args.now });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  usage();
  process.exit(command ? 1 : 0);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  usage();
  process.exit(1);
}
