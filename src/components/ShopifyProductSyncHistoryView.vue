<template>
  <ion-list>
    <ion-list-header>
      <ion-label>{{ translate("A list of previous product sync runs") }}</ion-label>
    </ion-list-header>

    <ion-accordion-group>
      <ion-accordion v-for="run in runs" :key="run.id" :value="run.id">
        <div class="list-item" slot="header">
          <ion-item lines="none">
            <ion-icon slot="start" :icon="getRunIcon(run)" :color="getRunIconColor(run)" />
            <ion-label>
              {{ run.id }}
              <p>{{ translate("Created") }}: {{ run.createdTime ? formatTime(run.createdTime) : translate("Unavailable") }}</p>
              <p>{{ translate("System message status") }}: {{ run.systemMessageStatus }}</p>
            </ion-label>
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
          <ion-item v-if="isProducedSystemMessage(run)">
            <ion-label>
              {{ translate("Send job") }}
              <p>{{ getSendJobStatusLabel() }}</p>
              <p>{{ getLastSendJobRunLabel() }}</p>
              <p v-if="getLastSendJobRunMessage()">{{ getLastSendJobRunMessage() }}</p>
            </ion-label>
            <ion-chip slot="end" outline :color="getLastSendJobRunStatusColor()">
              <ion-label>{{ getLastSendJobRunStatus() }}</ion-label>
              <ion-icon :icon="getStatusIcon(getLastSendJobRunStatus())" />
            </ion-chip>
          </ion-item>
          <ion-item v-if="isProducedSystemMessage(run) && getLastSendJobRunMessage()">
            <ion-label>
              {{ translate("Poll job") }}
              <p>{{ getPollJobStatusLabel() }}</p>
              <p>{{ getLastPollJobRunLabel() }}</p>
              <p v-if="getLastPollJobRunMessage()">{{ getLastPollJobRunMessage() }}</p>
            </ion-label>
            <ion-chip slot="end" outline :color="getLastPollJobRunStatusColor()">
              <ion-label>{{ getLastPollJobRunStatus() }}</ion-label>
              <ion-icon :icon="getStatusIcon(getLastPollJobRunStatus())" />
            </ion-chip>
          </ion-item>
          <ion-item v-if="isProducedSystemMessage(run)">
            <ion-label>
              {{ translate("Waiting to be sent") }}
              <p>{{ translate("Produced messages wait for the send job to post them to Shopify. The Shopify bulk operation ID appears after Shopify accepts the request.") }}</p>
            </ion-label>
          </ion-item>
          <div class="shopify-bulk-operation list-item">
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
            <div></div>
          </div>
          <div class="hotwax-bulk-import list-item">
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
  </ion-list>

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
        <ion-buttons slot="start">
          <ion-button @click="closeQueryModal" :aria-label="translate('Close')">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
        <ion-title>{{ translate("Requested query") }}</ion-title>
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
  IonListHeader,
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
  cloudDoneOutline,
  closeOutline,
  codeSlashOutline,
  documentTextOutline,
  helpCircleOutline,
  sendOutline,
  serverOutline,
  syncCircleOutline
} from "ionicons/icons";
import { DateTime } from "luxon";

const props = defineProps<{
  runs: any[]
  sendJobDetails?: any
  sendJobRecentRuns?: any[]
  pollJobDetails?: any
  pollJobRecentRuns?: any[]
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
  const normalizedStatus = normalizeStatus(status);
  if (["completed", "finished", "success", "dml-success", "dmlsuccess"].includes(normalizedStatus)) return checkmarkCircleOutline;
  if (["completed-with-errors", "error", "failed", "cancelled", "canceled", "dml-error", "dmlerror"].includes(normalizedStatus)) return alertCircleOutline;
  if (["running", "sent", "pending"].includes(normalizedStatus)) return syncCircleOutline;
  return helpCircleOutline;
}

function getRunIcon(run: any) {
  if (hasRunError(run)) return alertCircleOutline;
  if (isCompleteStatus(run?.mdmStatus)) return serverOutline;
  if (isCompleteStatus(run?.bulkOperationStatus)) return cloudDoneOutline;

  const systemMessageStatus = normalizeStatus(run?.systemMessageStatus);
  if (["confirmed", "system-msg-confirmed"].includes(systemMessageStatus)) return checkmarkCircleOutline;
  if (["sent", "system-msg-sent"].includes(systemMessageStatus)) return sendOutline;
  if (["produced", "created", "system-msg-produced"].includes(systemMessageStatus)) return documentTextOutline;

  return helpCircleOutline;
}

function getRunIconColor(run: any) {
  if (hasRunError(run)) return "danger";
  if (isCompleteStatus(run?.mdmStatus)) return "success";
  if (isCompleteStatus(run?.bulkOperationStatus)) return "success";

  const systemMessageStatus = normalizeStatus(run?.systemMessageStatus);
  if (["confirmed", "system-msg-confirmed"].includes(systemMessageStatus)) return "success";
  if (["sent", "system-msg-sent"].includes(systemMessageStatus)) return "primary";
  if (["produced", "created", "system-msg-produced"].includes(systemMessageStatus)) return "medium";

  return "medium";
}

