# OpenClaw Hook Workflow Example

This folder shows a practical local integration path for OpenClaw-style execution hooks.

## Flow

1. `preflight-evaluate.js`
   - evaluates the action against a local policy file
   - writes a policy decision artifact
2. `issue-receipt.js`
   - simulates a local human approver signing a receipt
   - writes the signed receipt artifact
3. `gate-action.js`
   - blocks execution until the receipt verifies and matches the current policy decision

## Fastest run

```bash
npm run demo
```

## Direct commands

```bash
node ./examples/openclaw-hooks/preflight-evaluate.js \
  --action ./examples/demo-action.json \
  --policy ./examples/policies/balanced.json \
  --decision-out /tmp/openclaw-decision.json

node ./examples/openclaw-hooks/issue-receipt.js \
  --action ./examples/demo-action.json \
  --policy ./examples/policies/balanced.json \
  --private-key ./examples/demo-approver-private.pem \
  --context ./examples/openclaw-hooks/openclaw-context.json \
  --receipt-out /tmp/openclaw-receipt.json

node ./examples/openclaw-hooks/gate-action.js \
  --action ./examples/demo-action.json \
  --policy ./examples/policies/balanced.json \
  --receipt /tmp/openclaw-receipt.json \
  --now 2026-03-15T09:05:00.000Z
```
