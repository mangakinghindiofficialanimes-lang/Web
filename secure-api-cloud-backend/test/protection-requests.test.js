import test from "node:test";
import assert from "node:assert/strict";
import {
  validateProtectionRequest,
  canTransitionRequest,
  transitionProtectionRequest
} from "../src/protection-requests.js";

const validRequest = {
  resourceType: "api",
  resourceId: "orders-api",
  profile: "enhanced_api_protection",
  justification: "Protect sensitive customer API traffic and reduce replay risk."
};

test("accepts a well-formed protection request", () => {
  const result = validateProtectionRequest(validRequest);
  assert.equal(result.ok, true);
  assert.equal(result.value.resourceId, "orders-api");
  assert.equal(result.value.customRequirements, null);
});

test("rejects unsupported profiles and malformed fields", () => {
  assert.equal(validateProtectionRequest({ ...validRequest, profile: "magic_unbreakable" }).error, "invalid_protection_profile");
  assert.equal(validateProtectionRequest({ ...validRequest, resourceType: "unknown" }).error, "invalid_resource_type");
  assert.equal(validateProtectionRequest({ ...validRequest, justification: "short" }).error, "invalid_justification");
});

test("requires custom requirements for custom protection requests", () => {
  const result = validateProtectionRequest({
    ...validRequest,
    profile: "custom_protection_request",
    customRequirements: "Add application-layer encryption for payloads."
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.customRequirements, "Add application-layer encryption for payloads.");
});

test("only permits explicit status transitions", () => {
  assert.equal(canTransitionRequest("pending_review", "approved"), true);
  assert.equal(canTransitionRequest("pending_review", "active"), false);
  assert.equal(canTransitionRequest("active", "rolled_back"), true);
  assert.equal(canTransitionRequest("active", "pending_review"), false);
});

test("records status transition history without mutating the original", () => {
  const original = { id: "req_1", status: "pending_review", history: [] };
  const result = transitionProtectionRequest(original, "approved", "admin_1", "Reviewed scope");
  assert.equal(result.ok, true);
  assert.equal(result.value.status, "approved");
  assert.equal(result.value.history.length, 1);
  assert.equal(result.value.history[0].from, "pending_review");
  assert.equal(original.status, "pending_review");
  assert.equal(original.history.length, 0);
});

test("rejects transitions without a valid actor or legal state change", () => {
  assert.equal(transitionProtectionRequest({ status: "pending_review" }, "active", "admin_1").error, "invalid_status_transition");
  assert.equal(transitionProtectionRequest({ status: "pending_review" }, "approved", "").error, "invalid_actor");
});
