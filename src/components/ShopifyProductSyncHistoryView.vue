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
      <div class="list-item" slot="header">
        <ion-item lines="none">
          <ion-icon slot="start" :icon="sendOutline" />
          <ion-label>
            {{ run.id }}
            <p>{{ run.createdTime ? formatTime(run.createdTime) : '' }}</p>
          </ion-label>
          <ion-badge slot="end" :color="run.systemMessageStatusColor">{{ run.systemMessageStatus }}</ion-badge>
        </ion-item>

        <ion-label class="stat">
          <ion-chip outline :color="run.bulkOperationStatusColor">
            <ion-label>{{ run.bulkOperationStatusLabel }}</ion-label>
            <ion-icon :icon="getStatusIcon(run.bulkOperationStatus)" />
          </ion-chip>
          <p>{{ translate("Shopify bulk operation") }}</p>
        </ion-label>
        <ion-label class="stat">
          <ion-chip outline :color="run.mdmStatusColor">
            <ion-label>{{ run.mdmStatusLabel }}</ion-label>
            <ion-icon :icon="getStatusIcon(run.mdmStatus)" />
          </ion-chip>
          <p>{{ translate("HotWax bulk import") }}</p>
        </ion-label>
        <div>
          <ion-spinner v-if="run.loading" name="crescent" size="small" />
        </div>
      </div>

      <ion-list slot="content" lines="full">
        <div class="list-item">
          <ion-item lines="none">
            <ion-label>
              {{ translate("Shopify bulk operation Id") }}
              <p>{{ run.bulkOperationId || "N/A" }}</p>
            </ion-label>
          </ion-item>
          <ion-label class="stat">
            {{ run.objectCount }}
            <p>{{ translate("object count") }}</p>
          </ion-label>
          <div>
            <ion-chip v-if="run.bulkOperationId" outline :color="getQueryChipColor(run)" :disabled="!run.queryContent" @click.stop="openQueryModal(run)">
              <ion-icon :icon="codeSlashOutline" />
              <ion-label>{{ getQueryChipLabel(run) }}</ion-label>
            </ion-chip>
          </div>
        </div>
        <div class="list-item">
          <ion-item lines="none">
            <ion-label>
              {{ translate("HotWax bulk import id") }}
              <p>{{ run.mdmImportId || "N/A" }}</p>
            </ion-label>
          </ion-item>
          <ion-label class="stat">
            {{ run.totalRecordCount }}
            <p>{{ translate("total record count") }}</p>
          </ion-label>
          <ion-label class="stat">
            {{ run.failedRecordCount }}
            <p>{{ translate("failed record count") }}</p>
          </ion-label>
          <div></div>
        </div>
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

  <ion-modal :is-open="isQueryModalOpen" @didDismiss="closeQueryModal">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Requested query") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="closeQueryModal">{{ translate("Close") }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list lines="full">
        <ion-item>
          <ion-label>
            {{ translate("System message id") }}
            <p>{{ selectedQueryRun?.id }}</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-label>
            {{ translate("Shopify bulk operation Id") }}
            <p>{{ selectedQueryRun?.bulkOperationId || "N/A" }}</p>
          </ion-label>
        </ion-item>
        <ion-item>
          <ion-label>{{ translate("Requested query") }}</ion-label>
        </ion-item>
        <ion-item>
          <ion-textarea :value="selectedQueryContent" readonly auto-grow />
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import {
  IonAccordion,
  IonAccordionGroup,
  IonBadge,
  IonButtons,
  IonButton,
  IonCard,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar
} from "@ionic/vue";
import { translate } from "@/i18n";
import { computed, defineProps, ref } from "vue";
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  codeSlashOutline,
  helpCircleOutline,
  sendOutline,
  shieldCheckmarkOutline,
  syncCircleOutline
} from "ionicons/icons";
import { DateTime } from "luxon";

defineProps<{
  runs: any[]
}>();

const isQueryModalOpen = ref(false);
const selectedQueryRun = ref<any>(null);

const selectedQueryContent = computed(() => {
  return formatQueryContent(selectedQueryRun.value);
});

function formatTime(time: any) {
  if (!time) return "";
  return DateTime.fromMillis(time).toFormat("LLL d, yyyy HH:mm");
}

function openQueryModal(run: any) {
  if (!run?.queryContent) return;
  selectedQueryRun.value = run;
  isQueryModalOpen.value = true;
}

function closeQueryModal() {
  isQueryModalOpen.value = false;
  selectedQueryRun.value = null;
}

function formatQueryContent(run: any) {
  const content = run?.queryContent || "";

  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function getQueryChipColor(run: any) {
  return run?.queryContent ? "primary" : "medium";
}

function getQueryChipLabel(run: any) {
  return run?.queryContent ? translate("View query") : translate("No query found");
}

function getStatusIcon(status: string) {
  const normalizedStatus = status?.toLowerCase();
  if (["completed", "finished", "dmlsuccess"].includes(normalizedStatus)) return checkmarkCircleOutline;
  if (["completed-with-errors", "error", "cancelled", "canceled", "dmlerror"].includes(normalizedStatus)) return alertCircleOutline;
  if (["running", "sent", "pending"].includes(normalizedStatus)) return syncCircleOutline;
  return helpCircleOutline;
}
</script>

<style scoped>
.list-item {
  --columns-desktop: 4;
  border-top: 1px solid var(--ion-color-medium);
}

.list-item .item-key {
  padding-inline-start: var(--spacer-sm);
}

@media (min-width: 991px) {
  .list-item {
    padding-block: var(--spacer-sm);
    padding-inline-end: var(--spacer-sm);
  }
}
</style>
