# OpenClaw Onchain Approval

OpenClaw-first, local-first approval primitive for high-risk blockchain payment actions.

이 MVP는 "에이전트가 온체인 액션을 실행하기 전에, 어떤 액션이 승인 대상인지 판정하고, 사람이 서명한 approval receipt가 있어야만 실행되게 만드는 것"에 집중한다.

## What shipped

- local Node.js package / reference implementation
- EVM-oriented action model for:
  - `native_transfer`
  - `erc20_transfer`
  - `erc20_approve`
  - `swap`
  - `contract_call`
- local policy engine that decides whether approval is required
- signed approval receipt format using local Ed25519 approver keys
- receipt verification utility:
  - library: `verifyApprovalReceipt(...)`
  - CLI: `openclaw-approval verify ...`
- OpenClaw integration example for a full local approval flow

## MVP primitive

The narrowest compelling primitive here is:

`OpenClaw wants to expand ERC-20 allowance to a new spender.`

That is a real onchain risk surface with strong security value:

- unknown spender interactions are dangerous
- unlimited allowance is dangerous
- this can be checked locally before execution
- the approval can be captured as a portable signed receipt

The SDK also supports other action shapes, but the demo and tests center on this approval-risk case.

## Why this shape

- no always-on server
- operating cost = 0
- fixed cost = 0
- no hosted SaaS
- no fiat or regulated rails
- no multi-chain production sprawl

Everything runs locally as a package, example script, and CLI.

## Package layout

- `src/normalize.js`: normalize and hash onchain actions
- `src/policy.js`: local approval-required policy model
- `src/receipt.js`: signed approval receipt creation + verification
- `src/gate.js`: execution gate that blocks until receipt verification passes
- `bin/openclaw-approval.js`: local CLI for `evaluate` and `verify`
- `examples/openclaw-flow.js`: OpenClaw-style sample flow
- `tests/*.test.js`: deterministic local tests

## Local usage

```bash
npm test
npm run example
node ./bin/openclaw-approval.js evaluate --action ./examples/demo-action.json --policy ./examples/demo-policy.json
```

`npm run example` walks this flow:

1. OpenClaw proposes an `erc20_approve` action.
2. The local policy marks it as approval-required.
3. A human approver signs a receipt locally.
4. The execution gate verifies the receipt and only then allows the action.

## SDK example

```js
import {
  authorizeActionExecution,
  createApprovalReceipt,
  evaluateApprovalRequirement,
} from "@openclaw/onchain-approval";

const decision = evaluateApprovalRequirement(action, policy);

if (decision.approvalRequired) {
  const receipt = createApprovalReceipt({
    action,
    decision,
    privateKeyPem,
    approver: { label: "Local finance approver" },
  });

  const gate = authorizeActionExecution({ action, policy, receipt });
  if (!gate.allowed) {
    throw new Error(gate.reason);
  }
}
```

## Receipt format

Receipt body fields:

- `version`
- `receiptId`
- `action`
- `actionDigest`
- `issuedAt`
- `expiresAt`
- `decision`
- `approver`
- `context`
- `signature`

Important properties:

- the action is normalized into canonical JSON before hashing
- the receipt binds to the exact action digest
- modifying the action invalidates verification
- expired receipts fail verification

## CLI verification utility

Verify a stored receipt against an action payload:

```bash
openclaw-approval verify \
  --receipt ./receipt.json \
  --action ./examples/demo-action.json \
  --now 2026-03-15T09:05:00.000Z
```

Evaluate whether a local action requires approval:

```bash
openclaw-approval evaluate \
  --action ./examples/demo-action.json \
  --policy ./examples/demo-policy.json
```

## OpenClaw integration path

This MVP assumes OpenClaw does three local calls:

1. Normalize the candidate onchain action.
2. Evaluate local policy.
3. If approval is required, block execution until a signed receipt is attached and verified.

No remote coordinator is required.

## Non-goals in this MVP

- wallet UX
- hosted approval dashboards
- onchain attestation registry
- multi-chain routing abstraction
- fiat rails
- exchange integrations

## Next likely upgrades

- wallet-native signatures in addition to local approver keys
- optional onchain anchoring of receipt digests
- richer rule packs per protocol / spender class
