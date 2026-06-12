// Product URL importer. Fetches a Crystal Clawz product page and extracts a
// structured product record. Only the Crystal Clawz shop is allowed - this
// tool must never become a generic web fetcher. Imported text is reference
// material: any claim taken from it stays "proposed" until a human approves
// it in the Create screen.

const ALLOWED_HOSTS = new Set([
  "crystalclawz.co.za",
  "www.crystalclawz.co.za"
]);

export function assertAllowedProductUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("product URL is not a valid URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("product URL must use http(s)");
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      "product imports are limited to crystalclawz.co.za product pages"
    );
  }
  return parsed;
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Short benefit-like sentences from the product description. These are
// PROPOSALS only - the UI shows them as candidates and a human picks the one
// approved benefit for the campaign.
function proposeClaims(description) {
  return String(description || "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 15 && sentence.length <= 120)
    .slice(0, 6)
    .map((text) => ({ text, status: "pending_human_approval" }));
}

function productFromShopify(productJson, sourceUrl) {
  const product = productJson?.product || productJson;
  if (!product?.title) {
    throw new Error("Shopify product payload had no title");
  }
  const description = stripHtml(product.body_html);
  const price = product.variants?.[0]?.price
    ? `R${product.variants[0].price}`
    : "";
  return {
    id: slugify(product.handle || product.title),
    name: String(product.title).trim(),
    sourceUrl,
    description,
    price,
    images: (product.images || [])
      .map((image) => String(image?.src || "").trim())
      .filter(Boolean)
      .slice(0, 4),
    proposedClaims: proposeClaims(description),
    importSource: "shopify_product_json"
  };
}

function metaContent(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return stripHtml(match[1]);
  }
  return "";
}

function productFromHtml(html, sourceUrl) {
  const name = metaContent(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    /<title[^>]*>([^<]+)<\/title>/i
  ]);
  if (!name) {
    throw new Error("could not find a product title on the page");
  }
  const description = metaContent(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
  ]);
  const image = metaContent(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  ]);
  return {
    id: slugify(name),
    name,
    sourceUrl,
    description,
    price: "",
    images: image ? [image] : [],
    proposedClaims: proposeClaims(description),
    importSource: "html_meta_tags"
  };
}

async function fetchText(fetchFn, url) {
  const response = await fetchFn(url, {
    redirect: "follow",
    headers: { "User-Agent": "CrystalClawzSocialStudio/1.0 (product import)" }
  });
  if (!response.ok) {
    throw new Error(`product page fetch failed: ${response.status}`);
  }
  return response.text();
}

export async function importProductFromUrl(rawUrl, { fetchFn = fetch } = {}) {
  const parsed = assertAllowedProductUrl(rawUrl);
  const sourceUrl = parsed.toString();

  // Shopify shops expose structured JSON at <product-url>.json - far more
  // reliable than scraping markup, so try it first for /products/ URLs.
  const productPathMatch = parsed.pathname.match(/^(.*\/products\/[^/]+)\/?$/);
  if (productPathMatch) {
    const jsonUrl = `${parsed.origin}${productPathMatch[1]}.json`;
    try {
      const body = await fetchText(fetchFn, jsonUrl);
      return productFromShopify(JSON.parse(body), sourceUrl);
    } catch {
      // fall through to HTML parsing
    }
  }

  const html = await fetchText(fetchFn, sourceUrl);
  return productFromHtml(html, sourceUrl);
}
