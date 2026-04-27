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

export interface ShopifyShopProductCount {
  count: number;
  backendAvailable?: boolean;
}

const STATUS_COMPLETED = "completed";
const STATUS_COMPLETED_WITH_ERRORS = "completed-with-errors";

export interface ShopifyProductSyncHistoryOperation {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  metricValue?: number | string;
  metricLabel?: string;
  actionLabel?: string;
  detailType: string;
}

export interface ShopifyProductSyncHistoryRun {
  id: string;
  systemMessageId: string;
  createdTime: string;
  bulkOperationStatus: string;
  bulkOperationStatusLabel: string;
  mdmStatus: string;
  mdmStatusLabel: string;
  bulkOperationId: string;
  objectCount: number;
  mdmImportId: string;
  totalRecordCount: number;
  failedRecordCount: number;
  operations: ShopifyProductSyncHistoryOperation[];
}

export interface ShopifyProductSyncHistoryState {
  runs: ShopifyProductSyncHistoryRun[];
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

const fallbackHistory = (): ShopifyProductSyncHistoryState => ({
  runs: [
    {
      id: "sync-run-1001",
      systemMessageId: "SMSG-1001",
      createdTime: "2026-04-27 09:15",
      bulkOperationStatus: "completed",
      bulkOperationStatusLabel: "Completed",
      mdmStatus: "completed-with-errors",
      mdmStatusLabel: "Completed with errors",
      bulkOperationId: "gid://shopify/BulkOperation/1001",
      objectCount: 50,
      mdmImportId: "MDM-1001",
      totalRecordCount: 50,
      failedRecordCount: 5,
      operations: [
        {
          id: "sync-run-1001-system",
          title: "System message id",
          subtitle: "Created time",
          status: STATUS_COMPLETED,
          statusLabel: "Completed",
          detailType: "Shopify bulk operation"
        },
        {
          id: "sync-run-1001-shopify",
          title: "Shopify bulk operation Id",
          subtitle: "Created time",
          status: STATUS_COMPLETED,
          statusLabel: "Completed",
          metricValue: 50,
          metricLabel: "object count",
          actionLabel: "view query",
          detailType: "Shopify bulk operation"
        },
        {
          id: "sync-run-1001-mdm",
          title: "HotWax bulk import id",
          subtitle: "Created time",
          status: STATUS_COMPLETED_WITH_ERRORS,
          statusLabel: "Completed with errors",
          metricValue: 50,
          metricLabel: "total record count",
          actionLabel: "5 failed record count",
          detailType: "MDM bulk operation"
        }
      ]
    },
    {
      id: "sync-run-1000",
      systemMessageId: "SMSG-1000",
      createdTime: "2026-04-27 08:45",
      bulkOperationStatus: "completed",
      bulkOperationStatusLabel: "Completed",
      mdmStatus: "completed",
      mdmStatusLabel: "Completed",
      bulkOperationId: "gid://shopify/BulkOperation/1000",
      objectCount: 44,
      mdmImportId: "MDM-1000",
      totalRecordCount: 44,
      failedRecordCount: 0,
      operations: [
        {
          id: "sync-run-1000-system",
          title: "System message id",
          subtitle: "Created time",
          status: STATUS_COMPLETED,
          statusLabel: "Completed",
          detailType: "Shopify bulk operation"
        },
        {
          id: "sync-run-1000-shopify",
          title: "Shopify bulk operation Id",
          subtitle: "Created time",
          status: STATUS_COMPLETED,
          statusLabel: "Completed",
          metricValue: 44,
          metricLabel: "object count",
          actionLabel: "view query",
          detailType: "Shopify bulk operation"
        },
        {
          id: "sync-run-1000-mdm",
          title: "HotWax bulk import id",
          subtitle: "Created time",
          status: STATUS_COMPLETED,
          statusLabel: "Completed",
          metricValue: 44,
          metricLabel: "total record count",
          actionLabel: "0 failed record count",
          detailType: "MDM bulk operation"
        }
      ]
    }
  ],
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

const fetchShopifyShopProductCount = async (payload: any): Promise<ShopifyShopProductCount> => {
  return callBackend(
    {
      url: `oms/shopifyShops/${payload.shopId}/productSync/shopifyShopProducts/count`,
      method: "get"
    },
    {
      count: 0,
      backendAvailable: false
    }
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

const fetchHistory = async (payload: any): Promise<ShopifyProductSyncHistoryState> => {
  const history = await callBackend(
    {
      url: `oms/shopifyShops/${payload.shopId}/productSync/history`,
      method: "get",
      params: {
        limit: 20
      }
    },
    fallbackHistory()
  );

  return {
    ...history,
    runs: (history.runs || []).slice(0, 20)
  };
};

export const ShopifyProductSyncService = {
  fetchShopifyShopProductCount,
  fetchSetupState,
  fetchProductStoreContext,
  fetchReviewStats,
  fetchPreflight,
  startInitialImport,
  fetchProgress,
  fetchReconcile,
  fetchHistory
};
