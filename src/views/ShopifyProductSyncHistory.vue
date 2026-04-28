<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="'/shopify-connection-details/' + id + '/product-sync'" />
        </ion-buttons>
        <ion-title>{{ translate("Product sync") }}</ion-title>
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

      <shopify-product-sync-history-view v-else :runs="historyRuns" />
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
import { showToast } from "@/utils";

const props = defineProps(["id"]);
const store = useStore();
const { fetchSystemMessages } = useSystemMessage();

const { fetchSyncRun } = useShopifyProductSyncRun();

const isLoading = ref(true);
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
  loading?: boolean;
}

const historyRuns = ref<ShopifyProductSyncHistoryRun[]>([]);

const shop = computed(() => store.getters["shopify/getShopById"](props.id) || {});

function getSystemMessageBulkOperationId(systemMessage: any) {
  return systemMessage?.remoteId || systemMessage?.remoteMessageId || "";
}

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

    // Fetch system messages for Shopify product sync
    const systemMessages = (await fetchSystemMessages({
      systemMessageTypeId: 'BulkQueryShopifyProductUpdates',
      systemMessageRemoteId,
      isOutgoing: 'Y', // Only fetch primary sync request messages
      pageSize: 20,
      orderByField: '-initDate'
    })) || [];

    if (!systemMessages.length) {
      historyRuns.value = [];
      return;
    }

    // Step 1: Populate basic info immediately to make page interactable
    // Filter in-memory to ensure only primary sync requests are shown
    historyRuns.value = systemMessages
      .filter((msg: any) => msg.isOutgoing === 'Y' && getSystemMessageBulkOperationId(msg).startsWith('gid://shopify/BulkOperation/'))
      .map((msg: any) => ({
        id: msg.systemMessageId,
        createdTime: msg.initDate,
        systemMessageStatus: msg.statusId,
        systemMessageStatusColor: "primary",
        bulkOperationId: '',
        bulkOperationStatus: "pending",
        bulkOperationStatusLabel: translate("Pending"),
        bulkOperationStatusColor: "medium",
        queryContent: '',
        objectCount: 0,
        mdmImportId: '',
        mdmStatus: "pending",
        mdmStatusLabel: translate("Pending"),
        mdmStatusColor: "medium",
        totalRecordCount: 0,
        failedRecordCount: 0,
        loading: true
      }));

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
                queryContent: syncRun.bulkOperation?.query || '',
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
</script>
