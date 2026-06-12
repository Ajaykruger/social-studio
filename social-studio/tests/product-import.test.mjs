import test from "node:test";
import assert from "node:assert/strict";

import {
  assertAllowedProductUrl,
  importProductFromUrl,
  slugify
} from "../../server/product-import.mjs";

function fakeResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    text: async () => body
  };
}

test("product import only allows crystalclawz.co.za", () => {
  assert.ok(assertAllowedProductUrl("https://crystalclawz.co.za/products/rubber-base"));
  assert.ok(assertAllowedProductUrl("https://www.crystalclawz.co.za/collections/base"));
  assert.throws(() => assertAllowedProductUrl("https://evil.example.com/products/x"), /limited to crystalclawz/);
  assert.throws(() => assertAllowedProductUrl("https://crystalclawz.co.za.evil.com/p"), /limited to crystalclawz/);
  assert.throws(() => assertAllowedProductUrl("file:///etc/passwd"), /http/);
  assert.throws(() => assertAllowedProductUrl("not a url"), /valid URL/);
});

test("imports a product via the Shopify product JSON endpoint", async () => {
  const requested = [];
  const fetchFn = async (url) => {
    requested.push(String(url));
    if (String(url).endsWith(".json")) {
      return fakeResponse(
        JSON.stringify({
          product: {
            title: "French Rubber Base",
            handle: "french-rubber-base",
            body_html: "<p>Gives a smooth base for French work. Self-levelling formula for neat application.</p>",
            variants: [{ price: "189.00" }],
            images: [{ src: "https://cdn.example/img1.jpg" }]
          }
        })
      );
    }
    throw new Error("should not fetch HTML when JSON works");
  };

  const product = await importProductFromUrl(
    "https://crystalclawz.co.za/products/french-rubber-base",
    { fetchFn }
  );

  assert.equal(product.name, "French Rubber Base");
  assert.equal(product.id, "french-rubber-base");
  assert.equal(product.price, "R189.00");
  assert.deepEqual(product.images, ["https://cdn.example/img1.jpg"]);
  assert.equal(product.importSource, "shopify_product_json");
  assert.ok(product.description.includes("smooth base"));
  assert.ok(product.proposedClaims.length > 0);
  assert.ok(product.proposedClaims.every((claim) => claim.status === "pending_human_approval"));
  assert.ok(requested[0].endsWith("/products/french-rubber-base.json"));
});

test("falls back to og meta tags when JSON is unavailable", async () => {
  const fetchFn = async (url) => {
    if (String(url).endsWith(".json")) {
      return fakeResponse("not found", false, 404);
    }
    return fakeResponse(`
      <html><head>
        <meta property="og:title" content="Polygel Pot" />
        <meta property="og:description" content="Controlled application for clean structure work." />
        <meta property="og:image" content="https://cdn.example/poly.jpg" />
      </head><body></body></html>
    `);
  };

  const product = await importProductFromUrl(
    "https://crystalclawz.co.za/products/polygel-pot",
    { fetchFn }
  );

  assert.equal(product.name, "Polygel Pot");
  assert.equal(product.importSource, "html_meta_tags");
  assert.deepEqual(product.images, ["https://cdn.example/poly.jpg"]);
});

test("slugify produces safe campaign id fragments", () => {
  assert.equal(slugify("French Rubber Base!"), "french-rubber-base");
  assert.equal(slugify("  Gel & Polish 15ml "), "gel-polish-15ml");
});
