<template>
  <ion-item lines="none">
    <ion-icon slot="start" :icon="shieldCheckmarkOutline" />
    <ion-label>
      <h2>{{ translate("Product sync history") }}</h2>
      <p>{{ translate("A list of previous product sync runs") }}</p>
    </ion-label>
  </ion-item>

  <ion-accordion-group>
    <ion-accordion v-for="run in runs" :key="run.id" :value="run.id">
      <ion-item slot="header">
        <ion-label>
          {{ run.systemMessageId }}
          <p>{{ run.createdTime }}</p>
        </ion-label>
        <ion-badge slot="end" :color="getStatusColor(run.bulkOperationStatus)">{{ run.bulkOperationStatusLabel }}</ion-badge>
        <ion-badge slot="end" :color="getStatusColor(run.mdmStatus)">{{ run.mdmStatusLabel }}</ion-badge>
      </ion-item>

      <ion-list slot="content" lines="full">
        <ion-item>
          <ion-label>
            {{ translate("Shopify bulk operation Id") }}
            <p>{{ run.createdTime }}</p>
          </ion-label>
          <ion-note slot="end">
            {{ run.objectCount }}
            <p>{{ translate("object count") }}</p>
          </ion-note>
          <ion-button slot="end" fill="outline" size="small">
            {{ translate("view query") }}
          </ion-button>
          <ion-badge slot="end" :color="getStatusColor(run.bulkOperationStatus)">{{ run.bulkOperationStatusLabel }}</ion-badge>
        </ion-item>
        <ion-item>
          <ion-label>
            {{ translate("HotWax bulk import id") }}
            <p>{{ run.createdTime }}</p>
          </ion-label>
          <ion-note slot="end">
            {{ run.totalRecordCount }}
            <p>{{ translate("total record count") }}</p>
          </ion-note>
          <ion-note slot="end">
            {{ run.failedRecordCount }}
            <p>{{ translate("failed record count") }}</p>
          </ion-note>
          <ion-badge slot="end" :color="getStatusColor(run.mdmStatus)">{{ run.mdmStatusLabel }}</ion-badge>
        </ion-item>
      </ion-list>
    </ion-accordion>
  </ion-accordion-group>

  <ion-card v-if="!runs.length">
    <ion-list lines="full">
      <ion-item>
        <ion-label>{{ translate("No product sync history found") }}</ion-label>
      </ion-item>
    </ion-list>
  </ion-card>
</template>

<script setup lang="ts">
import {
  IonAccordion,
  IonAccordionGroup,
  IonBadge,
  IonButton,
  IonCard,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote
} from "@ionic/vue";
import { translate } from "@/i18n";
import { defineProps } from "vue";
import { shieldCheckmarkOutline } from "ionicons/icons";
import type { ShopifyProductSyncHistoryRun } from "@/services/ShopifyProductSyncService";

defineProps<{
  runs: ShopifyProductSyncHistoryRun[]
}>();

function getStatusColor(status: string) {
  if (status === "completed") return "success";
  if (status === "completed-with-errors" || status === "error" || status === "cancelled") return "danger";
  if (status === "running" || status === "sent") return "primary";
  return "medium";
}
</script>
