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
  const response = await fetch(`/api/campaigns/${campaignId}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `decision failed (${response.status})`);
  }
  return body;
}
