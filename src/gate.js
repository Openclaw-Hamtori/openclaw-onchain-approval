import { canonicalizeJson } from "./canonical.js";
import { evaluateApprovalRequirement } from "./policy.js";
import { verifyApprovalReceipt } from "./receipt.js";

function createDecisionBinding(decision) {
  return {
    approvalRequired: Boolean(decision?.approvalRequired),
    riskLevel: typeof decision?.riskLevel === "string" ? decision.riskLevel : "unknown",
    matchedRules: Array.isArray(decision?.matchedRules)
      ? [...new Set(decision.matchedRules.map((item) => String(item)))].sort()
      : [],
    policyContext:
      decision?.policyContext && typeof decision.policyContext === "object" && !Array.isArray(decision.policyContext)
        ? decision.policyContext
        : {},
  };
}

export function verifyReceiptDecisionBinding({ receiptDecision, decision } = {}) {
  const actual = createDecisionBinding(receiptDecision);
  const expected = createDecisionBinding(decision);
  const errors = [];

  if (actual.approvalRequired !== expected.approvalRequired) {
    errors.push("receipt.decision.approvalRequired does not match the current policy decision");
  }

  if (actual.riskLevel !== expected.riskLevel) {
    errors.push("receipt.decision.riskLevel does not match the current policy decision");
  }

  if (canonicalizeJson(actual.matchedRules) !== canonicalizeJson(expected.matchedRules)) {
    errors.push("receipt.decision.matchedRules do not match the current policy decision");
  }

  if (canonicalizeJson(actual.policyContext) !== canonicalizeJson(expected.policyContext)) {
    errors.push("receipt.decision.policyContext does not match the current policy configuration");
  }

  return {
    ok: errors.length === 0,
    actual,
    expected,
    errors,
  };
}

export function authorizeActionExecution({ action, policy, receipt, now } = {}) {
  const decision = evaluateApprovalRequirement(action, policy);

  if (!decision.approvalRequired) {
    return {
      allowed: true,
      reason: "policy_allows_without_receipt",
      decision,
      verification: null,
      decisionBinding: null,
    };
  }

  if (!receipt) {
    return {
      allowed: false,
      reason: "approval_required",
      decision,
      verification: null,
      decisionBinding: null,
    };
  }

  const verification = verifyApprovalReceipt({ receipt, action, now });

  if (!verification.ok) {
    return {
      allowed: false,
      reason: "receipt_verification_failed",
      decision,
      verification,
      decisionBinding: null,
    };
  }

  if (receipt.decision?.approvalRequired !== true) {
    return {
      allowed: false,
      reason: "receipt_does_not_record_required_approval",
      decision,
      verification,
      decisionBinding: null,
    };
  }

  const decisionBinding = verifyReceiptDecisionBinding({
    receiptDecision: receipt.decision,
    decision,
  });

  if (!decisionBinding.ok) {
    return {
      allowed: false,
      reason: "receipt_decision_mismatch",
      decision,
      verification,
      decisionBinding,
    };
  }

  return {
    allowed: true,
    reason: "receipt_verified",
    decision,
    verification,
    decisionBinding,
  };
}
