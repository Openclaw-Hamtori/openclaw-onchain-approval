import { evaluateApprovalRequirement } from "./policy.js";
import { verifyApprovalReceipt } from "./receipt.js";

export function authorizeActionExecution({ action, policy, receipt, now } = {}) {
  const decision = evaluateApprovalRequirement(action, policy);

  if (!decision.approvalRequired) {
    return {
      allowed: true,
      reason: "policy_allows_without_receipt",
      decision,
      verification: null,
    };
  }

  if (!receipt) {
    return {
      allowed: false,
      reason: "approval_required",
      decision,
      verification: null,
    };
  }

  const verification = verifyApprovalReceipt({ receipt, action, now });

  if (!verification.ok) {
    return {
      allowed: false,
      reason: "receipt_verification_failed",
      decision,
      verification,
    };
  }

  if (receipt.decision?.approvalRequired !== true) {
    return {
      allowed: false,
      reason: "receipt_does_not_record_required_approval",
      decision,
      verification,
    };
  }

  return {
    allowed: true,
    reason: "receipt_verified",
    decision,
    verification,
  };
}
