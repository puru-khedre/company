import api from "@/api";
import logger from "@/logger";
import { PRODUCT_SYNC_MIGRATION_CONFIG, isProductSyncMigrationEligibleRelease } from "@/config/productSyncMigration";
import { ShopifyProductSyncService } from "@/services/ShopifyProductSyncService";

export type ProductSyncMigrationEntryAction = "current" | "setup" | "request-upgrade";

export interface ProductSyncMigrationTeardownStep {
  kind: "type" | "job" | "message";
  id: string;
  label: string;
  status: "processing" | "done" | "skipped" | "failed";
  error?: string;
}

export interface ProductSyncMigrationTeardownResult {
  failedSteps: ProductSyncMigrationTeardownStep[];
  legacySystemMessageTypes: ProductSyncMigrationLegacyItem[];
  legacyServiceJobs: ProductSyncMigrationLegacyItem[];
  legacySystemMessages: ProductSyncMigrationLegacyItem[];
  legacySystemMessagesTotalCount: number;
  legacySystemMessageRemoteIds: string[];
}

export interface ProductSyncMigrationEligibility {
  componentRelease: string;
  minimumComponentRelease: string;
  isEligible: boolean;
}

export interface ProductSyncMigrationArtifactCheck {
  id: string;
  label: string;
  status: "verified" | "missing" | "checking";
  note: string;
  isPaused?: boolean;
  jobDetail?: any;
}

export interface ProductSyncMigrationLegacyItem {
  id: string;
  label: string;
  status: "active" | "deprecated" | "deactivated" | "cancelled" | "terminal" | "missing" | "failed" | "checking";
  note: string;
}

export interface ProductSyncMigrationAssistantState {
  componentRelease: string;
  minimumComponentRelease: string;
  isEligible: boolean | null;
  hasNewProductSyncMessages: boolean | null;
  systemMessageRemoteId: string;
  legacySystemMessageRemoteIds: string[];
  legacySystemMessagesTotalCount: number;
  syncJobConfigured: boolean | null;
  syncJobName: string;
  artifactChecks: ProductSyncMigrationArtifactCheck[];
  legacySystemMessageTypes: ProductSyncMigrationLegacyItem[];
  legacyServiceJobs: ProductSyncMigrationLegacyItem[];
  legacySystemMessages: ProductSyncMigrationLegacyItem[];
}

function getShopId(payload: any) {
  return String(payload?.shopId || payload?.id || payload?.shop?.shopId || "").trim();
}

function buildDeprecatedLabel(value: string, fallback: string) {
  const normalizedValue = String(value || fallback || "").trim();
  if (!normalizedValue) return "Deprecated";
  if (/deprecated/i.test(normalizedValue)) return normalizedValue;
  return `${normalizedValue} [Deprecated]`;
}

function normalizeStatusId(value: string) {
  return String(value || "").trim().toLowerCase();
}

function isTerminalLegacyMessageStatus(statusId: string) {
  const normalizedStatusId = normalizeStatusId(statusId);
  return normalizedStatusId === "smsgconfirmed" ||
    normalizedStatusId === "confirmed" ||
    normalizedStatusId === "smsgconsumed" ||
    normalizedStatusId === "consumed";
}

function getLegacySystemMessageLabel(message: any) {
  return String(message?.systemMessageTypeId || message?.systemMessageId || "Legacy system message").trim();
}

function isLegacyProductSyncMessage(systemMessage: any, systemMessageTypeId: string) {
  return String(systemMessage?.systemMessageTypeId || "").trim() === String(systemMessageTypeId || "").trim();
}

async function fetchMaargInfo() {
  const response = await api({
    url: "admin/maarg",
    method: "GET"
  }) as any;

  if (!response?.data || typeof response.data !== "object") {
    throw new Error("Maarg version response is unavailable.");
  }

  return response.data;
}

async function fetchEligibility(): Promise<ProductSyncMigrationEligibility> {
  const maargInfo = await fetchMaargInfo();
  const componentRelease = String(maargInfo?.instanceInfo?.componentRelease || "").trim();

  return {
    componentRelease,
    minimumComponentRelease: PRODUCT_SYNC_MIGRATION_CONFIG.minimumComponentRelease,
    isEligible: isProductSyncMigrationEligibleRelease(componentRelease)
  };
}

