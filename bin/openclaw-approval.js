#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  authorizeActionExecution,
  createApprovalReceipt,
  evaluateApprovalRequirement,
  generateApprovalKeyPair,
  getPolicyPreset,
  listPolicyPresets,
  verifyApprovalReceipt,
} from "../src/index.js";

const GENERAL_USAGE = [
  "Usage:",
  "  openclaw-approval presets [--name <preset>] [--output <policy.json>] [--force]",
  "  openclaw-approval keygen [--private-key-out <private.pem>] [--public-key-out <public.pem>] [--force]",
  "  openclaw-approval evaluate --action <action.json> [--policy <policy.json> | --policy-preset <preset>] [--output <decision.json>] [--force]",
  "  openclaw-approval issue --action <action.json> --private-key <private.pem> [--policy <policy.json> | --policy-preset <preset>] [--public-key <public.pem>] [--receipt-out <receipt.json>] [--context <context.json>] [--approver-label <label>] [--issued-at <iso-time>] [--expires-at <iso-time>] [--force]",
  "  openclaw-approval gate --action <action.json> [--policy <policy.json> | --policy-preset <preset>] [--receipt <receipt.json>] [--now <iso-time>] [--output <result.json>] [--force]",
  "  openclaw-approval verify --receipt <receipt.json> [--action <action.json>] [--now <iso-time>] [--output <result.json>] [--force]",
];

function usage() {
  console.error(GENERAL_USAGE.join("\n"));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readText(path) {
  return readFileSync(path, "utf8");
}

function writeText(path, value, force = false) {
  const outputPath = resolve(path);

  if (existsSync(outputPath) && !force) {
    throw new Error(`${outputPath} already exists; pass --force to overwrite`);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, value, "utf8");

  return outputPath;
}

function writeJson(path, value, force = false) {
  return writeText(path, `${JSON.stringify(value, null, 2)}\n`, force);
}

function parseArgs(argv) {
  const parsed = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function assertNoPositionals(args) {
  if (args._.length > 0) {
    throw new Error(`Unexpected token: ${args._[0]}`);
  }
}

function loadPolicy(args) {
  if (args.policy && args["policy-preset"]) {
    throw new Error("Use either --policy or --policy-preset, not both");
  }

  if (args.policy) {
    return readJson(args.policy);
  }

  if (args["policy-preset"]) {
    return getPolicyPreset(String(args["policy-preset"])).policy;
  }

  return {};
}

function emitJson(value, outputPath, force) {
  if (outputPath) {
    const writtenPath = writeJson(outputPath, value, force);
    console.log(
      JSON.stringify(
        {
          written: true,
          outputPath: writtenPath,
        },
        null,
        2,
      ),
    );
    return writtenPath;
  }

  console.log(JSON.stringify(value, null, 2));
  return null;
}

const [command, ...rest] = process.argv.slice(2);

try {
  if (!command || command === "help") {
    usage();
    process.exit(0);
  }

  const args = parseArgs(rest);
  assertNoPositionals(args);

  if (args.help) {
    usage();
    process.exit(0);
  }

  if (command === "presets") {
    if (args.name) {
      const preset = getPolicyPreset(String(args.name));

      if (args.output) {
        const outputPath = writeJson(args.output, preset.policy, Boolean(args.force));
        console.log(
          JSON.stringify(
            {
              name: preset.name,
              description: preset.description,
              outputPath,
            },
            null,
            2,
          ),
        );
      } else {
        console.log(JSON.stringify(preset, null, 2));
      }
    } else {
      console.log(
        JSON.stringify(
          listPolicyPresets().map(({ name, description }) => ({
            name,
            description,
          })),
          null,
          2,
        ),
      );
    }

    process.exit(0);
  }

  if (command === "keygen") {
    const keys = generateApprovalKeyPair();

    if (args["private-key-out"] || args["public-key-out"]) {
      const summary = {
        written: true,
      };

      if (args["private-key-out"]) {
        summary.privateKeyPath = writeText(
          args["private-key-out"],
          keys.privateKeyPem,
          Boolean(args.force),
        );
      }

      if (args["public-key-out"]) {
        summary.publicKeyPath = writeText(
          args["public-key-out"],
          keys.publicKeyPem,
          Boolean(args.force),
        );
      }

      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(JSON.stringify(keys, null, 2));
    }

    process.exit(0);
  }

  if (command === "evaluate") {
    if (!args.action) {
      throw new Error("evaluate requires --action");
    }

    const action = readJson(args.action);
    const policy = loadPolicy(args);
    const result = evaluateApprovalRequirement(action, policy);
    emitJson(result, args.output === true ? undefined : args.output, Boolean(args.force));
    process.exit(0);
  }

  if (command === "issue") {
    if (!args.action) {
      throw new Error("issue requires --action");
    }

    if (!args["private-key"]) {
      throw new Error("issue requires --private-key");
    }

    const action = readJson(args.action);
    const policy = loadPolicy(args);
    const decision = evaluateApprovalRequirement(action, policy);

    if (!decision.approvalRequired) {
      console.log(
        JSON.stringify(
          {
            created: false,
            reason: "approval_not_required",
            decision,
          },
          null,
          2,
        ),
      );
      process.exit(0);
    }

    const receipt = createApprovalReceipt({
      action,
      decision,
      privateKeyPem: readText(args["private-key"]),
      publicKeyPem: args["public-key"] ? readText(args["public-key"]) : undefined,
      approver:
        args["approver-label"] === undefined
          ? undefined
          : {
              label: String(args["approver-label"]),
            },
      issuedAt: args["issued-at"] === true ? undefined : args["issued-at"],
      expiresAt: args["expires-at"] === true ? undefined : args["expires-at"],
      context: args.context ? readJson(args.context) : undefined,
    });

    if (args["receipt-out"]) {
      const receiptPath = writeJson(args["receipt-out"], receipt, Boolean(args.force));
      console.log(
        JSON.stringify(
          {
            created: true,
            receiptId: receipt.receiptId,
            actionDigest: receipt.actionDigest,
            expiresAt: receipt.expiresAt,
            receiptPath,
            decision,
          },
          null,
          2,
        ),
      );
    } else {
      console.log(JSON.stringify(receipt, null, 2));
    }

    process.exit(0);
  }

  if (command === "gate") {
    if (!args.action) {
      throw new Error("gate requires --action");
    }

    const action = readJson(args.action);
    const policy = loadPolicy(args);
    const receipt = args.receipt ? readJson(args.receipt) : undefined;
    const result = authorizeActionExecution({
      action,
      policy,
      receipt,
      now: args.now === true ? undefined : args.now,
    });

    emitJson(result, args.output === true ? undefined : args.output, Boolean(args.force));
    process.exit(result.allowed ? 0 : 1);
  }

  if (command === "verify") {
    if (!args.receipt) {
      throw new Error("verify requires --receipt");
    }

    const receipt = readJson(args.receipt);
    const action = args.action ? readJson(args.action) : undefined;
    const result = verifyApprovalReceipt({
      receipt,
      action,
      now: args.now === true ? undefined : args.now,
    });
    emitJson(result, args.output === true ? undefined : args.output, Boolean(args.force));
    process.exit(result.ok ? 0 : 1);
  }

  usage();
  process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  usage();
  process.exit(1);
}
