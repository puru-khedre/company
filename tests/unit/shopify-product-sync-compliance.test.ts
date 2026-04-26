import assert from "assert";
import fs from "fs";
import path from "path";

const readProjectFile = (relativePath: string) => {
  return fs.readFileSync(path.resolve(__dirname, "../..", relativePath), "utf8");
};

describe("shopify product sync implementation compliance", () => {
  test("wizard view does not add CSS, classes, grid layouts, or localStorage state", () => {
    const view = readProjectFile("src/views/ShopifyProductSync.vue");

    assert.equal(/<style[\s>]/.test(view), false);
    assert.equal(/\sclass=/.test(view), false);
    assert.equal(/\sstyle=/.test(view), false);
    assert.equal(/ion-grid|ion-row|ion-col/.test(view), false);
    assert.equal(/localStorage/.test(view), false);
  });

  test("product sync service does not call Shopify directly or fake import success", () => {
    const service = readProjectFile("src/services/ShopifyProductSyncService.ts");

    assert.equal(/myshopify|admin\/api|bulkOperationRunQuery|client\(/.test(service), false);
    assert.equal(/success:\s*true/.test(service), false);
    assert.equal(/status:\s*"completed"/.test(service), false);
  });
});