async function fetchSystemMessageTypeEntity(systemMessageTypeId: string) {
  const response = await api({
    url: "admin/systemMessages/types",
    method: "GET",
    params: {
      systemMessageTypeId,
      pageSize: 1
    }
  }) as any;

  return Array.isArray(response?.data) ? response.data[0] : undefined;
}

async function fetchDataManagerConfigEntity(configId: string) {
  const response = await api({
    url: `admin/dataManager/${encodeURIComponent(configId)}`,
    method: "GET"
  }) as any;

  return response?.data;
}

async function fetchServiceJobEntity(jobName: string) {
  const response = await api({
    url: `admin/serviceJobs/${jobName}`,
    method: "GET",
    params: {
      pageSize: 1
    }
  }) as any;

  return response?.data?.jobDetail;
}

async function fetchServiceJobCheck(jobName: string, label: string, note: string): Promise<ProductSyncMigrationArtifactCheck> {
  try {
    const jobDetail = await fetchServiceJobEntity(jobName);

    return {
      id: jobName,
      label,
      status: jobDetail?.jobName ? "verified" : "missing",
      note,
      isPaused: jobDetail?.paused === "Y",
      jobDetail
    };
  } catch (error) {
    logger.warn(`Failed to verify service job ${jobName}`, error);
    return {
      id: jobName,
      label,
      status: "missing",
      note
    };
  }
}

async function fetchSystemMessageTypeCheck(systemMessageTypeId: string, label: string, note: string): Promise<ProductSyncMigrationArtifactCheck> {
  try {
    const systemMessageType = await fetchSystemMessageTypeEntity(systemMessageTypeId);

    return {
      id: systemMessageTypeId,
      label,
      status: systemMessageType?.systemMessageTypeId ? "verified" : "missing",
      note
    };
  } catch (error) {
    logger.warn(`Failed to verify system message type ${systemMessageTypeId}`, error);
    return {
      id: systemMessageTypeId,
      label,
      status: "missing",
      note
    };
  }
}

async function fetchDataManagerConfigCheck(configId: string, label: string, note: string): Promise<ProductSyncMigrationArtifactCheck> {
  try {
    const config = await fetchDataManagerConfigEntity(configId);

    return {
      id: configId,
      label,
      status: config?.configId ? "verified" : "missing",
      note
    };
  } catch (error) {
    logger.warn(`Failed to verify data manager config ${configId}`, error);
    return {
      id: configId,
      label,
      status: "missing",
      note
    };
  }
}

async function fetchDataDocumentCheck(dataDocumentId: string, label: string, note: string): Promise<ProductSyncMigrationArtifactCheck> {
  try {
    // Attempt a minimal query to verify document existence
    await api({
      url: "oms/dataDocumentView",
      method: "POST",
      data: {
        dataDocumentId,
        pageSize: 0
      }
    });

    return {
      id: dataDocumentId,
      label,
      status: "verified",
      note
    };
  } catch (error) {
    logger.warn(`Failed to verify data document ${dataDocumentId}`, error);
    return {
      id: dataDocumentId,
      label,
      status: "missing",
      note
    };
  }
}

async function fetchLegacySystemMessageRemoteIds(payload: any) {
  try {
    const systemMessageRemoteIds = await ShopifyProductSyncService.fetchShopSystemMessageRemoteId({
      shopId: payload?.shopId,
      shop: payload?.shop,
      returnAllSystemMessageRemoteIds: true
    });

    return Array.isArray(systemMessageRemoteIds) ? systemMessageRemoteIds : [];
  } catch (error) {
    logger.warn("Failed to resolve legacy system message remotes for product sync migration", error);
    return [];
  }
}

