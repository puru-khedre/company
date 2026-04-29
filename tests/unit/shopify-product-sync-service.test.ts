import assert from "assert";
import path from "path";

type ApiCall = {
  url?: string;
  method?: string;
  data?: any;
  params?: any;
};

declare const global: any;

const servicePath = path.resolve(__dirname, "../../src/services/ShopifyProductSyncService.ts");

async function loadService(api: (request: ApiCall) => Promise<any>) {
  global.__clearUnitMocks();
  global.__setUnitMock("@/api", api);
  global.__setUnitMock("@/logger", {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined
  });

  delete require.cache[require.resolve(servicePath)];
  const loadedService = await import(servicePath);
  global.__clearUnitMocks();
  return loadedService.ShopifyProductSyncService;
}

function createRejectingApi() {
  const calls: ApiCall[] = [];
  const api = async (request: ApiCall) => {
    calls.push(request);
    throw new Error("backend failed");
  };

  return { api, calls };
}

describe("shopify product sync service failure behavior", () => {
  test("startInitialImport uses the backend response instead of hardcoded completed success", async () => {
    const calls: ApiCall[] = [];
    const service = await loadService(async (request: ApiCall) => {
      calls.push(request);
      return {
        data: {
          success: true,
          syncJobId: "SMSG_REAL_IMPORT",
          progress: {
            syncJobId: "SMSG_REAL_IMPORT",
            status: "queued",
            systemMessageState: "SmsgProduced",
            completed: false
          },
          backendAvailable: true
        }
      };
    });

    const result = await service.startInitialImport({
      shopId: "SHOP_10000",
      productStoreId: "STORE_A",
      productIdentifierEnumId: "SHOPIFY_PRODUCT_SKU",
      systemMessageRemoteId: "SMR_REAL_SHOP"
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "oms/shopifyShops/SHOP_10000/productSync/imports");
    assert.equal(calls[0].method, "post");
    assert.equal(calls[0].data.systemMessageRemoteId, "SMR_REAL_SHOP");
    assert.equal(result.syncJobId, "SMSG_REAL_IMPORT");
    assert.notEqual(result.syncJobId, "DUMMY_PRODUCT_SYNC_IMPORT");
    assert.equal(result.progress?.status, "queued");
    assert.equal(result.progress?.systemMessageState, "SmsgProduced");
    assert.equal(result.progress?.completed, false);
    assert.equal(result.backendAvailable, true);
  });

  test("startInitialImport rejects when the backend start call fails", async () => {
    const { api } = createRejectingApi();
    const service = await loadService(api);

    await assert.rejects(() => service.startInitialImport({
      shopId: "SHOP_10000",
      productStoreId: "STORE_A",
      productIdentifierEnumId: "SHOPIFY_PRODUCT_SKU",
      systemMessageRemoteId: "SMR_REAL_SHOP"
    }));
  });

  test("startInitialImport rejects before calling backend without systemMessageRemoteId", async () => {
    const { api, calls } = createRejectingApi();
    const service = await loadService(api);

    await assert.rejects(() => service.startInitialImport({
      shopId: "SHOP_10000",
      productStoreId: "STORE_A",
      productIdentifierEnumId: "SHOPIFY_PRODUCT_SKU"
    }));
    assert.equal(calls.length, 0);
  });

  test("fetchSetupState derives returning user state from real product update history", async () => {
    const calls: ApiCall[] = [];
    const service = await loadService(async (request: ApiCall) => {
      calls.push(request);
      return {
        data: {
          productUpdateHistory: [
            {
              shopId: "SHOP_10000",
              productId: "gid://shopify/Product/100"
            }
          ]
        }
      };
    });

    const result = await service.fetchSetupState({
      shopId: "SHOP_10000",
      shop: {
        productStoreId: "STORE_A"
      },
      productStore: {
        productIdentifierEnumId: "SHOPIFY_PRODUCT_SKU"
      }
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "oms/productUpdateHistory");
    assert.equal(calls[0].url?.includes("productSync/setup"), false);
    assert.equal(calls[0].params.shopId, "SHOP_10000");
    assert.equal(calls[0].params.pageSize, 1);
    assert.equal(result.hasLinkedOmsProducts, true);
    assert.equal(result.productStoreLocked, true);
    assert.equal(result.identifierLocked, true);
    assert.equal(result.selectedProductStoreId, "STORE_A");
    assert.equal(result.selectedIdentifierEnumId, "SHOPIFY_PRODUCT_SKU");
    assert.equal(typeof result.syncJobId, "undefined");
    assert.equal(typeof result.completed, "undefined");
  });

  test("fetchSetupState returns first-time state only when product update history is really empty", async () => {
    const service = await loadService(async () => ({
      data: {
        productUpdateHistory: []
      }
    }));

    const result = await service.fetchSetupState({
      shopId: "SHOP_10000",
      shop: {
        productStoreId: "STORE_A"
      },
      productStore: {
        productIdentifierEnumId: "SHOPIFY_PRODUCT_SKU"
      }
    });

    assert.equal(result.hasLinkedOmsProducts, false);
    assert.equal(result.productStoreLocked, false);
    assert.equal(result.identifierLocked, false);
    assert.equal(result.selectedProductStoreId, "STORE_A");
    assert.equal(result.selectedIdentifierEnumId, "SHOPIFY_PRODUCT_SKU");
  });

  test("fetchSetupState rejects invalid product update history shapes", async () => {
    const service = await loadService(async () => ({
      data: {
        productUpdateHistoryCount: 1
      }
    }));

    await assert.rejects(() => service.fetchSetupState({
      shopId: "SHOP_10000"
    }));
  });

  test("fetchProductStoreContext derives related shops from loaded Shopify shops", async () => {
    const { api, calls } = createRejectingApi();
    const service = await loadService(api);

    const result = await service.fetchProductStoreContext({
      productStoreId: "STORE_A",
      shops: [
        { shopId: "SHOP_10000", productStoreId: "STORE_A" },
        { shopId: "SHOP_10001", productStoreId: "STORE_A" },
        { shopId: "SHOP_10002", productStoreId: "STORE_B" }
      ]
    });

    assert.equal(calls.length, 0);
    assert.deepEqual(result.relatedShops.map((shop: any) => shop.shopId), ["SHOP_10000", "SHOP_10001"]);
  });

  test("fetchProductStoreContext rejects missing Shopify shop data instead of calling a fallback endpoint", async () => {
    const { api, calls } = createRejectingApi();
    const service = await loadService(api);

    await assert.rejects(() => service.fetchProductStoreContext({
      productStoreId: "STORE_A"
    }));
    assert.equal(calls.length, 0);
  });

  test("setup, preflight, progress, reconcile, and history reject backend failures", async () => {
    const failureCases = [
      {
        method: "fetchSetupState",
        payload: { shopId: "SHOP_10000" }
      },
      {
        method: "fetchPreflight",
        payload: {
          shopId: "SHOP_10000",
          productStoreId: "STORE_A",
          productIdentifierEnumId: "SHOPIFY_PRODUCT_SKU"
        }
      },
      {
        method: "fetchProgress",
        payload: { shopId: "SHOP_10000", syncJobId: "SMSG_REAL_IMPORT" }
      },
      {
        method: "fetchReconcile",
        payload: { shopId: "SHOP_10000", productStoreId: "STORE_A", syncJobId: "SMSG_REAL_IMPORT" }
      },
      {
        method: "fetchHistory",
        payload: { shopId: "SHOP_10000" }
      }
    ];

    for (const failureCase of failureCases) {
      const { api } = createRejectingApi();
      const service = await loadService(api);

      await assert.rejects(
        () => service[failureCase.method](failureCase.payload),
        undefined,
        `${failureCase.method} should reject instead of returning fallback data`
      );
    }
  });
});
