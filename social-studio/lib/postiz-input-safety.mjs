const SECRET_FIELD_PATTERN =
  /(^|_)(api_key|access_token|refresh_token|id_token|client_secret|secret|password|authorization|bearer|cookie|session)(_|\b|$)/i;
const SECRET_VALUE_PATTERN =
  /sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|ghp_[A-Za-z0-9]{30,}|AIza[0-9A-Za-z_-]{35}|-----BEGIN (RSA |OPENSSH |EC |)PRIVATE KEY-----/i;

function normalizeKey(key) {
  return String(key || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

function labelFor(path) {
  return path.join(".");
}

function scanValue(value, path, findings) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanValue(item, [...path, `[${index}]`], findings));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = normalizeKey(key);
      const childPath = [...path, key];
      if (SECRET_FIELD_PATTERN.test(normalizedKey)) {
        findings.push({
          path: labelFor(childPath),
          reason: "secret_like_field_name"
        });
        continue;
      }
      scanValue(child, childPath, findings);
    }
    return;
  }

  if (typeof value === "string" && SECRET_VALUE_PATTERN.test(value)) {
    findings.push({
      path: labelFor(path),
      reason: "secret_like_value"
    });
  }
}

export function detectPostizInputSecrets({ integrations = [], uploadedMedia = [] } = {}) {
  const findings = [];
  scanValue(integrations, ["integrations"], findings);
  scanValue(uploadedMedia, ["uploadedMedia"], findings);
  return findings;
}

export function assertNoPostizInputSecrets(inputs = {}) {
  const findings = detectPostizInputSecrets(inputs);
  if (findings.length) {
    throw new Error(
      `Postiz local input secrets found: ${findings.map((finding) => finding.path).join(", ")}`
    );
  }
  return true;
}