function isProducedSystemMessage(run: any) {
  return ["produced", "system-msg-produced", "smsgproduced"].includes(normalizeStatus(run?.systemMessageStatus));
}

function getSendJobStatusLabel() {
  if (!props.sendJobDetails?.jobName) return translate("Send job details unavailable");
  if (isJobPaused(props.sendJobDetails)) return translate("Paused");
  return translate("Active");
}

function getPollJobStatusLabel() {
  if (!props.pollJobDetails?.jobName) return translate("Poll job details unavailable");
  if (isJobPaused(props.pollJobDetails)) return translate("Paused");
  return translate("Active");
}

function getLastSendJobRun() {
  return getLastJobRun(props.sendJobRecentRuns);
}

function getLastPollJobRun() {
  return getLastJobRun(props.pollJobRecentRuns);
}

function getLastJobRun(runs?: any[]) {
  return runs?.[0] || {};
}

function getLastSendJobRunLabel() {
  const run = getLastSendJobRun();
  const startedAt = getJobRunStartedAt(run);
  if (!startedAt) return translate("No recent runs");
  return `${translate("Last run")}: ${formatTime(startedAt)}`;
}

function getLastSendJobRunStatus() {
  const run = getLastSendJobRun();
  if (!Object.keys(run || {}).length) return translate("Unknown");
  if (run.hasError === "Y") return translate("Failed");
  if (getJobRunCompletedAt(run)) return translate("Success");
  if (getJobRunStartedAt(run)) return translate("Running");
  return translate("Terminated");
}

function getLastSendJobRunStatusColor() {
  const run = getLastSendJobRun();
  if (!Object.keys(run || {}).length) return "medium";
  if (run.hasError === "Y") return "danger";
  if (getJobRunCompletedAt(run)) return "success";
  if (getJobRunStartedAt(run)) return "primary";
  return "warning";
}

function getLastSendJobRunMessage() {
  const run = getLastSendJobRun();
  return run.messages || run.message || run.errorMessage || run.reason || run.errors || "";
}

function getLastPollJobRunLabel() {
  const run = getLastPollJobRun();
  const startedAt = getJobRunStartedAt(run);
  if (!startedAt) return translate("No recent runs");
  return `${translate("Last run")}: ${formatTime(startedAt)}`;
}

function getLastPollJobRunStatus() {
  return getJobRunStatus(getLastPollJobRun());
}

function getLastPollJobRunStatusColor() {
  return getJobRunStatusColor(getLastPollJobRun());
}

function getLastPollJobRunMessage() {
  const run = getLastPollJobRun();
  return run.messages || run.message || run.errorMessage || run.reason || run.errors || "";
}

function getJobRunStatus(run: any) {
  if (!Object.keys(run || {}).length) return translate("Unknown");
  if (run.hasError === "Y") return translate("Failed");
  if (getJobRunCompletedAt(run)) return translate("Success");
  if (getJobRunStartedAt(run)) return translate("Running");
  return translate("Terminated");
}

function getJobRunStatusColor(run: any) {
  if (!Object.keys(run || {}).length) return "medium";
  if (run.hasError === "Y") return "danger";
  if (getJobRunCompletedAt(run)) return "success";
  if (getJobRunStartedAt(run)) return "primary";
  return "warning";
}

function getJobRunStartedAt(run: any) {
  return run.startDate || run.startTime || run.createdDate || run.createdStamp || run.lastUpdatedStamp || "";
}

function getJobRunCompletedAt(run: any) {
  return run.endDate || run.endTime || run.finishDateTime || "";
}

function isJobPaused(job: any) {
  const status = String(job?.statusId || job?.status || "").toLowerCase();
  return job?.paused === "Y" || job?.paused === true || job?.isPaused === true || status === "paused";
}

function hasRunError(run: any) {
  if (!run) return false;
  if (Number(run.failedRecordCount) > 0) return true;
  return [
    run.systemMessageStatus,
    run.systemMessageStatusColor,
    run.bulkOperationStatus,
    run.bulkOperationStatusColor,
    run.mdmStatus,
    run.mdmStatusColor
  ].some((status) => {
    const normalizedStatus = normalizeStatus(status);
    return ["danger", "error", "failed", "cancelled", "canceled", "completed-with-errors", "dml-error", "dmlerror"].includes(normalizedStatus);
  });
}

function isCompleteStatus(status: string) {
  return ["completed", "finished", "success", "dml-success", "dmlsuccess"].includes(normalizeStatus(status));
}

function normalizeStatus(status: string) {
  return String(status || "").toLowerCase().replace(/_/g, "-");
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
