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

      <shopify-product-sync-history-view
        v-else
        :runs="historyRuns"
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
import { showToast } from "@/utils";
import {
  getSystemMessageTime,
  shouldReadSystemMessagePagesBackwards,
  sortSystemMessagesNewestFirst
} from "@/utils/systemMessageHistory";

const props = defineProps(["id"]);
const store = useStore();
const { fetchSystemMessagesPage } = useSystemMessage();

const { fetchSyncRun } = useShopifyProductSyncRun();

const PAGE_SIZE = 25;

const isLoading = ref(true);
const isLoadingMore = ref(false);
const pageIndex = ref(0);
const reversePageIndex = ref(-1);
const backendHistoryCount = ref(0);
const hasMoreBackendHistory = ref(false);
const historyPageMode = ref<"unknown" | "forward" | "reverse">("unknown");
const systemMessageRemoteId = ref("");

interface ShopifyProductSyncHistoryRun {
  id: string;
  createdTime: any;
  systemMessageStatus: string;
  systemMessageStatusColor: string;
  bulkOperationId: string;
  bulkOperationStatus: string;
  bulkOperationStatusLabel: string;
  bulkOperationStatusColor: string;
  objectCount: number;
  mdmImportId: string;
  mdmStatus: string;
  mdmStatusLabel: string;
  mdmStatusColor: string;
  totalRecordCount: number;
  failedRecordCount: number;
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
  { value: "SmsgConfirmed", label: translate("Confirmed") },
  { value: "SmsgError", label: translate("Error") }
];

const shop = computed(() => store.getters["shopify/getShopById"](props.id) || {});
const hasDateFilters = computed(() => !!filters.createdAfter || !!filters.createdBefore);
const hasMoreHistory = computed(() => hasMoreBackendHistory.value);

onIonViewWillEnter(async () => {
  await loadHistory();
});

async function loadHistory() {
  isLoading.value = true;
  try {
    if (!shop.value.shopId) {
      await store.dispatch("shopify/fetchShopifyShops");
    }

    systemMessageRemoteId.value = await ShopifyProductSyncService.fetchShopSystemMessageRemoteId({
      shopId: props.id,
      shopifyShopId: shop.value.shopifyShopId
    });

    if (!systemMessageRemoteId.value) {
      throw new Error("Could not resolve systemMessageRemoteId");
    }

    historyRuns.value = [];
    pageIndex.value = 0;
    reversePageIndex.value = -1;
    backendHistoryCount.value = 0;
    hasMoreBackendHistory.value = true;
    historyPageMode.value = "unknown";
    await fetchHistoryPage();
  } catch (error: any) {
    logger.error(error);
    showToast(translate("Failed to load product sync history"));
    historyRuns.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function fetchHistoryPage() {
  const systemMessages: any[] = [];

  while (systemMessages.length < PAGE_SIZE && hasMoreBackendHistory.value) {
    const response = await fetchNextSystemMessagesResponse();
    const page = getSystemMessagesPage(response);

    systemMessages.push(...page
      .filter((msg: any) => msg.isOutgoing === 'Y')
      .filter(matchesCreatedDateFilters));

    if (!hasDateFilters.value) break;
  }

  const nextRuns = systemMessages.map(getInitialHistoryRun);
  historyRuns.value = historyRuns.value.concat(nextRuns);
  await loadRunDetails(nextRuns, systemMessages);
}

async function fetchNextSystemMessagesResponse() {
  if (historyPageMode.value === "reverse") return fetchReverseSystemMessagesResponse();

  const response = await fetchSystemMessagesResponse(pageIndex.value);
  const page = getSystemMessagesPage(response);
  backendHistoryCount.value = getSystemMessagesCount(response, page);

  if (historyPageMode.value === "unknown") {
    historyPageMode.value = shouldReadPagesBackwards(page, backendHistoryCount.value) ? "reverse" : "forward";
    if (historyPageMode.value === "reverse") {
      reversePageIndex.value = Math.max(Math.ceil(backendHistoryCount.value / PAGE_SIZE) - 1, 0);
      return fetchReverseSystemMessagesResponse();
    }
  }

  pageIndex.value += 1;
  hasMoreBackendHistory.value = page.length > 0 && (pageIndex.value * PAGE_SIZE) < backendHistoryCount.value;

  return {
    ...response,
    systemMessages: sortSystemMessagesNewestFirst(page)
  };
}

async function fetchReverseSystemMessagesResponse() {
  const response = await fetchSystemMessagesResponse(reversePageIndex.value);
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
    isOutgoing: 'Y',
    orderBy: '-initDate'
  };

  if (filters.statusId) params.statusId = filters.statusId;

  return params;
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
    objectCount: 0,
    mdmImportId: '',
    mdmStatus: "pending",
    mdmStatusLabel: translate("Pending"),
    mdmStatusColor: "medium",
    totalRecordCount: 0,
    failedRecordCount: 0,
    loading: true
  };
}

async function loadRunDetails(runs: ShopifyProductSyncHistoryRun[], systemMessages: any[]) {
  const chunkSize = 3;
  const currentMessages = [...systemMessages];

  for (let i = 0; i < runs.length; i += chunkSize) {
    const chunk = runs.slice(i, i + chunkSize);

    await Promise.all(chunk.map(async (run) => {
      const msg = currentMessages.find((message: any) => message.systemMessageId === run.id);
      try {
        const syncRun = await fetchSyncRun(run.id, msg);

        if (syncRun) updateHistoryRun(run.id, {
          systemMessageStatus: syncRun.systemMessage.statusLabel,
          systemMessageStatusColor: syncRun.systemMessage.statusColor,
          bulkOperationId: syncRun.bulkOperation?.id || '',
          bulkOperationStatus: syncRun.bulkOperation?.status || '',
          bulkOperationStatusLabel: syncRun.bulkOperation?.statusLabel || translate("Pending"),
          bulkOperationStatusColor: syncRun.bulkOperation?.statusColor || "medium",
          objectCount: syncRun.bulkOperation?.objectCount || 0,
          mdmImportId: syncRun.mdmLog?.id || '',
          mdmStatus: syncRun.mdmLog?.statusId || '',
          mdmStatusLabel: syncRun.mdmLog?.statusLabel || translate("Pending"),
          mdmStatusColor: syncRun.mdmLog?.statusColor || "medium",
          totalRecordCount: syncRun.mdmLog?.totalRecordCount || 0,
          failedRecordCount: syncRun.mdmLog?.failedRecordCount || 0,
          loading: false
        });
      } catch (runError) {
        logger.error(`Failed to fetch sync run details for message ${run.id}`, runError);
        updateHistoryRun(run.id, { loading: false });
      }
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
  try {
    await fetchHistoryPage();
  } catch (error: any) {
    logger.error(error);
    showToast(translate("Failed to load product sync history"));
  } finally {
    isLoadingMore.value = false;
    await completeInfiniteScroll(event);
  }
}

async function completeInfiniteScroll(event: CustomEvent) {
  const target = event.target as any;
  await target.complete();
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