async function fetchLegacySystemMessageTypeState(): Promise<ProductSyncMigrationLegacyItem[]> {
  return Promise.all(PRODUCT_SYNC_MIGRATION_CONFIG.outgoing.systemMessageTypes.map(async (systemMessageTypeId) => {
    try {
      const systemMessageType = await fetchSystemMessageTypeEntity(systemMessageTypeId);
      if (!systemMessageType?.systemMessageTypeId) {
        return {
          id: systemMessageTypeId,
          label: systemMessageTypeId,
          status: "missing",
          note: "This legacy system message type is not present."
        } as ProductSyncMigrationLegacyItem;
      }

      const executionFields = [
        systemMessageType.sendServiceName,
        systemMessageType.consumeServiceName,
        systemMessageType.sendPath,
        systemMessageType.receivePath,
        systemMessageType.receiveMovePath,
        systemMessageType.receiveFilePattern,
        systemMessageType.receiveResponseEnumId
      ].filter((value: string) => String(value || "").trim());
      const isDeprecated = /deprecated/i.test(String(systemMessageType.description || "")) || !executionFields.length;

      return {
        id: systemMessageTypeId,
        label: systemMessageTypeId,
        status: isDeprecated ? "deprecated" : "active",
        note: isDeprecated ?
          "Already marked deprecated or no longer has active service bindings." :
          "Still has active service bindings and should be deprecated."
      } as ProductSyncMigrationLegacyItem;
    } catch (error) {
      logger.warn(`Failed to inspect legacy system message type ${systemMessageTypeId}`, error);
      return {
        id: systemMessageTypeId,
        label: systemMessageTypeId,
        status: "failed",
        note: "This legacy system message type could not be verified."
      } as ProductSyncMigrationLegacyItem;
    }
  }));
}

async function fetchLegacyServiceJobState(): Promise<ProductSyncMigrationLegacyItem[]> {
  return Promise.all(PRODUCT_SYNC_MIGRATION_CONFIG.outgoing.serviceJobs.map(async (jobName) => {
    try {
      const jobDetail = await fetchServiceJobEntity(jobName);
      if (!jobDetail?.jobName) {
        return {
          id: jobName,
          label: jobName,
          status: "missing",
          note: "This legacy service job is not present."
        } as ProductSyncMigrationLegacyItem;
      }

      const serviceName = String(jobDetail.serviceName || "").trim();
      const isDeactivated = String(jobDetail.paused || "").toUpperCase() === "Y" || serviceName === "_NA_" || !serviceName;

      return {
        id: jobName,
        label: jobName,
        status: isDeactivated ? "deactivated" : "active",
        note: isDeactivated ?
          "Already paused or configured as a no-op job." :
          "Still points to an executable service and should be deactivated."
      } as ProductSyncMigrationLegacyItem;
    } catch (error) {
      logger.warn(`Failed to inspect legacy service job ${jobName}`, error);
      return {
        id: jobName,
        label: jobName,
        status: "failed",
        note: "This legacy service job could not be verified."
      } as ProductSyncMigrationLegacyItem;
    }
  }));
}

