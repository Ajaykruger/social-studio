// Crystal Clawz claim boundary: generated copy may only use product-page or
// human-approved benefits. These patterns block claim families that need
// separate sourcing and approval before they may appear in any output.
export const BLOCKED_CLAIM_PATTERNS = [
  {
    id: "durability",
    label: "long-lasting / durability claim",
    pattern: /\blong(?:er)?[-\s]?lasting\b|\blasts?\s+longer\b|\bweeks?\s+of\s+wear\b/i
  },
  {
    id: "non_lift",
    label: "non-lift / prevents-lifting claim",
    pattern:
      /\b(?:prevents?|stops?|eliminates?)\s+lift(?:ing)?\b|\bnon[-\s]?lift(?:ing)?\b|\bnever\s+lifts?\b|\bno\s+lifting\b/i
  },
  {
    id: "no_chip",
    label: "chip-proof claim",
    pattern:
      /\bchip[-\s]?(?:free|proof)\b|\bno[-\s]?chip(?:ping)?\b|\bnever\s+chips?\b|\bwon'?t\s+chip\b/i
  },
  {
    id: "strengthening",
    label: "strengthening claim",
    pattern:
      /\bstrengthen(?:s|ing)?\b|\badds?\s+strength\b|\bstrong(?:er)?\s+(?:sets|nails|overlays)\b|\bmakes?\s+nails?\s+strong(?:er)?\b/i
  },
  {
    id: "repair_health",
    label: "repair / health / damage claim",
    pattern:
      /\brepairs?\b|\bheals?\b|\bgrows?\s+nails?\b|\bdamage[-\s]?(?:free|proof)\b|\bprevents?\s+damage\b|\bnail\s+health\b|\btreatment\b/i
  },
  {
    id: "guarantee",
    label: "guaranteed-outcome claim",
    pattern:
      /\bguarantee[ds]?\b|\bworks?\s+for\s+every(?:one|\s+client)\b|\bperfect\s+results?\b/i
  },
  {
    id: "outcome_fix",
    label: "product-fixes-problem claim",
    pattern: /\bit\s+fixes\b|\bfixes\s+a\s+real\b|\bfix(?:es)?\s+the\s+lift(?:ing)?\b/i
  }
];

export function findBlockedClaims(text) {
  const value = String(text || "");
  const findings = [];
  for (const rule of BLOCKED_CLAIM_PATTERNS) {
    const match = value.match(rule.pattern);
    if (match) {
      findings.push({ id: rule.id, label: rule.label, match: match[0] });
    }
  }
  return findings;
}

function collectStrings(value, path, out) {
  if (typeof value === "string") {
    out.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, out));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      collectStrings(child, path ? `${path}.${key}` : key, out);
    }
  }
}

export function findBlockedClaimsInObject(value) {
  const strings = [];
  collectStrings(value, "", strings);
  const findings = [];
  for (const entry of strings) {
    for (const finding of findBlockedClaims(entry.text)) {
      findings.push({ ...finding, path: entry.path });
    }
  }
  return findings;
}

export function assertClaimSafe(value, label = "generated content") {
  const findings = findBlockedClaimsInObject(value);
  if (findings.length > 0) {
    const details = findings
      .map((finding) => `${finding.path}: ${finding.label} ("${finding.match}")`)
      .join("; ");
    throw new Error(`${label} contains blocked claims: ${details}`);
  }
  return true;
}
