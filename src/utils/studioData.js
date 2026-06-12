export const DEFAULT_CAMPAIGN_ID = "cc-rubber-base-demo-2026-06-10";

export function activeCampaignId() {
  if (typeof window === "undefined") return DEFAULT_CAMPAIGN_ID;
  const fromQuery = new URLSearchParams(window.location.search).get("campaign");
  return fromQuery && /^[a-z0-9][a-z0-9-]*$/.test(fromQuery)
    ? fromQuery
    : DEFAULT_CAMPAIGN_ID;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Loads every campaign artifact the panels need. Missing artifacts are
// tolerated: the matching panel simply does not render, and the caller gets
// the list of what was missing so the UI can say so.
export async function loadStudioArtifacts(campaignId, manifest) {
  const data = {};
  const missing = [];

  await Promise.all(
    Object.entries(manifest).map(async ([key, relativePath]) => {
      try {
        data[key] = await fetchJson(
          `/studio-data/${campaignId}/${relativePath}`
        );
      } catch {
        data[key] = null;
        missing.push(relativePath);
      }
    })
  );

  return { data, missing };
}

export async function loadCampaignState(campaignId) {
  return fetchJson(`/api/campaigns/${campaignId}/state`);
}

export async function submitDecision(campaignId, payload) {
  return postJson(`/api/campaigns/${campaignId}/decision`, payload, "decision");
}

async function postJson(url, payload, label) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `${label} failed (${response.status})`);
  }
  return body;
}

export async function listCampaigns() {
  const body = await fetchJson("/api/campaigns");
  return body.campaigns || [];
}

export async function importProduct(url) {
  const body = await postJson("/api/import-product", { url }, "product import");
  return body.product;
}

export async function generateCreative(product, brief) {
  return postJson("/api/generate", { product, brief }, "generation");
}

export async function createCampaignFromPack(payload) {
  return postJson("/api/campaigns", payload, "campaign creation");
}
