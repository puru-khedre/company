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
import logger from "@/logger";
import ShopifyProductSyncHistoryView from "@/components/ShopifyProductSyncHistoryView.vue";
import { ShopifyProductSyncService } from "@/services/ShopifyProductSyncService";
import { showToast } from "@/utils";

const props = defineProps(["id"]);
const isLoading = ref(true);
const historyState = ref<any>({
  runs: []
});

const historyRuns = computed(() => {
  return historyState.value.runs || [];
});

onIonViewWillEnter(async () => {
  await loadHistory();
});

async function loadHistory() {
  isLoading.value = true;
  try {
    historyState.value = await ShopifyProductSyncService.fetchHistory({
      shopId: props.id
    });
  } catch (error: any) {
    logger.error(error);
    showToast(translate("Failed to load product sync"));
    historyState.value = { runs: [] };
  } finally {
    isLoading.value = false;
  }
}
</script>
