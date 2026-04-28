import assert from "assert";
import fs from "fs";
import path from "path";

const readProjectFile = (relativePath: string) => {
  return fs.readFileSync(path.resolve(__dirname, "../..", relativePath), "utf8");
};

describe("shopify product sync implementation compliance", () => {
  test("product sync views do not add CSS, classes, grid layouts, or localStorage state", () => {
    const files = [
      "src/views/ShopifyProductSync.vue",
      "src/views/ShopifyProductSyncHistory.vue",
      "src/components/ShopifyProductSyncHistoryView.vue",
      "src/components/ShopifyProductSyncReturningView.vue",
      "src/components/ShopifyProductSyncWizardView.vue"
    ];

    for (const file of files) {
      const source = readProjectFile(file);

      assert.equal(/<style[\s>]/.test(source), false, `${file} should not add style blocks`);
      assert.equal(/\sclass=/.test(source), false, `${file} should not add classes`);
      assert.equal(/\sstyle=/.test(source), false, `${file} should not add inline styles`);
      assert.equal(/ion-grid|ion-row|ion-col/.test(source), false, `${file} should not use ionic grid`);
      assert.equal(/localStorage/.test(source), false, `${file} should not use localStorage`);
    }
  });

  test("product sync service does not call Shopify directly or fake import success", () => {
    const service = readProjectFile("src/services/ShopifyProductSyncService.ts");

    assert.equal(/myshopify|admin\/api|bulkOperationRunQuery|client\(/.test(service), false);
    assert.equal(/success:\s*true/.test(service), false);
    assert.equal(/status:\s*"completed"/.test(service), false);
  });

  test("returning history uses a dedicated vue router route", () => {
    const routerSource = readProjectFile("src/router/index.ts");

    assert.equal(routerSource.includes("/shopify-connection-details/:id/product-sync/history"), true);
    assert.equal(routerSource.includes("name: 'ShopifyProductSyncHistory'"), true);
  });

  test("product sync history fetches newest system messages first", () => {
    const historySource = readProjectFile("src/views/ShopifyProductSyncHistory.vue");

    assert.equal(historySource.includes("orderBy: '-initDate'"), true);
    assert.equal(historySource.includes("orderByField: '-initDate'"), false);
    assert.equal(historySource.includes("orderByField: 'initDate DESC'"), false);
    assert.equal(historySource.includes('translate("Product sync history")'), true);
    assert.equal(historySource.includes("remoteMessageId?.startsWith"), false);
    assert.equal(historySource.includes("const PAGE_SIZE = 25"), true);
    assert.equal(historySource.includes("ion-infinite-scroll"), true);
    assert.equal(historySource.includes("fetchSystemMessagesPage"), true);
    assert.equal(historySource.includes("initDate_from"), false);
    assert.equal(historySource.includes("initDate_thru"), false);
  });

  test("data manager logs are fetched by exact system message id", () => {
    const dataManagerLogSource = readProjectFile("src/composables/useDataManagerLog.ts");
    const syncRunSource = readProjectFile("src/composables/useShopifyProductSyncRun.ts");

    assert.equal(dataManagerLogSource.includes('systemMessageId_op: "equals"'), true);
    assert.equal(dataManagerLogSource.includes("pageSize: 1"), true);
    assert.equal(syncRunSource.includes("fetchMdmLogBySystemMessageId(syncRunSystemMessageId)"), true);
  });
});
