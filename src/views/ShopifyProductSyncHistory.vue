<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="'/shopify-connection-details/' + id + '/product-sync'" />
        </ion-buttons>
        <ion-title>{{ translate("Product sync history") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list lines="full">
        <ion-list-header>
          <ion-label>{{ translate("Filters") }}</ion-label>
        </ion-list-header>
        <ion-item>
          <ion-select
            :label="translate('System message status')"
            :value="filters.statusId"
            interface="popover"
            @ionChange="handleStatusFilterChange($event.detail.value)"
          >
            <ion-select-option value="">{{ translate("All statuses") }}</ion-select-option>
            <ion-select-option v-for="status in statusFilterOptions" :key="status.value" :value="status.value">
              {{ status.label }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-input
            :label="translate('Created after')"
            type="datetime-local"
            :value="filters.createdAfter"
            @ionChange="handleCreatedAfterFilterChange($event.detail.value)"
          />
        </ion-item>
        <ion-item>
          <ion-input
            :label="translate('Created before')"
            type="datetime-local"
            :value="filters.createdBefore"
            @ionChange="handleCreatedBeforeFilterChange($event.detail.value)"
          />
        </ion-item>
      </ion-list>
      <ion-card v-if="isLoading">
        <ion-card-header>
          <ion-card-title>{{ translate("Loading product sync") }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-spinner name="crescent" />
        </ion-card-content>
      </ion-card>

      <ion-card v-else-if="loadErrorMessage">
        <ion-card-header>
          <ion-card-title>{{ translate("Product sync history could not load") }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>{{ loadErrorMessage }}</p>
          <ion-button fill="outline" @click="loadHistory">{{ translate("Retry") }}</ion-button>
        </ion-card-content>
      </ion-card>

      <shopify-product-sync-history-view
        v-else
        :runs="historyRuns"
        @download-raw-file="downloadRawShopifyFile"
      />

      <ion-infinite-scroll
        :disabled="!hasMoreHistory || isLoadingMore"
        @ionInfinite="loadMoreHistory"
      >
        <ion-infinite-scroll-content
          loading-spinner="crescent"
          :loading-text="translate('Loading more history')"
        />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  onIonViewWillEnter,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar
} from "@ionic/vue";
import { translate } from "@/i18n";
import { computed, defineProps, reactive, ref } from "vue";
import { useStore } from "vuex";
import logger from "@/logger";
import ShopifyProductSyncHistoryView from "@/components/ShopifyProductSyncHistoryView.vue";
import { ShopifyProductSyncService } from "@/services/ShopifyProductSyncService";
import { useSystemMessage } from "@/composables/useSystemMessage";
import { useShopifyProductSyncRun } from "@/composables/useShopifyProductSyncRun";
import { useDataManagerLog } from "@/composables/useDataManagerLog";
import { showToast } from "@/utils";
import {
  getSystemMessageTime,
  hasMoreForwardSystemMessagePages,
  shouldReadSystemMessagePagesBackwards,
  sortSystemMessagesNewestFirst
} from "@/utils/systemMessageHistory";

const props = defineProps(["id"]);
const store = useStore();
const { fetchSystemMessagesPage } = useSystemMessage();

const { fetchSyncRun } = useShopifyProductSyncRun();
const { downloadDataManagerFile } = useDataManagerLog();

const PAGE_SIZE = 25;

const isLoading = ref(true);
const isLoadingMore = ref(false);
const loadErrorMessage = ref("");
const pageIndex = ref(0);
const reversePageIndex = ref(-1);
const backendHistoryCount = ref(0);
const hasMoreBackendHistory = ref(false);
const historyPageMode = ref<"unknown" | "forward" | "reverse">("unknown");
const bufferedSystemMessages = ref<any[]>([]);
const systemMessageRemoteId = ref("");
let historyLoadToken = 0;

interface ShopifyProductSyncHistoryRun {
  id: string;
  createdTime: any;
  systemMessageStatus: string;
  systemMessageStatusColor: string;
  bulkOperationId: string;
  bulkOperationStatus: string;
  bulkOperationStatusLabel: string;
  bulkOperationStatusColor: string;
  queryContent: string;
  objectCount: number;
  mdmImportId: string;
  mdmStatus: string;
  mdmStatusLabel: string;
  mdmStatusColor: string;
  totalRecordCount: number;
  failedRecordCount: number;
  mdmLogContentId: string;
  mdmLogConfigId: string;
  mdmLogFileName: string;
  loading?: boolean;
}

const historyRuns = ref<ShopifyProductSyncHistoryRun[]>([]);
const filters = reactive({
  statusId: "",
  createdAfter: "",
  createdBefore: ""
});
const statusFilterOptions = [
  { value: "SmsgProduced", label: translate("Produced") },
  { value: "SmsgSent", label: translate("Sent") },
  { value: "SmsgReceived", label: translate("Received") },
  { value: "SmsgConsumed", label: translate("Consumed") },
  { value: "SmsgConfirmed", label: translate("Confirmed") },
  { value: "SmsgError", label: translate("Error") }
];

const shop = computed(() => store.getters["shopify/getShopById"](props.id) || {});
const hasMoreHistory = computed(() => bufferedSystemMessages.value.length > 0 || hasMoreBackendHistory.value);

onIonViewWillEnter(async () => {
  await loadHistory();
});

async function loadHistory() {
  const loadToken = ++historyLoadToken;
  isLoading.value = true;
  loadErrorMessage.value = "";
  try {
    if (!shop.value.shopId) {
      await store.dispatch("shopify/fetchShopifyShops");
    }

    if (isStaleHistoryLoad(loadToken)) return;

    const resolvedSystemMessageRemoteId = await ShopifyProductSyncService.fetchShopSystemMessageRemoteId({
      shopId: props.id,
      shopifyShopId: shop.value.shopifyShopId,
      shop: shop.value
    });

    if (isStaleHistoryLoad(loadToken)) return;

    systemMessageRemoteId.value = resolvedSystemMessageRemoteId;
    if (!systemMessageRemoteId.value) {
      throw new Error("Could not resolve systemMessageRemoteId");
    }

    historyRuns.value = [];
    pageIndex.value = 0;
    reversePageIndex.value = -1;
    backendHistoryCount.value = 0;
    hasMoreBackendHistory.value = true;
    historyPageMode.value = "unknown";
    bufferedSystemMessages.value = [];
    await fetchHistoryPage(loadToken);
  } catch (error: any) {
    if (isStaleHistoryLoad(loadToken)) return;
    logger.error(error);
    loadErrorMessage.value = getErrorMessage(error, translate("Failed to load product sync history"));
    showToast(translate("Failed to load product sync history"));
    historyRuns.value = [];
    hasMoreBackendHistory.value = false;
  } finally {
    if (!isStaleHistoryLoad(loadToken)) isLoading.value = false;
  }
}

async function fetchHistoryPage(loadToken = historyLoadToken) {
  if (isStaleHistoryLoad(loadToken)) return;

  const systemMessages: any[] = [];

  bufferedSystemMessages.value = appendSystemMessagesToHistoryPage(systemMessages, bufferedSystemMessages.value);

  while (systemMessages.length < PAGE_SIZE && hasMoreBackendHistory.value) {
    if (isStaleHistoryLoad(loadToken)) return;

    const response = await fetchNextSystemMessagesResponse(loadToken);
    if (!response || isStaleHistoryLoad(loadToken)) return;

    const page = getSystemMessagesPage(response).filter(matchesCreatedDateFilters);

    bufferedSystemMessages.value = appendSystemMessagesToHistoryPage(systemMessages, page);
  }

  if (isStaleHistoryLoad(loadToken)) return;

  const nextRuns = systemMessages.map(getInitialHistoryRun);
  historyRuns.value = historyRuns.value.concat(nextRuns);
  await loadRunDetails(nextRuns, systemMessages, loadToken);
}

async function fetchNextSystemMessagesResponse(loadToken = historyLoadToken) {
  if (historyPageMode.value === "reverse") return fetchReverseSystemMessagesResponse(loadToken);

  const response = await fetchSystemMessagesResponse(pageIndex.value);
  if (isStaleHistoryLoad(loadToken)) return null;

  const page = getSystemMessagesPage(response);
  backendHistoryCount.value = getSystemMessagesCount(response, page);

  if (historyPageMode.value === "unknown") {
    historyPageMode.value = shouldReadPagesBackwards(page, backendHistoryCount.value) ? "reverse" : "forward";
    if (historyPageMode.value === "reverse") {
      reversePageIndex.value = Math.max(Math.ceil(backendHistoryCount.value / PAGE_SIZE) - 1, 0);
      return fetchReverseSystemMessagesResponse(loadToken);
    }
  }

  pageIndex.value += 1;
  hasMoreBackendHistory.value = hasMoreForwardSystemMessagePages(page, pageIndex.value, backendHistoryCount.value, PAGE_SIZE);

  return {
    ...response,
    systemMessages: sortSystemMessagesNewestFirst(page)
  };
}

async function fetchReverseSystemMessagesResponse(loadToken = historyLoadToken) {
  const response = await fetchSystemMessagesResponse(reversePageIndex.value);
  if (isStaleHistoryLoad(loadToken)) return null;

  const page = getSystemMessagesPage(response);
  backendHistoryCount.value = getSystemMessagesCount(response, page);
  reversePageIndex.value -= 1;
  hasMoreBackendHistory.value = page.length > 0 && reversePageIndex.value >= 0;

  return {
    ...response,
    systemMessages: sortSystemMessagesNewestFirst(page)
  };
}

async function fetchSystemMessagesResponse(index: number) {
  return fetchSystemMessagesPage({
    ...getSystemMessageParams(),
    pageSize: PAGE_SIZE,
    pageIndex: Math.max(index, 0)
  });
}

function getSystemMessagesPage(response: any) {
  return response?.systemMessages || [];
}

function getSystemMessagesCount(response: any, page: any[]) {
  return Number(response?.systemMessagesCount || historyRuns.value.length + page.length);
}

function getSystemMessageParams() {
  const params: any = {
    systemMessageTypeId: 'BulkQueryShopifyProductUpdates',
    systemMessageRemoteId: systemMessageRemoteId.value,
    orderBy: '-initDate'
  };

  if (filters.statusId) params.statusId = filters.statusId;

  return params;
}

function appendSystemMessagesToHistoryPage(target: any[], source: any[]) {
  if (!source.length) return [];

  const existingSystemMessageIds = new Set([
    ...historyRuns.value.map((run) => run.id),
    ...target.map((systemMessage) => systemMessage.systemMessageId)
  ]);
  const uniqueSource = source.filter((systemMessage) => {
    const systemMessageId = systemMessage?.systemMessageId;
    if (!systemMessageId || existingSystemMessageIds.has(systemMessageId)) return false;
    existingSystemMessageIds.add(systemMessageId);
    return true;
  });

  const remainingCount = PAGE_SIZE - target.length;
  if (remainingCount <= 0) return uniqueSource;

  target.push(...uniqueSource.slice(0, remainingCount));
  return uniqueSource.slice(remainingCount);
}

function isStaleHistoryLoad(loadToken: number) {
  return loadToken !== historyLoadToken;
}

function shouldReadPagesBackwards(page: any[], totalCount: number) {
  return shouldReadSystemMessagePagesBackwards(page, totalCount, PAGE_SIZE);
}

function matchesCreatedDateFilters(systemMessage: any) {
  const createdTime = getSystemMessageTime(systemMessage);
  const createdAfter = getFilterTimestamp(filters.createdAfter);
  const createdBefore = getFilterTimestamp(filters.createdBefore);

  if (createdAfter && createdTime < createdAfter) return false;
  if (createdBefore && createdTime > createdBefore) return false;
  return true;
}

function getFilterTimestamp(value: string) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getInitialHistoryRun(msg: any) {
  return {
    id: msg.systemMessageId,
    createdTime: msg.initDate,
    systemMessageStatus: msg.statusId,
    systemMessageStatusColor: "primary",
    bulkOperationId: '',
    bulkOperationStatus: "pending",
    bulkOperationStatusLabel: translate("Pending"),
    bulkOperationStatusColor: "medium",
    queryContent: "",
    objectCount: 0,
    mdmImportId: '',
    mdmStatus: "pending",
    mdmStatusLabel: translate("Pending"),
    mdmStatusColor: "medium",
    totalRecordCount: 0,
    failedRecordCount: 0,
    mdmLogContentId: "",
    mdmLogConfigId: "",
    mdmLogFileName: "",
    loading: true
  };
}

async function loadRunDetails(runs: ShopifyProductSyncHistoryRun[], systemMessages: any[], loadToken = historyLoadToken) {
  const chunkSize = 3;
  const currentMessages = [...systemMessages];

  for (let i = 0; i < runs.length; i += chunkSize) {
    if (isStaleHistoryLoad(loadToken)) return;

    const chunk = runs.slice(i, i + chunkSize);

    await Promise.all(chunk.map(async (run) => {
      const msg = currentMessages.find((message: any) => message.systemMessageId === run.id);
      const syncRun = await fetchSyncRun(run.id, msg);

      if (syncRun && !isStaleHistoryLoad(loadToken)) updateHistoryRun(run.id, {
        systemMessageStatus: syncRun.systemMessage.statusLabel,
        systemMessageStatusColor: syncRun.systemMessage.statusColor,
        bulkOperationId: syncRun.bulkOperation?.id || '',
        bulkOperationStatus: syncRun.bulkOperation?.status || '',
        bulkOperationStatusLabel: syncRun.bulkOperation?.statusLabel || translate("Pending"),
        bulkOperationStatusColor: syncRun.bulkOperation?.statusColor || "medium",
        queryContent: syncRun.bulkOperation?.query || "",
        objectCount: syncRun.bulkOperation?.objectCount || 0,
        mdmImportId: syncRun.mdmLog?.id || '',
        mdmStatus: syncRun.mdmLog?.statusId || '',
        mdmStatusLabel: syncRun.mdmLog?.statusLabel || translate("Pending"),
        mdmStatusColor: syncRun.mdmLog?.statusColor || "medium",
        totalRecordCount: syncRun.mdmLog?.totalRecordCount || 0,
        failedRecordCount: syncRun.mdmLog?.failedRecordCount || 0,
        mdmLogContentId: syncRun.mdmLog?.logContentId || "",
        mdmLogConfigId: syncRun.mdmLog?.configId || "",
        mdmLogFileName: syncRun.mdmLog?.fileName || "",
        loading: false
      });
    }));
  }
}

function updateHistoryRun(runId: string, updates: Partial<ShopifyProductSyncHistoryRun>) {
  const runIndex = historyRuns.value.findIndex((run) => run.id === runId);
  if (runIndex === -1) return;
  historyRuns.value[runIndex] = {
    ...historyRuns.value[runIndex],
    ...updates
  };
}

async function loadMoreHistory(event: CustomEvent) {
  if (!hasMoreHistory.value || isLoadingMore.value) {
    await completeInfiniteScroll(event);
    return;
  }

  isLoadingMore.value = true;
  const loadToken = historyLoadToken;
  const previousRunCount = historyRuns.value.length;
  try {
    await fetchHistoryPage(loadToken);
  } catch (error: any) {
    if (isStaleHistoryLoad(loadToken)) return;
    logger.error(error);
    historyRuns.value = historyRuns.value.slice(0, previousRunCount);
    showToast(translate("Failed to load product sync history"));
    hasMoreBackendHistory.value = false;
  } finally {
    isLoadingMore.value = false;
    await completeInfiniteScroll(event);
  }
}

async function completeInfiniteScroll(event: CustomEvent) {
  const target = event.target as any;
  await target.complete();
}

async function downloadRawShopifyFile(run: ShopifyProductSyncHistoryRun) {
  if (!run?.mdmLogConfigId || !run?.mdmLogContentId) {
    showToast(translate("Raw Shopify file is not available"));
    return;
  }

  try {
    const response = await downloadDataManagerFile(run.mdmLogConfigId, run.mdmLogContentId);
    const fileContent = getDownloadFileContent(response?.data);

    if (!fileContent) {
      throw new Error("No Data Manager file content returned");
    }

    downloadTextFile(fileContent, getRawShopifyFileName(run));
    showToast(translate("File downloaded successfully"));
  } catch (error) {
    logger.error(`Failed to download raw Shopify file for message ${run.id}`, error);
    showToast(translate("Failed to download raw Shopify file"));
  }
}

function getDownloadFileContent(data: any) {
  const fileContent = data?.csvData ?? data?.fileData ?? data?.data ?? data;
  if (typeof fileContent === "string") return fileContent;
  if (fileContent === undefined || fileContent === null) return "";
  return JSON.stringify(fileContent, null, 2);
}

function getRawShopifyFileName(run: ShopifyProductSyncHistoryRun) {
  const fileName = String(run.mdmLogFileName || "").split(/[\\/]/).pop();
  return fileName || `shopify-product-sync-${run.id}.json`;
}

function downloadTextFile(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getErrorMessage(error: any, defaultMessage: string) {
  const message = error?.response?.data?.error ||
    error?.response?.data?.errors ||
    error?.data?.error ||
    error?.message ||
    defaultMessage;
  return typeof message === "string" ? message : JSON.stringify(message);
}

async function handleStatusFilterChange(value: string) {
  filters.statusId = value || "";
  await loadHistory();
}

async function handleCreatedAfterFilterChange(value: any) {
  filters.createdAfter = String(value || "");
  await loadHistory();
}

async function handleCreatedBeforeFilterChange(value: any) {
  filters.createdBefore = String(value || "");
  await loadHistory();
}
</script>
