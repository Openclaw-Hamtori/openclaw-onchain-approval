# OpenClaw Onchain Approval

OpenClaw-first, local-first approval kit for high-risk blockchain payment actions.

이 패키지는 에이전트가 온체인 결제/자산 이동 액션을 실행하기 전에, 로컬 정책으로 approval-required 여부를 판정하고 사람이 서명한 approval receipt가 있어야만 실행되게 만든다. 서버, 백엔드, SaaS 없이 패키지와 로컬 파일만으로 동작한다.

## Milestone

This repo has moved past the initial MVP primitive into an operator-ready local workflow:

- local CLI for `presets`, `keygen`, `evaluate`, `issue`, `gate`, and `verify`
- sample policy files for `strict`, `balanced`, and `trusted-desk` risk postures
- OpenClaw hook-style example workflow with runnable scripts and artifact outputs
- stronger execution-gate validation so a signed receipt must match the current policy decision, not just the action digest

## Why this exists

The narrowest compelling wedge is still the same:

`OpenClaw wants to expand ERC-20 allowance to a new spender.`

That is a real payment risk surface with strong security value:

- unknown spender interactions are dangerous
- unlimited allowances are dangerous
- the decision can be made locally before execution
- the approval can be captured as a portable signed receipt

The package also supports:

- `native_transfer`
- `erc20_transfer`
- `erc20_approve`
- `swap`
- `contract_call`

## Install

Inside this repo:

```bash
npm install
npm test
```

To use the package from another local project:

```bash
npm install /path/to/openclaw-onchain-approval
npx openclaw-approval presets
```

## Fastest demo

Run the full local hook workflow:

```bash
npm run demo
```

This will:

1. evaluate a candidate action against a local policy
2. create a signed approval receipt with a local approver key
3. gate execution on receipt verification plus policy-decision binding

Artifacts are written to a temporary local directory so you can inspect the decision and receipt JSON files afterward.

If you want the simpler SDK-level flow instead of the hook workflow:

```bash
npm run example
```

## CLI workflow

List built-in policy presets:

```bash
npx openclaw-approval presets
```

Export a preset into a local policy file:

```bash
npx openclaw-approval presets --name balanced --output ./policy.json
```

Generate a local Ed25519 approver keypair:

```bash
npx openclaw-approval keygen \
  --private-key-out ./approver-private.pem \
  --public-key-out ./approver-public.pem
```

Evaluate whether an action requires approval:

```bash
npx openclaw-approval evaluate \
  --action ./examples/demo-action.json \
  --policy ./examples/policies/balanced.json
```

Issue a signed receipt only when approval is required:

```bash
npx openclaw-approval issue \
  --action ./examples/demo-action.json \
  --policy ./examples/policies/balanced.json \
  --private-key ./examples/demo-approver-private.pem \
  --context ./examples/openclaw-hooks/openclaw-context.json \
  --receipt-out ./receipt.json \
  --issued-at 2026-03-15T09:00:00.000Z \
  --expires-at 2026-03-15T09:15:00.000Z
```

Gate execution locally:

```bash
npx openclaw-approval gate \
  --action ./examples/demo-action.json \
  --policy ./examples/policies/balanced.json \
  --receipt ./receipt.json \
  --now 2026-03-15T09:05:00.000Z
```

Verify a stored receipt directly:

```bash
npx openclaw-approval verify \
  --receipt ./receipt.json \
  --action ./examples/demo-action.json \
  --now 2026-03-15T09:05:00.000Z
```

`gate` exits with status `0` only when execution is allowed. That makes it usable as a local execution guard in scripts or OpenClaw wrappers.

## Policy presets

Built-in presets:

- `strict`: gate every ERC-20 approval plus all swaps, contract calls, and low-value movement
- `balanced`: sensible OpenClaw default for routine ops, while still blocking unknown counterparties and large allowances
- `trusted-desk`: higher thresholds for an internal desk, but still blocks unknown addresses and contract calls

Committed example files live in:

- `examples/policies/strict.json`
- `examples/policies/balanced.json`
- `examples/policies/trusted-desk.json`

These are plain local JSON files so operators can version them in Git, diff them, and review changes offline.

## OpenClaw integration path

The clearest integration path is the hook-style example folder:

- `examples/openclaw-hooks/preflight-evaluate.js`
- `examples/openclaw-hooks/issue-receipt.js`
- `examples/openclaw-hooks/gate-action.js`
- `examples/openclaw-hooks/run-demo.js`

The flow is intentionally file-based and local:

1. OpenClaw proposes an onchain action JSON payload.
2. `preflight-evaluate.js` writes a decision artifact.
3. A human or local approval step creates a signed receipt.
4. `gate-action.js` allows execution only if:
   - the receipt signature is valid
   - the receipt matches the exact action digest
   - the receipt is not expired
   - the receipt decision still matches the policy decision being enforced

See `examples/openclaw-hooks/README.md` for the direct commands.

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

## Security properties

- actions are normalized into canonical JSON before hashing
- receipts bind to the exact action digest
- tampering with the action invalidates receipt verification
- expired receipts fail verification
- execution is blocked if the receipt decision no longer matches the current policy decision

This last property matters when local policies change. A previously signed receipt is not enough if it no longer reflects the decision the gate is enforcing now.

## Repository layout

- `src/normalize.js`: normalize and hash onchain actions
- `src/policy.js`: local approval-required policy model
- `src/presets.js`: built-in policy presets
- `src/receipt.js`: signed approval receipt creation and verification
- `src/gate.js`: execution gate and decision-binding checks
- `bin/openclaw-approval.js`: CLI entrypoint
- `examples/openclaw-flow.js`: simple SDK usage example
- `examples/openclaw-hooks/`: practical OpenClaw-style local workflow
- `tests/*.test.js`: offline tests for policy, receipt, gate, presets, and CLI flows

## Non-goals

- hosted approval dashboards
- always-on backend services
- fiat rails
- exchange integrations
- multi-chain production sprawl

## Next likely upgrades

- wallet-native signatures beside local approver keys
- protocol-aware policy packs for common routers and spenders
- multi-approver or quorum receipts for treasury-grade flows
- optional receipt anchoring in append-only or onchain storage
