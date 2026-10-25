export const PROTECTION_PROFILES = Object.freeze([
  "standard_transport_security",
  "enhanced_api_protection",
  "encrypted_media_delivery",
  "premium_multi_drm",
  "custom_protection_request"
]);

export const REQUEST_STATUSES = Object.freeze([
  "pending_review",
  "approved",
  "rejected",
  "staging",
  "active",
  "failed",
  "rolled_back"
]);

const TRANSITIONS = Object.freeze({
  pending_review: new Set(["approved", "rejected"]),
  approved: new Set(["staging", "rejected"]),
  rejected: new Set(),
  staging: new Set(["active", "failed", "rolled_back"]),
  active: new Set(["rolled_back", "failed"]),
  failed: new Set(["staging", "rolled_back"]),
  rolled_back: new Set(["staging"])
});

const RESOURCE_TYPES = new Set(["api", "media_asset", "application", "other"]);

export function validateProtectionRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "invalid_request" };
  }

  const { resourceType, resourceId, profile, justification, customRequirements } = input;

  if (!RESOURCE_TYPES.has(resourceType)) {
    return { ok: false, error: "invalid_resource_type" };
  }
  if (typeof resourceId !== "string" || resourceId.trim().length < 1 || resourceId.trim().length > 160) {
    return { ok: false, error: "invalid_resource_id" };
  }
  if (!PROTECTION_PROFILES.includes(profile)) {
    return { ok: false, error: "invalid_protection_profile" };
  }
  if (typeof justification !== "string" || justification.trim().length < 10 || justification.trim().length > 2000) {
    return { ok: false, error: "invalid_justification" };
  }
  if (profile === "custom_protection_request" &&
      (typeof customRequirements !== "string" || customRequirements.trim().length < 10 || customRequirements.trim().length > 2000)) {
    return { ok: false, error: "invalid_custom_requirements" };
  }

  return {
    ok: true,
    value: {
      resourceType,
      resourceId: resourceId.trim(),
      profile,
      justification: justification.trim(),
      customRequirements: profile === "custom_protection_request" ? customRequirements.trim() : null
    }
  };
}

export function canTransitionRequest(currentStatus, nextStatus) {
  return REQUEST_STATUSES.includes(currentStatus) &&
    REQUEST_STATUSES.includes(nextStatus) &&
    TRANSITIONS[currentStatus].has(nextStatus);
}

export function transitionProtectionRequest(request, nextStatus, actorId, note = "") {
  if (!request || typeof request !== "object") {
    return { ok: false, error: "request_not_found" };
  }
  if (!canTransitionRequest(request.status, nextStatus)) {
    return { ok: false, error: "invalid_status_transition" };
  }
  if (typeof actorId !== "string" || actorId.trim().length < 1 || actorId.trim().length > 120) {
    return { ok: false, error: "invalid_actor" };
  }
  if (typeof note !== "string" || note.length > 1000) {
    return { ok: false, error: "invalid_note" };
  }

  return {
    ok: true,
    value: {
      ...request,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      history: [
        ...(Array.isArray(request.history) ? request.history : []),
        {
          from: request.status,
          to: nextStatus,
          actorId: actorId.trim(),
          note: note.trim(),
          at: new Date().toISOString()
        }
      ]
    }
  };
}
