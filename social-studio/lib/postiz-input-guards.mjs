// Shared guards for local Postiz inputs. Both the input-kit builder and the
// dry-run payload builder must agree on what counts as an unfilled placeholder
// and on which integration settings are unsafe for a draft-only handoff.

const PLACEHOLDER_PATTERN = /replace-with|placeholder|todo/i;

export function isPlaceholderValue(value) {
  return PLACEHOLDER_PATTERN.test(String(value || ""));
}

// Settings that would let a replayed payload publish directly instead of
// landing as a draft/inbox item on the platform side.
const DIRECT_PUBLISH_SETTINGS = [
  { key: "content_posting_method", value: "DIRECT_POST" }
];

export function findDirectPublishSettings(settings = {}) {
  const findings = [];
  for (const rule of DIRECT_PUBLISH_SETTINGS) {
    if (String(settings?.[rule.key] || "").toUpperCase() === rule.value) {
      findings.push({ key: rule.key, value: rule.value });
    }
  }
  return findings;
}

export function assertDraftSafeSettings(settings, platform) {
  const findings = findDirectPublishSettings(settings);
  if (findings.length > 0) {
    const details = findings
      .map((finding) => `${finding.key}=${finding.value}`)
      .join(", ");
    throw new Error(
      `draft-only handoff cannot carry direct publish settings for ${platform}: ${details}`
    );
  }
  return true;
}
