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
        :send-job-details="sendJobDetails"
        :send-job-recent-runs="sendJobRecentRuns"
        :poll-job-details="pollJobDetails"
        :poll-job-recent-runs="pollJobRecentRuns"
      />
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
  onIonViewWillEnter,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar
} from "@ionic/vue";
import { translate } from "@/i18n";
import { computed, defineProps, ref } from "vue";
import { useStore } from "vuex";
import logger from "@/logger";
import ShopifyProductSyncHistoryView from "@/components/ShopifyProductSyncHistoryView.vue";
import { ShopifyProductSyncService } from "@/services/ShopifyProductSyncService";
import { useSystemMessage } from "@/composables/useSystemMessage";
import { useShopifyProductSyncRun } from "@/composables/useShopifyProductSyncRun";
import useServiceJob from "@/composables/useServiceJob";
import { showToast } from "@/utils";

const props = defineProps(["id"]);
const store = useStore();
const { fetchSystemMessagesPage } = useSystemMessage();

const { fetchSyncRun } = useShopifyProductSyncRun();
const { fetchJobDetail, fetchJobRuns } = useServiceJob();
const BULK_OPERATION_SEND_JOB_NAME = "send_ProducedBulkOperationSystemMessage_ShopifyBulkQuery";
const BULK_OPERATION_POLL_JOB_NAME = "poll_ShopifyBulkOperationResult";

const isLoading = ref(true);
const sendJobDetails = ref<any>({});
const sendJobRecentRuns = ref<any[]>([]);
const pollJobDetails = ref<any>({});
const pollJobRecentRuns = ref<any[]>([]);
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

const shop = computed(() => store.getters["shopify/getShopById"](props.id) || {});

onIonViewWillEnter(async () => {
  await loadHistory();
});

async function loadHistory() {
  isLoading.value = true;
  try {
    if (!shop.value.shopId) {
      await store.dispatch("shopify/fetchShopifyShops");
    }

    const systemMessageRemoteId = await ShopifyProductSyncService.fetchShopSystemMessageRemoteId({
      shopId: props.id,
      shopifyShopId: shop.value.shopifyShopId
    });

    if (!systemMessageRemoteId) {
      throw new Error("Could not resolve systemMessageRemoteId");
    }

    await loadBulkOperationJobState();

    const systemMessageParams = {
      systemMessageTypeId: 'BulkQueryShopifyProductUpdates',
      systemMessageRemoteId,
      isOutgoing: 'Y', // Only fetch primary sync request messages
      orderByField: 'initDate DESC'
    };
    const systemMessages = await fetchAllSystemMessages(systemMessageParams);

    if (!systemMessages.length) {
      historyRuns.value = [];
      return;
    }

    // Step 1: Populate basic info immediately to make page interactable
    historyRuns.value = systemMessages
      .filter((msg: any) => msg.isOutgoing === 'Y')
      .map((msg: any) => ({
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
      }))
      .sort(sortRunsNewestFirst);

    // Hide global loader once we have the initial list
    isLoading.value = false;

    // Step 2: Load details in background (staggered)
    const chunkSize = 3;
    const currentMessages = [...systemMessages]; // Keep a local copy
    for (let i = 0; i < historyRuns.value.length; i += chunkSize) {
      const chunk = historyRuns.value.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (run) => {
        const msg = currentMessages.find((m: any) => m.systemMessageId === run.id);
        try {
          const syncRun = await fetchSyncRun(run.id, msg);
          
          if (syncRun) {
            const runIndex = historyRuns.value.findIndex(r => r.id === run.id);
            if (runIndex !== -1) {
              historyRuns.value[runIndex] = {
                ...historyRuns.value[runIndex],
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
              };
            }
          }
        } catch (runError) {
          logger.error(`Failed to fetch sync run details for message ${run.id}`, runError);
          const runIndex = historyRuns.value.findIndex(r => r.id === run.id);
          if (runIndex !== -1) historyRuns.value[runIndex].loading = false;
        }
      }));
    }
  } catch (error: any) {
    logger.error(error);
    showToast(translate("Failed to load product sync history"));
    historyRuns.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function loadBulkOperationJobState() {
  const [sendJob, sendRuns, pollJob, pollRuns] = await Promise.all([
    fetchJobDetail(BULK_OPERATION_SEND_JOB_NAME),
    fetchAllJobRuns(BULK_OPERATION_SEND_JOB_NAME),
    fetchJobDetail(BULK_OPERATION_POLL_JOB_NAME),
    fetchAllJobRuns(BULK_OPERATION_POLL_JOB_NAME)
  ]);

  sendJobDetails.value = sendJob || {};
  sendJobRecentRuns.value = Array.isArray(sendRuns) ? sendRuns : [];
  pollJobDetails.value = pollJob || {};
  pollJobRecentRuns.value = Array.isArray(pollRuns) ? pollRuns : [];
}

async function fetchAllJobRuns(jobName: string) {
  const pageSize = 250;
  let pageIndex = 0;
  let jobRuns: any[] = [];

  while (pageIndex < 20) {
    const page = await fetchJobRuns(jobName, {
      pageSize,
      pageIndex,
      orderByField: "startDate DESC"
    });
    jobRuns = jobRuns.concat(page);
    if (!page.length || page.length < pageSize) break;
    pageIndex += 1;
  }

  return jobRuns.sort((firstRun: any, secondRun: any) => {
    return getCreatedTimeMs(getJobRunStartedAt(secondRun)) - getCreatedTimeMs(getJobRunStartedAt(firstRun));
  }).slice(0, 5);
}

function getJobRunStartedAt(run: any) {
  return run.startDate || run.startTime || run.createdDate || run.createdStamp || run.lastUpdatedStamp || "";
}

function sortRunsNewestFirst(firstRun: ShopifyProductSyncHistoryRun, secondRun: ShopifyProductSyncHistoryRun) {
  return getCreatedTimeMs(secondRun.createdTime) - getCreatedTimeMs(firstRun.createdTime);
}

function getCreatedTimeMs(createdTime: any) {
  if (!createdTime) return 0;
  if (typeof createdTime === "number") return createdTime;

  const parsedTime = new Date(createdTime).getTime();
  return Number.isNaN(parsedTime) ? 0 : parsedTime;
}

async function fetchAllSystemMessages(params: any) {
  const pageSize = 1000;
  let pageIndex = 0;
  let totalCount = pageSize;
  let systemMessages: any[] = [];

  while (systemMessages.length < totalCount) {
    const response = await fetchSystemMessagesPage({
      ...params,
      pageSize,
      pageIndex
    });
    const page = response?.systemMessages || [];
    systemMessages = systemMessages.concat(page);
    totalCount = Number(response?.systemMessagesCount || systemMessages.length);
    if (!page.length) break;
    pageIndex += 1;
  }

  return systemMessages.sort((firstMessage: any, secondMessage: any) => {
    return getCreatedTimeMs(secondMessage.initDate) - getCreatedTimeMs(firstMessage.initDate);
  });
}
</script>