async function fetchLegacySystemMessages(payload: any): Promise<{ items: ProductSyncMigrationLegacyItem[]; totalCount: number }> {
  const systemMessageRemoteIds = payload?.legacySystemMessageRemoteIds?.length ?
    payload.legacySystemMessageRemoteIds :
    await fetchLegacySystemMessageRemoteIds(payload);

  if (!systemMessageRemoteIds.length) {
    return {
      items: [],
      totalCount: 0
    };
  }

  const systemMessages: any[] = [];
  const previewLimit = payload?.previewLimit || 25;
  const pageSize = payload?.includeAllSystemMessages ? 250 : 10;

  for (const systemMessageTypeId of PRODUCT_SYNC_MIGRATION_CONFIG.outgoing.systemMessageTypes) {
    let pageIndex = 0;
    let shouldContinue = true;

    while (shouldContinue) {
      const response = await api({
        url: "admin/systemMessages",
        method: "GET",
        params: {
          systemMessageTypeId,
          systemMessageRemoteId: systemMessageRemoteIds,
          systemMessageRemoteId_op: "in",
          orderBy: "-initDate",
          pageIndex,
          pageSize
        }
      }) as any;

      const page = (Array.isArray(response?.data?.systemMessages) ? response.data.systemMessages : [])
        .filter((systemMessage: any) => isLegacyProductSyncMessage(systemMessage, systemMessageTypeId));

      systemMessages.push(...page);
      pageIndex++;

      if (!payload?.includeAllSystemMessages && systemMessages.length >= previewLimit) {
        shouldContinue = false;
      } else if (page.length < pageSize) {
        shouldContinue = false;
      }
    }

    if (!payload?.includeAllSystemMessages && systemMessages.length >= previewLimit) {
      break;
    }
  }

  const dedupedSystemMessages = systemMessages.filter((systemMessage: any, index: number, list: any[]) => {
    const systemMessageId = String(systemMessage?.systemMessageId || "").trim();
    return !!systemMessageId && list.findIndex((item: any) => String(item?.systemMessageId || "").trim() === systemMessageId) === index;
  });

  return {
    items: dedupedSystemMessages.map((systemMessage: any) => {
      const statusId = String(systemMessage?.statusId || "").trim();
      const normalizedStatusId = normalizeStatusId(statusId);
      let status: ProductSyncMigrationLegacyItem["status"] = "active";

      if (normalizedStatusId.includes("cancel")) {
        status = "cancelled";
      } else if (isTerminalLegacyMessageStatus(statusId)) {
        status = "terminal";
      }

      return {
        id: String(systemMessage?.systemMessageId || "").trim(),
        label: getLegacySystemMessageLabel(systemMessage),
        status,
        note: `${statusId || "Unknown status"}${systemMessage?.initDate ? ` · ${systemMessage.initDate}` : ""}`
      };
    }),
    totalCount: dedupedSystemMessages.length
  };
}

async function fetchLegacyTeardownState(payload: any) {
  const legacySystemMessageRemoteIds = await fetchLegacySystemMessageRemoteIds(payload);
  const [legacySystemMessageTypes, legacyServiceJobs, legacySystemMessageState] = await Promise.all([
    fetchLegacySystemMessageTypeState(),
    fetchLegacyServiceJobState(),
    fetchLegacySystemMessages({
      ...payload,
      legacySystemMessageRemoteIds
    })
  ]);

  return {
    legacySystemMessageRemoteIds,
    legacySystemMessageTypes,
    legacyServiceJobs,
    legacySystemMessages: legacySystemMessageState.items,
    legacySystemMessagesTotalCount: legacySystemMessageState.totalCount
  };
}

async function deprecateLegacySystemMessageType(systemMessageTypeId: string): Promise<void> {
  const systemMessageType = await fetchSystemMessageTypeEntity(systemMessageTypeId);
  if (!systemMessageType?.systemMessageTypeId) return;

  await api({
    url: `admin/systemMessages/types/${encodeURIComponent(systemMessageTypeId)}`,
    method: "PUT",
    data: {
      systemMessageTypeId,
      description: buildDeprecatedLabel(systemMessageType.description, systemMessageTypeId),
      parentTypeId: systemMessageType.parentTypeId || "",
      sendServiceName: "",
      consumeServiceName: "",
      sendPath: "",
      receivePath: "",
      receiveMovePath: "",
      receiveFilePattern: "",
      receiveResponseEnumId: ""
    }
  });
}

async function deactivateLegacyServiceJob(jobName: string): Promise<void> {
  const jobDetail = await fetchServiceJobEntity(jobName);
  if (!jobDetail?.jobName) return;

  await api({
    url: `admin/serviceJobs/${encodeURIComponent(jobName)}`,
    method: "PUT",
    data: {
      jobName,
      description: buildDeprecatedLabel(jobDetail.description, jobName),
      paused: "Y",
      serviceName: "_NA_",
      cronExpression: jobDetail.cronExpression || "",
      serviceJobParameters: Array.isArray(jobDetail.serviceJobParameters) ? jobDetail.serviceJobParameters : []
    }
  });
}

async function enableServiceJob(jobName: string, jobDetail: any): Promise<void> {
  if (!jobDetail || !jobDetail.jobName) {
    throw new Error(`Job details missing for ${jobName}`);
  }

  await api({
    url: `admin/serviceJobs/${encodeURIComponent(jobName)}`,
    method: "PUT",
    data: {
      jobName: jobDetail.jobName,
      description: jobDetail.description || "",
      paused: "N",
      serviceName: jobDetail.serviceName || "",
      cronExpression: jobDetail.cronExpression || "",
      serviceJobParameters: Array.isArray(jobDetail.serviceJobParameters) ? jobDetail.serviceJobParameters : []
    }
  });
}

