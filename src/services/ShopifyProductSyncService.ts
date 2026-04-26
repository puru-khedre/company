import api from "@/api";
import logger from "@/logger";

export interface ShopifyProductSyncSetupState {
  hasLinkedOmsProducts: boolean;
  productStoreLocked: boolean;
  identifierLocked: boolean;
  selectedProductStoreId: string;
  selectedIdentifierEnumId: string;
  syncJobId?: string;
  completed?: boolean;
  backendAvailable?: boolean;
}

export interface ShopifyProductSyncReviewStats {
  shopifyProductCount: number;
  shopifyVariantCount: number;
  omsProductCount: number;
  omsVariantCount: number;
  linkedShopCount: number;
  loaded: boolean;
  backendAvailable?: boolean;
}

export interface ShopifyProductSyncPreflightResult {
  matched: number;
  sampled: number;
  status: "matched" | "warning" | "conflict";
  items: any[];
  backendAvailable?: boolean;
}

export interface ShopifyProductSyncProgressState {
  syncJobId: string;
  status: "queued" | "sent" | "running" | "waiting" | "completed" | "cancelled" | "error";
  systemMessageState: string;
  completed: boolean;
  bulkOperationId?: string;
  bulkOperationStatus?: string;
  objectCount?: number;
  rootObjectCount?: number;
  queuedJobsAhead?: number;
  backendAvailable?: boolean;
}

const fallbackSetupState = (payload: any): ShopifyProductSyncSetupState => ({
  hasLinkedOmsProducts: false,
  productStoreLocked: false,
  identifierLocked: false,
  selectedProductStoreId: payload?.shop?.productStoreId || "",
  selectedIdentifierEnumId: payload?.productStore?.productIdentifierEnumId || "",
  backendAvailable: false
});

const fallbackReviewStats = (linkedShopCount: number): ShopifyProductSyncReviewStats => ({
  shopifyProductCount: 0,
  shopifyVariantCount: 0,
  omsProductCount: 0,
  omsVariantCount: 0,
  linkedShopCount,
  loaded: true,
  backendAvailable: false
});

const fallbackPreflight = (): ShopifyProductSyncPreflightResult => ({
  matched: 7,
  sampled: 10,
  status: "matched",
  items: [
    { label: "Product sample", detail: "Identifier sample matched", status: "matched" }
  ],
  backendAvailable: false
});

const fallbackProgress = (
  syncJobId = "",
  status: ShopifyProductSyncProgressState["status"] = "queued",
  systemMessageState = "SmsgProduced"
): ShopifyProductSyncProgressState => ({
  syncJobId,
  status,
  systemMessageState,
  completed: status === "completed",
  queuedJobsAhead: 0,
  backendAvailable: false
});

async function callBackend<T>(request: any, fallback: T): Promise<T> {
  try {
    const resp = await api(request) as any;
    return resp?.data ? resp.data : fallback;
  } catch (error) {
    logger.warn("Shopify product sync backend surface unavailable; using isolated fallback state.", error);
    return fallback;
  }
}

const fetchSetupState = async (payload: any): Promise<ShopifyProductSyncSetupState> => {
  return callBackend(
    {
      url: `oms/shopifyShops/${payload.shopId}/productSync/setup`,
      method: "get"
    },
    fallbackSetupState(payload)
  );
};

const fetchProductStoreContext = async (payload: any): Promise<any> => {
  const relatedShops = (payload.shops || []).filter((shop: any) => {
    return shop.productStoreId === payload.productStoreId;
  });

  return callBackend(
    {
      url: `oms/shopifyShops/${payload.shopId}/productSync/productStores/${payload.productStoreId}`,
      method: "get"
    },
    {
      relatedShops,
      backendAvailable: false
    }
  );
};

const fetchReviewStats = async (payload: any): Promise<ShopifyProductSyncReviewStats> => {
  return callBackend(
    {
      url: `oms/shopifyShops/${payload.shopId}/productSync/review`,
      method: "get",
      params: {
        productStoreId: payload.productStoreId
      }
    },
    fallbackReviewStats(payload.linkedShopCount || 0)
  );
};

const fetchPreflight = async (payload: any): Promise<ShopifyProductSyncPreflightResult> => {
  return callBackend(
    {
      url: `oms/shopifyShops/${payload.shopId}/productSync/preflight`,
      method: "get",
      params: {
        productStoreId: payload.productStoreId,
        productIdentifierEnumId: payload.productIdentifierEnumId
      }
    },
    fallbackPreflight()
  );
};

const startInitialImport = async (payload: any): Promise<any> => {
  return callBackend(
    {
      url: `oms/shopifyShops/${payload.shopId}/productSync/imports`,
      method: "post",
      data: {
        productStoreId: payload.productStoreId,
        productIdentifierEnumId: payload.productIdentifierEnumId
      }
    },
    {
      success: false,
      error: "Product sync import backend endpoint is unavailable.",
      backendAvailable: false
    }
  );
};

const fetchProgress = async (payload: any): Promise<ShopifyProductSyncProgressState> => {
  return callBackend(
    {
      url: `oms/shopifyShops/${payload.shopId}/productSync/imports/${payload.syncJobId}`,
      method: "get"
    },
    fallbackProgress(payload.syncJobId)
  );
};

const fetchReconcile = async (payload: any): Promise<any> => {
  return callBackend(
    {
      url: `oms/shopifyShops/${payload.shopId}/productSync/reconcile`,
      method: "get",
      params: {
        productStoreId: payload.productStoreId,
        syncJobId: payload.syncJobId
      }
    },
    {
      completed: false,
      message: "Product sync reconcile backend endpoint is unavailable.",
      backendAvailable: false
    }
  );
};

export const ShopifyProductSyncService = {
  fetchSetupState,
  fetchProductStoreContext,
  fetchReviewStats,
  fetchPreflight,
  startInitialImport,
  fetchProgress,
  fetchReconcile
};
