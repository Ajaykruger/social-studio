#!/usr/bin/env bash
set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4810/api/health}"

response="$(curl -fsS "${HEALTH_URL}")" || {
  echo "Healthcheck failed: could not reach ${HEALTH_URL}."
  exit 1
}

HEALTH_JSON="${response}" node --input-type=module <<'NODE'
const health = JSON.parse(process.env.HEALTH_JSON || "{}");
const failures = [];

if (health.draftOnly !== true) {
  failures.push("draftOnly is not true");
}
if (health.schedulingOrPublishing !== "never") {
  failures.push("schedulingOrPublishing is not never");
}
if (health.networkCallsToPostiz !== false) {
  failures.push("networkCallsToPostiz is not false");
}

if (failures.length > 0) {
  console.error(`Healthcheck failed: ${failures.join("; ")}`);
  process.exit(1);
}

console.log("Healthcheck passed: draft-only, scheduling off, publishing off.");
NODE