async function cancelLegacySystemMessage(systemMessageId: string): Promise<void> {
  await api({
    url: `admin/systemMessages/${encodeURIComponent(systemMessageId)}/cancel`,
    method: "POST"
  });
}

async function teardownLegacySync(
  payload: any,
  onProgress?: (step: ProductSyncMigrationTeardownStep) => void
): Promise<ProductSyncMigrationTeardownResult> {
  const legacyTeardownState = await fetchLegacyTeardownState({
    ...payload,
    includeAllSystemMessages: true
  });

  const failedSteps: ProductSyncMigrationTeardownStep[] = [];

  // Step 1: deprecate legacy system message types
  for (const systemMessageType of legacyTeardownState.legacySystemMessageTypes) {
    if (systemMessageType.status !== "active") {
      onProgress?.({
        kind: "type",
        id: systemMessageType.id,
        label: systemMessageType.label || systemMessageType.id,
        status: "skipped"
      });
      continue;
    }

    onProgress?.({
      kind: "type",
      id: systemMessageType.id,
      label: systemMessageType.label || systemMessageType.id,
      status: "processing"
    });

    try {
      await deprecateLegacySystemMessageType(systemMessageType.id);
      onProgress?.({
        kind: "type",
        id: systemMessageType.id,
        label: systemMessageType.label || systemMessageType.id,
        status: "done"
      });
    } catch (error: any) {
      const errorMessage = error?.message || `Failed to deprecate ${systemMessageType.id}`;
      logger.warn(`Failed to deprecate legacy system message type ${systemMessageType.id}`, error);
      const step: ProductSyncMigrationTeardownStep = {
        kind: "type",
        id: systemMessageType.id,
        label: systemMessageType.label || systemMessageType.id,
        status: "failed",
        error: errorMessage
      };
      failedSteps.push(step);
      onProgress?.(step);
    }
  }

  // Step 2: deactivate legacy service jobs
  for (const serviceJob of legacyTeardownState.legacyServiceJobs) {
    if (serviceJob.status !== "active") {
      onProgress?.({
        kind: "job",
        id: serviceJob.id,
        label: serviceJob.label || serviceJob.id,
        status: "skipped"
      });
      continue;
    }

    onProgress?.({
      kind: "job",
      id: serviceJob.id,
      label: serviceJob.label || serviceJob.id,
      status: "processing"
    });

    try {
      await deactivateLegacyServiceJob(serviceJob.id);
      onProgress?.({
        kind: "job",
        id: serviceJob.id,
        label: serviceJob.label || serviceJob.id,
        status: "done"
      });
    } catch (error: any) {
      const errorMessage = error?.message || `Failed to deactivate ${serviceJob.id}`;
      logger.warn(`Failed to deactivate legacy service job ${serviceJob.id}`, error);
      const step: ProductSyncMigrationTeardownStep = {
        kind: "job",
        id: serviceJob.id,
        label: serviceJob.label || serviceJob.id,
        status: "failed",
        error: errorMessage
      };
      failedSteps.push(step);
      onProgress?.(step);
    }
  }

  // Step 3: cancel legacy system messages (skip already-terminal ones)
  for (const systemMessage of legacyTeardownState.legacySystemMessages) {
    if (systemMessage.status !== "active") {
      onProgress?.({
        kind: "message",
        id: systemMessage.id,
        label: systemMessage.label || systemMessage.id,
        status: "skipped"
      });
      continue;
    }

    onProgress?.({
      kind: "message",
      id: systemMessage.id,
      label: systemMessage.label || systemMessage.id,
      status: "processing"
    });

    try {
      await cancelLegacySystemMessage(systemMessage.id);
      onProgress?.({
        kind: "message",
        id: systemMessage.id,
        label: systemMessage.label || systemMessage.id,
        status: "done"
      });
    } catch (error: any) {
      const errorMessage = error?.message || `Failed to cancel message ${systemMessage.id}`;
      logger.warn(`Failed to cancel legacy system message ${systemMessage.id}`, error);
      const step: ProductSyncMigrationTeardownStep = {
        kind: "message",
        id: systemMessage.id,
        label: systemMessage.label || systemMessage.id,
        status: "failed",
        error: errorMessage
      };
      failedSteps.push(step);
      onProgress?.(step);
    }
  }

  const refreshedState = await fetchLegacyTeardownState(payload);
  return {
    failedSteps,
    ...refreshedState
  };
}

