import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const appPath = path.join(process.cwd(), "src", "App.jsx");
const componentPath = path.join(process.cwd(), "src", "components", "BrandClaimLedgerPanel.jsx");

test("App wires the brand claim ledger into the review flow", async () => {
  const source = await readFile(appPath, "utf8");

  assert.match(source, /BrandClaimLedgerPanel/);
  assert.match(source, /brand-claim-ledger\/brand-claim-ledger\.ui\.json/);

  const contentPlanIndex = source.indexOf("<ContentPlanPanel");
  const brandLedgerIndex = source.indexOf("<BrandClaimLedgerPanel");
  const productionPacketsIndex = source.indexOf("<ProductionPacketsPanel");

  assert.ok(brandLedgerIndex > contentPlanIndex);
  assert.ok(brandLedgerIndex < productionPacketsIndex);
});

test("BrandClaimLedgerPanel shows review claim counts without local paths", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /Brand Claim Ledger/);
  assert.match(source, /approvedBenefitCount/);
  assert.match(source, /blockedClaimCount/);
  assert.match(source, /requiredVisuals/);
  assert.doesNotMatch(source, /localPath|thumbnailPath|MoneyPrinterTurbo\\storage/);
});
