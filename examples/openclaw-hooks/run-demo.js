import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dirname, "..");
const workspaceDir = mkdtempSync(join(tmpdir(), "openclaw-approval-demo-"));

function runStep(title, scriptName, args, expectedStatus = 0) {
  console.log(`\n${title}`);

  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    encoding: "utf8",
  });

  if (result.stdout.trim() !== "") {
    console.log(result.stdout.trim());
  }

  if (result.stderr.trim() !== "") {
    console.error(result.stderr.trim());
  }

  if (result.status !== expectedStatus) {
    throw new Error(`${scriptName} exited with status ${result.status}`);
  }
}

console.log("OpenClaw local hook workflow demo");
console.log(`Artifacts will be written to: ${workspaceDir}`);

runStep("1. Evaluate the candidate action before execution", "preflight-evaluate.js", [
  "--action",
  join(examplesDir, "demo-action.json"),
  "--policy",
  join(examplesDir, "policies", "balanced.json"),
  "--decision-out",
  join(workspaceDir, "decision.json"),
]);

runStep("2. Create a signed local approval receipt", "issue-receipt.js", [
  "--action",
  join(examplesDir, "demo-action.json"),
  "--policy",
  join(examplesDir, "policies", "balanced.json"),
  "--private-key",
  join(examplesDir, "demo-approver-private.pem"),
  "--context",
  join(__dirname, "openclaw-context.json"),
  "--receipt-out",
  join(workspaceDir, "receipt.json"),
  "--issued-at",
  "2026-03-15T09:00:00.000Z",
  "--expires-at",
  "2026-03-15T09:15:00.000Z",
  "--approver-label",
  "OpenClaw demo approver",
]);

runStep("3. Gate execution on the signed receipt", "gate-action.js", [
  "--action",
  join(examplesDir, "demo-action.json"),
  "--policy",
  join(examplesDir, "policies", "balanced.json"),
  "--receipt",
  join(workspaceDir, "receipt.json"),
  "--now",
  "2026-03-15T09:05:00.000Z",
]);

console.log(`\nDemo complete. Inspect ${workspaceDir} for the decision and receipt artifacts.`);