async function fetchAssistantState(
  payload: any,
  onProgress?: (state: Partial<ProductSyncMigrationAssistantState>) => void
): Promise<ProductSyncMigrationAssistantState> {
  const shopId = getShopId(payload);
  const state: ProductSyncMigrationAssistantState = {
    componentRelease: "",
    minimumComponentRelease: PRODUCT_SYNC_MIGRATION_CONFIG.minimumComponentRelease,
    isEligible: null,
    hasNewProductSyncMessages: null,
    systemMessageRemoteId: "",
    legacySystemMessageRemoteIds: [],
    legacySystemMessagesTotalCount: 0,
    syncJobConfigured: null,
    syncJobName: "",
    artifactChecks: [],
    legacySystemMessageTypes: [],
    legacyServiceJobs: [],
    legacySystemMessages: []
  };

  // 1. Eligibility Check
  try {
    const eligibility = await fetchEligibility();
    state.componentRelease = eligibility.componentRelease;
    state.isEligible = eligibility.isEligible;
    onProgress?.({
      componentRelease: state.componentRelease,
      isEligible: state.isEligible
    });
  } catch (error) {
    logger.warn("Failed to verify eligibility", error);
    state.isEligible = false;
    onProgress?.({ isEligible: false });
  }

  // 2. Artifact Checks (Base infrastructure)
  const artifactCheckDefinitions = [
    { id: PRODUCT_SYNC_MIGRATION_CONFIG.incoming.serviceJobs.baseSync, type: "job", label: "Base sync job", note: "Shared template job required before the app can configure a per-shop sync." },
    { id: PRODUCT_SYNC_MIGRATION_CONFIG.incoming.serviceJobs.send, type: "job", label: "Send produced messages job", note: "Shared sender for new product sync system messages." },
    { id: PRODUCT_SYNC_MIGRATION_CONFIG.incoming.serviceJobs.poll, type: "job", label: "Poll bulk operation results job", note: "Shared poller for completed Shopify bulk query results." },
    { id: PRODUCT_SYNC_MIGRATION_CONFIG.incoming.systemMessageTypes.productSync, type: "systemMessageType", label: "New product sync message type", note: "Required message type for the bulk-query product sync flow." },
    { id: PRODUCT_SYNC_MIGRATION_CONFIG.incoming.dataManagerConfig, type: "dataManagerConfig", label: "Data manager config", note: "Required config for processing imported Shopify product sync files." },
    { id: "SERVICE_JOB_PARAMETER", type: "dataDocument", label: "Service job parameters document", note: "Required for verifying per-shop sync job configuration via Data Document." },
    { id: "DATA_MANAGER_LOG_AND_PARAMETER", type: "dataDocument", label: "Data manager logs document", note: "Required for tracking sync progress and error counts via Data Document." },
    { id: "PROD_STORE_PRODUCTS_COUNT", type: "dataDocument", label: "Product store counts document", note: "Required for preflight checks and catalog metrics via Data Document." }

  ];

  state.artifactChecks = artifactCheckDefinitions.map(def => ({ id: def.id, label: def.label, note: def.note, status: "checking" }));
  onProgress?.({ artifactChecks: [...state.artifactChecks] });

  // Process artifact checks concurrently and update state piece by piece
  await Promise.all(artifactCheckDefinitions.map(async (def, index) => {
    let result: ProductSyncMigrationArtifactCheck;
    if (def.type === "systemMessageType") {
      result = await fetchSystemMessageTypeCheck(def.id, def.label, def.note);
    } else if (def.type === "dataManagerConfig") {
      result = await fetchDataManagerConfigCheck(def.id, def.label, def.note);
    } else if (def.type === "dataDocument") {
      result = await fetchDataDocumentCheck(def.id, def.label, def.note);
    } else {
      result = await fetchServiceJobCheck(def.id, def.label, def.note);
    }
    state.artifactChecks[index] = result;
    onProgress?.({ artifactChecks: [...state.artifactChecks] });
  }));

  // 3. Per-shop sync job configuration
  if (shopId) {
    try {
      const syncJobConfig = await ShopifyProductSyncService.fetchSyncJobConfig({ shopId });
      state.syncJobConfigured = syncJobConfig.isConfigured;
      state.syncJobName = syncJobConfig.jobName || "";
      onProgress?.({
        syncJobConfigured: state.syncJobConfigured,
        syncJobName: state.syncJobName
      });
    } catch (error) {
      logger.warn("Failed to verify per-shop product sync job configuration", error);
      state.syncJobConfigured = false;
      onProgress?.({ syncJobConfigured: false });
    }
  }

  // 4. Detect existing new product sync messages or history
  if (shopId) {
    try {
      state.systemMessageRemoteId = await ShopifyProductSyncService.fetchShopSystemMessageRemoteId({
        shopId,
        shop: payload?.shop
      });
      const syncRunState = await ShopifyProductSyncService.fetchProductUpdateSyncRunState({
        systemMessageRemoteId: state.systemMessageRemoteId,
        shopId
      });
      state.hasNewProductSyncMessages = !!syncRunState.latestSystemMessage || !!syncRunState.systemMessages?.length;

      if (!state.hasNewProductSyncMessages) {
        const response = await api({
          url: `oms/shopifyShops/${shopId}/productSync/history`,
          method: "GET",
          params: { limit: 1 }
        }) as any;
        state.hasNewProductSyncMessages = Array.isArray(response?.data?.runs) && response.data.runs.length > 0;
      }
      onProgress?.({
        hasNewProductSyncMessages: state.hasNewProductSyncMessages,
        systemMessageRemoteId: state.systemMessageRemoteId
      });
    } catch (error) {
      logger.warn("Failed to detect existing product sync history for shop", error);
      state.hasNewProductSyncMessages = false;
      onProgress?.({ hasNewProductSyncMessages: false });
    }
  }

  // 5. Legacy Teardown State
  try {
    state.legacySystemMessageRemoteIds = await fetchLegacySystemMessageRemoteIds({
      shopId,
      shop: payload?.shop
    });
    onProgress?.({ legacySystemMessageRemoteIds: state.legacySystemMessageRemoteIds });

    // Fetch legacy items in parallel blocks
    const [legacyTypes, legacyJobs, legacyMessages] = await Promise.all([
      fetchLegacySystemMessageTypeState(),
      fetchLegacyServiceJobState(),
      fetchLegacySystemMessages({
        shopId,
        shop: payload?.shop,
        legacySystemMessageRemoteIds: state.legacySystemMessageRemoteIds,
        includeAllSystemMessages: false
      })
    ]);

    state.legacySystemMessageTypes = legacyTypes;
    state.legacyServiceJobs = legacyJobs;
    state.legacySystemMessages = legacyMessages.items;
    state.legacySystemMessagesTotalCount = legacyMessages.totalCount;

    onProgress?.({
      legacySystemMessageTypes: state.legacySystemMessageTypes,
      legacyServiceJobs: state.legacyServiceJobs,
      legacySystemMessages: state.legacySystemMessages,
      legacySystemMessagesTotalCount: state.legacySystemMessagesTotalCount
    });
  } catch (error) {
    logger.warn("Failed to inspect legacy product sync teardown state", error);
  }

  return state;
}

function resolveEntryAction(payload: Pick<ProductSyncMigrationAssistantState, "hasNewProductSyncMessages" | "isEligible">): ProductSyncMigrationEntryAction {
  if (payload.hasNewProductSyncMessages === true) {
    return "current";
  }

  if (payload.isEligible === true) {
    return "setup";
  }

  return "request-upgrade";
}

export const ShopifyProductSyncMigrationService = {
  fetchAssistantState,
  fetchEligibility,
  fetchLegacyTeardownState,
  resolveEntryAction,
  teardownLegacySync,
  enableServiceJob
};

