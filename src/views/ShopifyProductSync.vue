<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="'/shopify-connection-details/' + id" />
        </ion-buttons>
        <ion-title>{{ translate("Product sync") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="showModeModal = true" data-testid="product-sync-mode-button">{{ translate("Mode") }}</ion-button>
        </ion-buttons>
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

      <template v-else>
        <shopify-product-sync-returning-view
          v-if="activeExperienceMode === 'returning'"
          :is-sync-scheduled="isSyncScheduled"
          :is-sync-paused="isSyncJobPaused"
          :last-sync-label="lastSyncLabel"
          :next-sync-label="nextSyncLabel"
          :next-sync-relative-label="nextSyncRelativeLabel"
          :progress-steps="returningProgressSteps"
          :recent-sync-errors="recentSyncErrors"
          :recent-sync-updates="recentSyncUpdates"
          :selected-product-store-name="selectedProductStoreName"
          :summary-subtitle="syncSummarySubtitle"
          :unsynced-updates-count="unsyncedUpdatesCountLabel"
          :sync-job-obj="syncJobObj"
          @open-history="openHistory"
          @open-sync-job-details="openSyncJobDetailsModal"
          @schedule-sync="scheduleSyncJob"
          @toggle-pause-sync-job="togglePauseSyncJob"
          @open-unsynced-updates="openUnsyncedUpdatesModal"
          @open-step-details="openStepDetails"
          @run-job="runSyncJob"
        />

        <shopify-product-sync-wizard-view
          v-else
          :current-step="currentStep"
          :draft="draft"
          :get-connected-shop-label="getConnectedShopLabel"
          :get-product-store-name="getProductStoreName"
          :has-related-shops="hasRelatedShops"
          :identifier-locked="identifierLocked"
          :identifier-options="identifierOptions"
          :import-status-badge-color="importStatusBadgeColor"
          :import-status-label="importStatusLabel"
          :is-review-loading="isReviewLoading"
          :is-saving="isSaving"
          :next-disabled="nextDisabled"
          :preflight-requires-confirmation="preflightRequiresConfirmation"
          :preflight-result="preflightResult"
          :preflight-subtitle="preflightSubtitle"
          :preflight-title="preflightTitle"
          :preflight-warning-confirmed="preflightWarningConfirmed"
          :product-store-locked="productStoreLocked"
          :product-stores="productStores"
          :product-type-mappings="productTypeMappings"
          :product-type-mappings-label="productTypeMappingsLabel"
          :progress-badge-color="progressBadgeColor"
          :progress-state="progressState"
          :progress-status="progressStatus"
          :progress-steps="progressSteps"
          :reconcile-available="reconcileAvailable"
          :recommended-identifier-enum-id="recommendedIdentifierEnumId"
          :related-shops="relatedShops"
          :review-ready="reviewReady"
          :review-stats="reviewStats"
          :selected-identifier-label="selectedIdentifierLabel"
          :selected-product-store-name="selectedProductStoreName"
          :shop-id="id"
          :show-mistake-modal="showMistakeModal"
          :show-start-sync-modal="showStartSyncModal"
          :start-sync-disabled="startSyncDisabled"
          @accept-preflight-and-open-start-sync="acceptPreflightAndOpenStartSync"
          @close-mistake-modal="showMistakeModal = false"
          @close-start-sync-modal="showStartSyncModal = false"
          @go-back="goBack"
          @go-next="goNext"
          @identifier-change="handleIdentifierChange"
          @load-progress="loadProgress"
          @open-mistake-modal="openMistakeModal"
          @open-start-sync-modal="openStartSyncModal"
          @product-store-change="handleProductStoreChange"
          @start-product-sync="startProductSync"
          @toggle-preflight-warning-confirmation="togglePreflightWarningConfirmation"
          @toggle-product-store-verification="toggleProductStoreVerification"
          @toggle-start-confirmation="toggleStartConfirmation"
          @open-step-details="openStepDetails"
        />

        <ion-modal :is-open="showModeModal" @didDismiss="showModeModal = false">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ translate("Product sync mode") }}</ion-title>
              <ion-buttons slot="end">
                <ion-button @click="showModeModal = false">{{ translate("Close") }}</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-card>
              <ion-card-header>
                <ion-card-title>{{ translate("Product sync mode") }}</ion-card-title>
              </ion-card-header>
              <ion-list lines="full">
                <ion-item>
                  <ion-segment :value="experienceMode" @ionChange="handleExperienceModeChange($event.detail.value)" data-testid="product-sync-mode">
                    <ion-segment-button value="first-time">
                      <ion-label>{{ translate("First-time setup") }}</ion-label>
                    </ion-segment-button>
                    <ion-segment-button value="returning">
                      <ion-label>{{ translate("Returning user") }}</ion-label>
                    </ion-segment-button>
                    <ion-segment-button value="auto">
                      <ion-label>{{ translate("Auto") }}</ion-label>
                    </ion-segment-button>
                  </ion-segment>
                </ion-item>
                <ion-item>
                  <ion-label>{{ translate("Shopify shop products") }}</ion-label>
                  <ion-note slot="end">{{ shopifyShopProductCount }}</ion-note>
                </ion-item>
                <ion-item>
                  <ion-label>{{ translate("Active view") }}</ion-label>
                  <ion-badge slot="end" :color="activeExperienceMode === 'returning' ? 'primary' : 'medium'">{{ activeExperienceModeLabel }}</ion-badge>
                </ion-item>
              </ion-list>
            </ion-card>
          </ion-content>
        </ion-modal>

        <ion-modal :is-open="showUnsyncedUpdatesModal" @didDismiss="showUnsyncedUpdatesModal = false">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ translate("Un-synced Shopify updates") }}</ion-title>
              <ion-buttons slot="end">
                <ion-button @click="loadUnsyncedProductUpdates" :disabled="isUnsyncedUpdatesLoading">{{ translate("Refresh") }}</ion-button>
                <ion-button @click="showUnsyncedUpdatesModal = false">{{ translate("Close") }}</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-card v-if="isUnsyncedUpdatesLoading">
              <ion-card-content>
                <ion-spinner name="crescent" />
              </ion-card-content>
            </ion-card>
              <ion-list v-else lines="full">
              <ion-item v-if="shopifyShopProductCount > 100">
                <ion-label>{{ translate("Showing the first 100 updated products.") }}</ion-label>
                <ion-note slot="end">{{ translate("100+") }}</ion-note>
              </ion-item>
              <ion-item v-for="product in unsyncedProductUpdates" :key="product.id">
                <ion-thumbnail v-if="product.imageUrl" slot="start">
                  <ion-img :src="product.imageUrl" :alt="product.imageAltText || product.title" />
                </ion-thumbnail>
                <ion-label>
                  {{ product.title }}
                  <p>{{ product.handle }}</p>
                  <p>{{ product.vendor || translate("No vendor") }} · {{ product.productType || translate("No type") }}</p>
                  <p>{{ translate("Updated") }} {{ formatShopifyDate(product.updatedAt) }}</p>
                </ion-label>
                <ion-note slot="end">
                  {{ product.variantsCount }} {{ translate("variants") }}
                  <p>{{ product.status }}</p>
                  <p>{{ translate("Inventory") }} {{ product.totalInventory ?? 0 }}</p>
                </ion-note>
              </ion-item>
              <ion-item v-if="!unsyncedProductUpdates.length">
                <ion-label>{{ translate("No un-synced product updates") }}</ion-label>
              </ion-item>
            </ion-list>
          </ion-content>
        </ion-modal>

        <ion-modal :is-open="showSyncJobDetailsModal" @didDismiss="closeSyncJobDetailsModal">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ translate("Sync job details") }}</ion-title>
              <ion-buttons slot="end">
                <ion-button @click="refreshSyncJobDetails" :disabled="isSyncJobDetailsLoading || !syncJobObj">{{ translate("Refresh") }}</ion-button>
                <ion-button @click="closeSyncJobDetailsModal">{{ translate("Close") }}</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-card v-if="isSyncJobDetailsLoading">
              <ion-card-content>
                <ion-spinner name="crescent" />
              </ion-card-content>
            </ion-card>

            <template v-else>
              <ion-card v-if="syncJobDetails.jobName">
                <ion-list lines="full">
                  <ion-item>
                    <ion-label>{{ translate("Name") }}</ion-label>
                    <ion-note slot="end">{{ syncJobDetails.jobName }}</ion-note>
                  </ion-item>
                  <ion-item>
                    <ion-label>{{ translate("Service") }}</ion-label>
                    <ion-note slot="end">{{ syncJobDetails.serviceName || translate("Unavailable") }}</ion-note>
                  </ion-item>
                  <ion-item>
                    <ion-label>{{ translate("Instance of product") }}</ion-label>
                    <ion-note slot="end">{{ syncJobProductLabel }}</ion-note>
                  </ion-item>
                  <ion-item>
                    <ion-label>{{ translate("Status") }}</ion-label>
                    <ion-note slot="end">{{ getSyncJobStatusLabel(syncJobDetails) }}</ion-note>
                  </ion-item>
                  <ion-item>
                    <ion-label>{{ translate("Schedule") }}</ion-label>
                    <ion-note slot="end">{{ syncJobDetails.cronString || syncJobDetails.cronExpression || translate("Not scheduled") }}</ion-note>
                  </ion-item>
                  <ion-item>
                    <ion-label>{{ translate("Last run") }}</ion-label>
                    <ion-note slot="end">{{ syncJobLastRunLabel }}</ion-note>
                  </ion-item>
                  <ion-item>
                    <ion-label>{{ translate("Created") }}</ion-label>
                    <ion-note slot="end">{{ formatDateTime(syncJobDetails.createdDate || syncJobDetails.createdStamp) }}</ion-note>
                  </ion-item>
                  <ion-item>
                    <ion-label>{{ translate("Updated") }}</ion-label>
                    <ion-note slot="end">{{ formatDateTime(syncJobDetails.lastUpdatedStamp || syncJobDetails.lastModifiedDate) }}</ion-note>
                  </ion-item>
                </ion-list>
              </ion-card>

              <ion-card v-if="syncJobParameters.length">
                <ion-list lines="full">
                  <ion-item>
                    <ion-label>
                      <h2>{{ translate("Parameters") }}</h2>
                      <p>{{ translate("Job and service parameters used for this Shopify product sync.") }}</p>
                    </ion-label>
                  </ion-item>
                  <ion-item v-for="parameter in syncJobParameters" :key="parameter.key">
                    <ion-label>
                      {{ parameter.label }}
                      <p>{{ parameter.source }}</p>
                    </ion-label>
                    <ion-note slot="end">{{ parameter.value }}</ion-note>
                  </ion-item>
                </ion-list>
              </ion-card>

              <ion-card>
                <ion-list lines="full">
                  <ion-item>
                    <ion-label>
                      <h2>{{ translate("Recent runs") }}</h2>
                      <p>{{ translate("Last 5 executions for this service job.") }}</p>
                    </ion-label>
                  </ion-item>
                  <ion-item v-for="run in syncJobRecentRuns" :key="getSyncJobRunKey(run)">
                    <ion-label>
                      {{ getSyncJobRunTitle(run) }}
                      <p>{{ formatDateTime(getSyncJobRunStartedAt(run)) }}</p>
                      <p v-if="getSyncJobRunCompletedAt(run)">{{ translate("Completed") }} {{ formatDateTime(getSyncJobRunCompletedAt(run)) }}</p>
                      <p v-if="getSyncJobRunDuration(run)">{{ translate("Duration") }} {{ getSyncJobRunDuration(run) }}</p>
                      <p v-if="getSyncJobRunUser(run)">{{ translate("User") }} {{ getSyncJobRunUser(run) }}</p>
                      <p v-if="getSyncJobRunCount(run)">{{ getSyncJobRunCount(run) }}</p>
                      <p v-if="getSyncJobRunMessage(run)">{{ getSyncJobRunMessage(run) }}</p>
                    </ion-label>
                    <ion-badge slot="end" :color="getSyncJobRunStatusColor(run)">{{ getSyncJobRunStatus(run) }}</ion-badge>
                  </ion-item>
                  <ion-item v-if="!syncJobRecentRuns.length">
                    <ion-label>{{ translate("No recent runs found") }}</ion-label>
                  </ion-item>
                </ion-list>
              </ion-card>
            </template>
          </ion-content>
        </ion-modal>
        <ion-modal :is-open="showStepDetailsModal" @didDismiss="showStepDetailsModal = false">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ translate("Step Details") }}</ion-title>
              <ion-buttons slot="end">
                <ion-button @click="showStepDetailsModal = false">{{ translate("Close") }}</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-card v-if="isStepDetailsLoading">
              <ion-card-content>
                <ion-spinner name="crescent" />
              </ion-card-content>
            </ion-card>
            
            <template v-else-if="currentStepDetail">
              <!-- System Message Details -->
              <ion-card v-if="currentStepDetail.type === 'systemMessage'">
                <ion-card-header>
                  <ion-card-title>{{ translate("System Message") }}</ion-card-title>
                </ion-card-header>
                <ion-list lines="full">
                  <ion-item>
                    <ion-label>{{ translate("Message ID") }}</ion-label>
                    <ion-note slot="end">{{ currentStepDetail.id }}</ion-note>
                  </ion-item>
                  <ion-item>
                    <ion-label>{{ translate("Status") }}</ion-label>
                    <ion-note slot="end">{{ getStatusDescription(latestSystemMessage?.statusId) }}</ion-note>
                  </ion-item>
                  <ion-item>
                    <ion-label>{{ translate("Remote ID") }}</ion-label>
                    <ion-note slot="end">{{ latestSystemMessage?.remoteId }}</ion-note>
                  </ion-item>
                  <ion-item v-if="latestSystemMessage?.messageText">
                    <ion-label>
                      {{ translate("Message Text") }}
                      <p>{{ latestSystemMessage.messageText }}</p>
                    </ion-label>
                  </ion-item>
                </ion-list>
              </ion-card>

              <!-- Bulk Operation Details -->
              <ion-card v-if="currentStepDetail.type === 'bulkOperation'">
                <ion-card-header>
                  <ion-card-title>{{ translate("Bulk Operation") }}</ion-card-title>
                </ion-card-header>
                <ion-list lines="full">
                  <ion-item>
                    <ion-label>{{ translate("Bulk Operation ID") }}</ion-label>
                    <ion-note slot="end">{{ currentStepDetail.id }}</ion-note>
                  </ion-item>
                  <ion-item>
                    <ion-label>{{ translate("Status") }}</ion-label>
                    <ion-note slot="end">{{ progressState.bulkOperationStatus || getStatusDescription(latestSystemMessage?.statusId) }}</ion-note>
                  </ion-item>
                </ion-list>
              </ion-card>

              <!-- MDM Log Details -->
              <ion-card v-if="currentStepDetail.type === 'mdmLog'">
                <ion-card-header>
                  <ion-card-title>{{ translate("Data Manager Log") }}</ion-card-title>
                </ion-card-header>
                <ion-list lines="full">
                  <ion-item>
                    <ion-label>{{ translate("Log ID") }}</ion-label>
                    <ion-note slot="end">{{ currentMdmLog?.logId }}</ion-note>
                  </ion-item>
                  <ion-item>
                    <ion-label>{{ translate("Status") }}</ion-label>
                    <ion-note slot="end">{{ getStatusDescription(currentMdmLog?.statusId) }}</ion-note>
                  </ion-item>
                  <ion-item v-if="currentMdmLog?.totalRecordCount !== undefined">
                    <ion-label>{{ translate("Total Records") }}</ion-label>
                    <ion-note slot="end">{{ currentMdmLog.totalRecordCount }}</ion-note>
                  </ion-item>
                  <ion-item v-if="currentMdmLog?.successRecordCount !== undefined">
                    <ion-label>{{ translate("Success Records") }}</ion-label>
                    <ion-note slot="end">{{ currentMdmLog.successRecordCount }}</ion-note>
                  </ion-item>
                  <ion-item v-if="currentMdmLog?.failedRecordCount !== undefined">
                    <ion-label>{{ translate("Failed Records") }}</ion-label>
                    <ion-note slot="end">{{ currentMdmLog.failedRecordCount }}</ion-note>
                  </ion-item>
                </ion-list>
              </ion-card>

              <!-- Summary / Complete -->
              <ion-card v-if="currentStepDetail.type === 'summary'">
                <ion-card-header>
                  <ion-card-title>{{ translate("Sync Complete") }}</ion-card-title>
                </ion-card-header>
                <ion-card-content>
                  <p>{{ translate("The Shopify product sync has completed for this run.") }}</p>
                </ion-card-content>
              </ion-card>
            </template>
          </ion-content>
        </ion-modal>

      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import cronParser from "cron-parser";
import { DateTime } from "luxon";
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonImg,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  onIonViewWillEnter,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonThumbnail,
  IonTitle,
  IonToolbar,
  alertController
} from "@ionic/vue";

import { translate } from "@/i18n";
import { computed, defineProps, onBeforeUnmount, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import ShopifyProductSyncReturningView from "@/components/ShopifyProductSyncReturningView.vue";
import ShopifyProductSyncWizardView from "@/components/ShopifyProductSyncWizardView.vue";
import { ProductStoreService } from "@/services/ProductStoreService";
import { ShopifyService } from "@/services/ShopifyService";
import { ShopifyProductSyncService } from "@/services/ShopifyProductSyncService";
import {
  canAdvanceProductSyncStep,
  canShowProductSyncReconcile,
  canStartProductSync,
  createProductSyncWizardDraft,
  getReviewImportAction,
  nextProductSyncStep,
  normalizeProductSyncStatus,
  previousProductSyncStep,
  ProductSyncExperienceMode,
  ProductSyncWizardStep,
  requiresPreflightConfirmation,
  resolveProductSyncExperienceMode,
  selectProductStore,
  shouldShowProductSyncProgress
} from "@/utils/shopifyProductSyncWizard";
import { hasError, showToast } from "@/utils";
import logger from "@/logger";
import useServiceJob from "@/composables/useServiceJob";
import { useDataManagerLog } from "@/composables/useDataManagerLog";
import { useProductUpdateHistory } from "@/composables/useProductUpdateHistory";

const props = defineProps(["id"]);
const store = useStore();
const router = useRouter();
const {
  jobs,
  products,
  fetchJobs,
  fetchJobDetail,
  fetchJobRuns,
  fetchProductDetail,
  updateJob,
  runNow
} = useServiceJob();
const { fetchMdmLogBySystemMessageId, fetchLogDetails, currentMdmLog, errorLogs } = useDataManagerLog();
const { productUpdateHistories, fetchProductUpdateHistory } = useProductUpdateHistory();
const PRODUCT_UPDATE_SYNC_JOB_PRODUCT_ID = "SYNC_SHPY_PRD_UPDS";

const latestSystemMessage = ref<any>(null);
const latestConfirmedSystemMessage = ref<any>(null);
const lastProductUpdateSyncedAt = ref("");
const currentTimeMs = ref(Date.now());
const isLoading = ref(true);
const isSaving = ref(false);
const isReviewLoading = ref(false);
const showModeModal = ref(false);
const showMistakeModal = ref(false);
const showStartSyncModal = ref(false);
const showUnsyncedUpdatesModal = ref(false);
const showSyncJobDetailsModal = ref(false);
const showStepDetailsModal = ref(false);
const isUnsyncedUpdatesLoading = ref(false);
const isSyncJobDetailsLoading = ref(false);
const isStepDetailsLoading = ref(false);
const currentStepDetail = ref<any>(null);
const preflightLoaded = ref(false);
const preflightAccepted = ref(false);
const preflightWarningConfirmed = ref(false);
const experienceMode = ref<ProductSyncExperienceMode>("auto");
const currentStep = ref<ProductSyncWizardStep>("home");
const draft = ref(createProductSyncWizardDraft());
const relatedShops = ref<any[]>([]);
const shopifyShopProductCount = ref(0);
const unsyncedProductUpdates = ref<any[]>([]);
const syncJobDetails = ref<any>({});
const syncJobRecentRuns = ref<any[]>([]);
const syncJobId = ref("");
const selectedShopSystemMessageRemoteId = ref("");
const setupState = ref<any>({
  hasLinkedOmsProducts: false,
  productStoreLocked: false,
  identifierLocked: false,
  backendAvailable: true
});
const reviewStats = ref<any>({
  shopifyProductCount: 0,
  shopifyVariantCount: 0,
  omsProductCount: 0,
  omsVariantCount: 0,
  linkedShopCount: 0,
  loaded: false
});
const preflightResult = ref<any>({
  matched: 0,
  sampled: 0,
  status: "matched",
  items: []
});
const progressState = ref<any>({
  syncJobId: "",
  status: "queued",
  systemMessageState: "SmsgProduced",
  completed: false,
  queuedJobsAhead: 0
});
const reconcileState = ref<any>({});
let progressPoll: number | undefined;
let nextSyncRefreshPoll: number | undefined;

const shop = computed(() => store.getters["shopify/getShopById"](props.id) || {});
const userProfile = computed(() => store.getters["user/getUserProfile"] || {});
const statusItems = computed(() => store.state.util.statusItems || {});

function getStatusDescription(statusId: string) {
  return statusItems.value[statusId]?.description || statusId;
}
const productStores = computed(() => store.getters["productStore/getProductStores"] || []);
const productTypeMappings = computed(() => store.getters["shopify/getShopifyTypeMappings"]("SHOPIFY_PRODUCT_TYPE"));
const productTypeMappingsLabel = computed(() => {
  return productTypeMappings.value.length ? `${productTypeMappings.value.length} ${translate("mappings")}` : translate("Setup");
});
const selectedProductStore = computed(() => {
  return productStores.value.find((productStore: any) => productStore.productStoreId === draft.value.selectedProductStoreId) || {};
});
const selectedProductStoreName = computed(() => {
  return getProductStoreName(selectedProductStore.value) || shop.value.productStoreId || translate("Not linked");
});
const unsyncedUpdatesCountLabel = computed(() => {
  return shopifyShopProductCount.value > 100 ? "100+" : shopifyShopProductCount.value;
});
const identifierOptions = ref([
  { enumId: "SHOPIFY_PRODUCT_SKU", description: "SKU" },
  { enumId: "SHOPIFY_PRODUCT_UPCA", description: "UPCA / Barcode" },
  { enumId: "SHOPIFY_PRODUCT_ID", description: "Shopify internal id" }
]);

const recommendedIdentifierEnumId = computed(() => {
  const skuIdentifier = identifierOptions.value.find((identifier: any) => {
    return identifier.enumId.includes("SKU") || (identifier.description || "").toLowerCase() === "sku";
  });
  return skuIdentifier?.enumId || identifierOptions.value[0]?.enumId || "";
});
const selectedIdentifierLabel = computed(() => {
  const identifier = identifierOptions.value.find((option: any) => option.enumId === draft.value.selectedIdentifierEnumId);
  return identifier?.description || identifier?.enumId || translate("Setup");
});
const productStoreLocked = computed(() => !!setupState.value.productStoreLocked || !!setupState.value.hasLinkedOmsProducts);
const identifierLocked = computed(() => !!setupState.value.identifierLocked || !!setupState.value.hasLinkedOmsProducts);
const hasRelatedShops = computed(() => {
  return relatedShops.value.some((relatedShop: any) => relatedShop.shopId !== props.id);
});
const activeExperienceMode = computed(() => {
  return resolveProductSyncExperienceMode(experienceMode.value, shopifyShopProductCount.value);
});
const activeExperienceModeLabel = computed(() => {
  return activeExperienceMode.value === "returning" ? translate("Returning user") : translate("First-time setup");
});
const lastSyncLabel = computed(() => {
  const lastSyncedAt = lastProductUpdateSyncedAt.value || latestConfirmedSystemMessage.value?.processedDate;
  return lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString()
    : translate("Sync time");
});
const syncJobObj = computed(() => {
  if (syncJobId.value) {
    const job = jobs.value.find((j: any) => j.jobName === syncJobId.value);
    if (job) return job;
  }

  const selectedShopIdentifiers = [
    props.id,
    shop.value.shopId,
    shop.value.shopifyShopId
  ].filter(Boolean);

  return jobs.value.find((job: any) => {
    return job.instanceOfProductId === PRODUCT_UPDATE_SYNC_JOB_PRODUCT_ID &&
      (job.serviceJobParameters || []).some((param: any) => {
        return ["shopId", "shopifyShopId"].includes(param.parameterName) &&
          selectedShopIdentifiers.includes(param.parameterValue);
      });
  });
});
const isSyncScheduled = computed(() => {
  return !!(syncJobObj.value?.cronExpression || syncJobObj.value?.cronString);
});
const isSyncJobPaused = computed(() => {
  return isJobPaused(syncJobObj.value);
});
const nextSyncLabel = computed(() => {
  return syncJobObj.value?.cronString || translate("Not scheduled");
});
const nextSyncRelativeLabel = computed(() => {
  return getRelativeNextRunLabel(syncJobObj.value);
});
const syncSummarySubtitle = computed(() => {
  if (isSyncJobPaused.value) return translate("Paused");
  return nextSyncLabel.value;
});
const syncJobProductLabel = computed(() => {
  const productId = syncJobDetails.value?.instanceOfProductId;
  if (!productId) return translate("Unavailable");

  const product = products.value?.[productId];
  return product?.productName || product?.internalName || productId;
});
const syncJobLastRunLabel = computed(() => {
  if (syncJobRecentRuns.value.length) {
    return formatDateTime(getSyncJobRunStartedAt(syncJobRecentRuns.value[0]));
  }
  return translate("No recent runs");
});
const syncJobParameters = computed(() => {
  const jobParameters = (syncJobDetails.value?.serviceJobParameters || []).map((parameter: any, index: number) => ({
    key: `job-${parameter.parameterName || index}`,
    label: parameter.parameterName || translate("Parameter"),
    value: formatParameterValue(parameter.parameterValue),
    source: translate("Job parameter")
  }));
  const serviceParameters = (syncJobDetails.value?.serviceInParameters || []).map((parameter: any, index: number) => ({
    key: `service-${parameter.parameterName || parameter.name || index}`,
    label: parameter.parameterName || parameter.name || translate("Parameter"),
    value: formatParameterValue(parameter.defaultValue || parameter.parameterValue || parameter.type || parameter.mode),
    source: translate("Service parameter")
  }));
  return [...jobParameters, ...serviceParameters];
});
const reviewReady = computed(() => {
  return !!reviewStats.value.loaded && !isReviewLoading.value;
});
const nextDisabled = computed(() => {
  return !canAdvanceProductSyncStep(currentStep.value, {
    draft: draft.value,
    productStoreLocked: productStoreLocked.value,
    identifierLocked: identifierLocked.value,
    reviewReady: reviewReady.value,
    progressComplete: reconcileAvailable.value
  });
});
const startSyncDisabled = computed(() => !canStartProductSync(draft.value.startConfirmed));
const progressStatus = computed(() => normalizeProductSyncStatus(progressState.value));
const reconcileAvailable = computed(() => canShowProductSyncReconcile(progressState.value));
const importStatusLabel = computed(() => {
  if (currentStep.value === "reconcile") return translate("Complete");
  if (currentStep.value === "progress") return progressStatus.value;
  return translate("Not started");
});
const importStatusBadgeColor = computed(() => {
  if (currentStep.value === "reconcile") return "success";
  if (currentStep.value === "progress") return progressBadgeColor.value;
  return "medium";
});
const progressBadgeColor = computed(() => {
  if (progressStatus.value === "completed") return "success";
  if (progressStatus.value === "error" || progressStatus.value === "cancelled") return "danger";
  if (progressStatus.value === "running" || progressStatus.value === "sent") return "primary";
  return "medium";
});
const progressSteps = computed(() => {
  const status = progressStatus.value;
  const requestComplete = ["sent", "running", "waiting", "completed"].includes(status);
  const shopifyComplete = ["running", "waiting", "completed"].includes(status);
  const fileComplete = ["completed"].includes(status);

  return [
    {
      name: translate("Request product export from Shopify"),
      caption: progressState.value.systemMessageState,
      status: requestComplete ? getStatusDescription(progressState.value.systemMessageState) : translate("Queued"),
      color: requestComplete ? "primary" : "medium",
      type: 'systemMessage',
      id: progressState.value.systemMessageId,
      statusId: progressState.value.systemMessageState
    },
    {
      name: translate("Process export request in Shopify"),
      caption: progressState.value.bulkOperationStatus || "",
      status: shopifyComplete ? (progressState.value.bulkOperationStatus || translate("Running")) : translate("Pending"),
      color: shopifyComplete ? "primary" : "medium",
      type: 'bulkOperation',
      id: progressState.value.bulkOperationId
    },
    {
      name: translate("Process exported file from Shopify"),
      caption: progressState.value.objectCount ? `${progressState.value.objectCount}` : "",
      status: fileComplete ? translate("Complete") : (progressState.value.mdmLogId ? translate("Running") : translate("Pending")),
      color: fileComplete ? "success" : "medium",
      type: 'mdmLog',
      id: progressState.value.mdmLogId
    },
    {
      name: translate("Complete"),
      caption: "",
      status: fileComplete ? translate("Complete") : translate("Pending"),
      color: fileComplete ? "success" : "medium",
      type: 'summary'
    }
  ];
});
const returningProgressSteps = computed(() => {
  if (syncJobId.value) {
    return progressSteps.value;
  }

  const msg = latestSystemMessage.value;
  let reqCaption = nextSyncLabel.value;
  let reqStatus = translate("Sent");
  let reqColor = "primary";

  if (msg) {
    reqCaption = msg.statusId;
    if (msg.statusId === "SmsgError" || msg.statusId === "SmsgRejected") {
      reqStatus = translate("Error");
      reqColor = "danger";
    } else if (msg.statusId === "SmsgConsumed") {
      reqStatus = translate("Complete");
      reqColor = "success";
    } else {
      reqStatus = getStatusDescription(msg.statusId);
      reqColor = "primary";
    }
  } else {
    reqStatus = translate("Pending");
    reqColor = "medium";
  }

  let mdmCaption = currentMdmLog.value?.totalRecordCount ? `${currentMdmLog.value.totalRecordCount}` : "";
  let mdmStatus = translate("Pending");
  let mdmColor = "medium";

  if (currentMdmLog.value?.statusId) {
    if (currentMdmLog.value.statusId === "DmlSuccess") {
      mdmStatus = translate("Complete");
      mdmColor = "success";
    } else if (currentMdmLog.value.statusId === "DmlError") {
      mdmStatus = translate("Error");
      mdmColor = "danger";
    } else {
      mdmStatus = getStatusDescription(currentMdmLog.value.statusId);
      mdmColor = "primary";
    }
  }

  return [
    {
      name: translate("Request product export from Shopify"),
      caption: reqCaption,
      status: reqStatus,
      color: reqColor,
      type: 'systemMessage',
      id: msg?.systemMessageId,
      statusId: msg?.statusId
    },
    {
      name: translate("Process export request in Shopify"),
      caption: progressState.value.bulkOperationStatus || "",
      status: progressState.value.bulkOperationStatus || translate("Pending"),
      color: (progressState.value.bulkOperationStatus === "completed" || mdmStatus === translate("Complete")) ? "success" : (progressState.value.bulkOperationStatus ? "primary" : "medium"),
      type: 'bulkOperation',
      id: progressState.value.bulkOperationId
    },
    {
      name: translate("Process exported file from Shopify"),
      caption: mdmCaption,
      status: mdmStatus,
      color: mdmColor,
      type: 'mdmLog',
      id: currentMdmLog.value?.logId,
      statusId: currentMdmLog.value?.statusId
    },
    {
      name: translate("Complete"),
      caption: "",
      status: mdmStatus === translate("Complete") ? translate("Complete") : translate("Pending"),
      color: mdmStatus === translate("Complete") ? "success" : "medium",
      type: 'summary'
    }
  ];
});
const recentSyncUpdates = computed(() => {
  return productUpdateHistories.value.map((history: any) => ({
    id: [history.shopId, history.productId, history.lastUpdatedStamp].filter(Boolean).join("-"),
    internalName: history.diffs?.title || history.diffs?.handle || history.productId,
    shopifyId: getShopifyProductReference(history),
    updatedTime: history.lastUpdatedStamp ? new Date(history.lastUpdatedStamp).toLocaleString() : translate("Recent"),
    details: history.details || []
  }));
});

function getShopifyProductReference(history: any) {
  const diffId = history.diffs?.id ? String(history.diffs.id) : "";
  const productReference = diffId.startsWith("gid://shopify/Product/")
    ? diffId
    : history.parentProductId || history.diffs?.parentProductId || history.productId || diffId;
  if (!productReference) return "N/A";
  if (String(productReference).startsWith("gid://shopify/")) return formatShopifyReference(productReference);
  if (history.parentProductId || String(history.productId).length >= 10) return `Product ${productReference}`;
  return String(productReference);
}

function formatShopifyReference(reference: string) {
  const parts = String(reference).split("/");
  const id = parts.pop();
  const resource = parts.pop();
  if (resource && id) return `${resource} ${id}`;
  return reference;
}


const recentSyncErrors = computed(() => {
  if (errorLogs.value && errorLogs.value.length) {
    return errorLogs.value.map((err: any, index: number) => ({
      id: err.id || err.internalName || err.shopifyId || `sync-error-${index}`,
      internalName: err.internalName || translate("Unknown product"),
      shopifyId: err.shopifyId || err.id || "N/A",
      updatedTime: err.updatedTime || currentMdmLog.value?.createdDate || translate("Recent"),
      errorContent: err.errorString || err.error || err.message || JSON.stringify(err)
    }));
  }
  return [];
});
const preflightTitle = computed(() => {
  return requiresPreflightConfirmation(preflightResult.value)
    ? translate("Review possible catalog mismatch")
    : translate("Preflight sample looks matched");
});
const preflightRequiresConfirmation = computed(() => {
  return preflightLoaded.value && requiresPreflightConfirmation(preflightResult.value);
});
const preflightSubtitle = computed(() => {
  return translate("Matched {matched} of {sampled} sampled products.", {
    matched: preflightResult.value.matched,
    sampled: preflightResult.value.sampled
  });
});

onIonViewWillEnter(async () => {
  startNextSyncRefreshPolling();
  await loadWizard();
});

watch(() => draft.value.selectedProductStoreId, async (productStoreId) => {
  if (productStoreId) {
    await loadProductStoreContext(productStoreId);
  } else {
    relatedShops.value = [];
  }
});

onBeforeUnmount(() => {
  stopProgressPolling();
  stopNextSyncRefreshPolling();
});

async function loadWizard() {
  isLoading.value = true;
  try {
    if (!shop.value.shopId) {
      await store.dispatch("shopify/fetchShopifyShops");
    }

    await Promise.all([
      store.dispatch("productStore/fetchProductStores"),
      store.dispatch("shopify/fetchShopifyTypeMappings", "SHOPIFY_PRODUCT_TYPE"),
      fetchJobs()
    ]);


    // Fetch details for product-update sync jobs to get parameters (needed to find the job for this shop)
    const syncJobs = jobs.value.filter((job: any) => job.instanceOfProductId === PRODUCT_UPDATE_SYNC_JOB_PRODUCT_ID || (syncJobId.value && job.jobName === syncJobId.value));

    await Promise.all(syncJobs.map(async (job: any) => {
      const details = await fetchJobDetail(job.jobName);
      Object.assign(job, details);
    }));


    if (shop.value.productStoreId) {
      await store.dispatch("productStore/fetchProductStoreDetails", shop.value.productStoreId);
    }

    await loadSelectedShopSystemMessageRemoteId();
    await loadLatestSystemMessage();
    await loadShopifyShopProductCount();

    setupState.value = await ShopifyProductSyncService.fetchSetupState({
      shopId: props.id,
      shop: shop.value,
      productStore: selectedProductStore.value
    });

    draft.value = createProductSyncWizardDraft({
      selectedProductStoreId: setupState.value.selectedProductStoreId || shop.value.productStoreId || "",
      selectedIdentifierEnumId: setupState.value.selectedIdentifierEnumId || selectedProductStore.value.productIdentifierEnumId || recommendedIdentifierEnumId.value,
      productStoreVerified: !!setupState.value.productStoreLocked,
      syncStarted: !!setupState.value.syncJobId,
      startConfirmed: false
    });

    syncJobId.value = setupState.value.syncJobId || "";
    if (setupState.value.completed) {
      currentStep.value = "reconcile";
    } else if (syncJobId.value) {
      currentStep.value = "progress";
      await loadProgress();
      startProgressPolling();
    } else {
      currentStep.value = "home";
    }

    if (draft.value.selectedProductStoreId) {
      await loadProductStoreContext(draft.value.selectedProductStoreId);
    }
  } catch (error: any) {
    logger.error(error);
    showToast(translate("Failed to load product sync"));
    currentStep.value = "home";
  } finally {
    isLoading.value = false;
  }
}

async function loadSelectedShopSystemMessageRemoteId() {
  selectedShopSystemMessageRemoteId.value = await ShopifyProductSyncService.fetchShopSystemMessageRemoteId({
    shopId: props.id,
    shop: shop.value
  });
}

async function openStepDetails(step: any) {
  currentStepDetail.value = step;
  showStepDetailsModal.value = true;

  if (step.type === 'mdmLog' && step.id) {
    isStepDetailsLoading.value = true;
    try {
      await fetchLogDetails(step.id);
    } finally {
      isStepDetailsLoading.value = false;
    }
  }
}

async function loadShopifyShopProductCount() {
  const countState = await ShopifyProductSyncService.fetchShopifyShopProductCount({
    shopId: props.id,
    systemMessageRemoteId: selectedShopSystemMessageRemoteId.value,
    lastSyncedAt: lastProductUpdateSyncedAt.value,
    shop: shop.value
  });
  shopifyShopProductCount.value = Number(countState.count || 0);
}

async function loadUnsyncedProductUpdates() {
  isUnsyncedUpdatesLoading.value = true;
  try {
    unsyncedProductUpdates.value = await ShopifyProductSyncService.fetchUnsyncedProductUpdates({
      shopId: props.id,
      systemMessageRemoteId: selectedShopSystemMessageRemoteId.value,
      lastSyncedAt: lastProductUpdateSyncedAt.value,
      shop: shop.value,
      pageSize: 100
    });
  } catch (error: any) {
    logger.error(error);
    unsyncedProductUpdates.value = [];
    showToast(translate("Failed to load un-synced product updates."));
  }
  isUnsyncedUpdatesLoading.value = false;
}

async function openUnsyncedUpdatesModal() {
  showUnsyncedUpdatesModal.value = true;
  await loadUnsyncedProductUpdates();
}

function formatShopifyDate(value: string) {
  if (!value) return translate("Recent");
  return new Date(value).toLocaleString();
}

async function loadLatestSystemMessage() {
  const syncRunState = await ShopifyProductSyncService.fetchProductUpdateSyncRunState({
    shopId: props.id,
    systemMessageRemoteId: selectedShopSystemMessageRemoteId.value,
    shop: shop.value
  });

  latestSystemMessage.value = syncRunState.latestSystemMessage || null;
  latestConfirmedSystemMessage.value = syncRunState.latestConfirmedSystemMessage || null;
  lastProductUpdateSyncedAt.value = syncRunState.lastSyncedAt || "";

  if (latestSystemMessage.value?.systemMessageId) {
    await fetchMdmLogBySystemMessageId(latestSystemMessage.value.systemMessageId);
  }

  await fetchProductUpdateHistory({ shopId: props.id, pageSize: 10 });
}


async function loadProductStoreContext(productStoreId: string) {
  const context = await ShopifyProductSyncService.fetchProductStoreContext({
    shopId: props.id,
    productStoreId,
    shops: store.getters["shopify/getShops"] || []
  });
  relatedShops.value = context.relatedShops || [];
}

function getProductStoreName(productStore: any) {
  if (!productStore?.productStoreId) return "";
  return productStore.storeName || productStore.productStoreId;
}

function getConnectedShopLabel(productStoreId: string) {
  const count = (store.getters["shopify/getShops"] || []).filter((shopifyShop: any) => {
    return shopifyShop.productStoreId === productStoreId;
  }).length;
  return translate("{count} Shopify stores connected", { count });
}

function handleProductStoreChange(productStoreId: string) {
  if (productStoreLocked.value) return;
  draft.value = selectProductStore(draft.value, productStoreId);
}

function handleIdentifierChange(identifierEnumId: string) {
  if (identifierLocked.value) return;
  draft.value.selectedIdentifierEnumId = identifierEnumId;
}

function handleExperienceModeChange(mode: ProductSyncExperienceMode) {
  if (!mode) return;
  showModeModal.value = false;
  window.setTimeout(() => {
    experienceMode.value = mode;
  }, 250);
}

async function runSyncJob(job: any) {
  if (!job?.jobName) return;

  const jobAlert = await alertController.create({
    header: translate("Run now"),
    message: translate("Running this job now will not replace this job. A copy of this job will be created and run immediately. You may not be able to reverse this action."),
    buttons: [
      {
        text: translate("Cancel"),
        role: "cancel",
      },
      {
        text: translate("Run now"),
        handler: async () => {
          try {
            await runNow(job.jobName);
            showToast(translate("Job has been scheduled to run now"));
          } catch (err) {
            logger.error("Failed to run job now", err);
            showToast(translate("Failed to run job"));
          }
        }
      }
    ]
  });

  await jobAlert.present();
}



async function scheduleSyncJob(cronExpression: string) {
  if (!syncJobObj.value?.jobName || !cronExpression) return;

  await updateSyncJob({
    jobName: syncJobObj.value.jobName,
    cronExpression,
    paused: isSyncJobPaused.value ? "Y" : "N"
  }, translate("Sync job updated successfully."));
}

async function togglePauseSyncJob(shouldPause: boolean) {
  if (!syncJobObj.value?.jobName) return;

  await updateSyncJob({
    jobName: syncJobObj.value.jobName,
    paused: shouldPause ? "Y" : "N",
    cronExpression: syncJobObj.value.cronExpression
  }, shouldPause ? translate("Sync job paused.") : translate("Sync job resumed."));
}

async function updateSyncJob(payload: any, successMessage: string) {
  try {
    const response = await updateJob(payload);
    if (hasError(response)) {
      throw response.data;
    }

    const updatedJob = await fetchJobDetail(payload.jobName);
    if (syncJobObj.value) {
      Object.assign(syncJobObj.value, updatedJob, {
        paused: payload.paused ?? updatedJob.paused,
        cronExpression: payload.cronExpression ?? updatedJob.cronExpression
      });
    }

    if (showSyncJobDetailsModal.value) {
      await refreshSyncJobDetails();
    }

    showToast(successMessage);
  } catch (error: any) {
    logger.error(error);
    showToast(translate("Failed to update sync job."));
  }
}

async function openSyncJobDetailsModal() {
  if (!syncJobObj.value?.jobName) return;
  showSyncJobDetailsModal.value = true;
  await refreshSyncJobDetails();
}

function closeSyncJobDetailsModal() {
  showSyncJobDetailsModal.value = false;
}

async function refreshSyncJobDetails() {
  if (!syncJobObj.value?.jobName) return;

  isSyncJobDetailsLoading.value = true;
  try {
    const [jobDetails, jobRuns] = await Promise.all([
      fetchJobDetail(syncJobObj.value.jobName),
      fetchJobRuns(syncJobObj.value.jobName, { pageSize: 5, pageIndex: 0 })
    ]);

    syncJobDetails.value = jobDetails || {};
    syncJobRecentRuns.value = Array.isArray(jobRuns) ? jobRuns : [];

    if (jobDetails?.instanceOfProductId && !products.value?.[jobDetails.instanceOfProductId]) {
      await fetchProductDetail(jobDetails.instanceOfProductId);
    }
  } catch (error: any) {
    logger.error(error);
    syncJobDetails.value = {};
    syncJobRecentRuns.value = [];
    showToast(translate("Failed to load sync job details."));
  } finally {
    isSyncJobDetailsLoading.value = false;
  }
}

function openHistory() {

  router.push(`/shopify-connection-details/${props.id}/product-sync/history`);
}

async function goNext() {
  if (nextDisabled.value || isSaving.value) return;

  if (currentStep.value === "product-store") {
    const saved = await persistProductStoreSelection();
    if (!saved) return;
  }

  if (currentStep.value === "identifier") {
    const saved = await persistIdentifierSelection();
    if (!saved) return;
  }

  currentStep.value = nextProductSyncStep(currentStep.value);

  if (currentStep.value === "review") {
    await loadReviewStats();
  }

  if (currentStep.value === "reconcile") {
    await loadReconcile();
  }
}

function goBack() {
  currentStep.value = previousProductSyncStep(currentStep.value);
}

async function persistProductStoreSelection() {
  if (productStoreLocked.value) return true;
  if (shop.value.productStoreId === draft.value.selectedProductStoreId) return true;
  isSaving.value = true;
  try {
    const resp = await ShopifyService.updateShopifyShop({
      shopId: props.id,
      productStoreId: draft.value.selectedProductStoreId
    });

    if (!hasError(resp)) {
      await store.dispatch("shopify/fetchShopifyShops");
      isSaving.value = false;
      return true;
    } else {
      throw resp.data;
    }
  } catch (error: any) {
    logger.error(error);
    showToast(translate("Failed to link product store"));
  }
  isSaving.value = false;
  return false;
}

async function persistIdentifierSelection() {
  if (identifierLocked.value || !draft.value.selectedProductStoreId) return true;
  isSaving.value = true;
  try {
    const payload = {
      ...selectedProductStore.value,
      productStoreId: draft.value.selectedProductStoreId,
      productIdentifierEnumId: draft.value.selectedIdentifierEnumId
    };
    const resp = await ProductStoreService.updateProductStore(payload);

    if (!hasError(resp)) {
      store.dispatch("productStore/updateCurrent", payload);
      isSaving.value = false;
      return true;
    } else {
      throw resp.data;
    }
  } catch (error: any) {
    logger.error(error);
    showToast(translate("Failed to update product store settings."));
  }
  isSaving.value = false;
  return false;
}

async function loadReviewStats() {
  isReviewLoading.value = true;
  try {
    reviewStats.value = await ShopifyProductSyncService.fetchReviewStats({
      shopId: props.id,
      productStoreId: draft.value.selectedProductStoreId,
      linkedShopCount: relatedShops.value.length,
      systemMessageRemoteId: selectedShopSystemMessageRemoteId.value,
      shop: shop.value
    });
  } catch (error: any) {
    logger.error(error);
    reviewStats.value = {
      shopifyProductCount: undefined,
      shopifyVariantCount: undefined,
      omsProductCount: undefined,
      omsVariantCount: undefined,
      linkedShopCount: relatedShops.value.length,
      loaded: false
    };
    showToast(translate("Failed to load Shopify product counts."));
  }
  isReviewLoading.value = false;
}

function toggleProductStoreVerification() {
  if (!draft.value.selectedProductStoreId || productStoreLocked.value) return;
  draft.value.productStoreVerified = !draft.value.productStoreVerified;
}

function togglePreflightWarningConfirmation() {
  preflightWarningConfirmed.value = !preflightWarningConfirmed.value;
}

function toggleStartConfirmation() {
  draft.value.startConfirmed = !draft.value.startConfirmed;
}

async function loadPreflight() {
  preflightResult.value = await ShopifyProductSyncService.fetchPreflight({
    shopId: props.id,
    productStoreId: draft.value.selectedProductStoreId,
    productIdentifierEnumId: draft.value.selectedIdentifierEnumId
  });
  preflightLoaded.value = true;
  preflightWarningConfirmed.value = false;
}

async function openMistakeModal() {
  await loadPreflight();
  showMistakeModal.value = true;
}

async function openStartSyncModal() {
  if (!preflightLoaded.value) {
    await loadPreflight();
  }

  if (preflightRequiresConfirmation.value && !preflightAccepted.value) {
    showMistakeModal.value = true;
    return;
  }

  const action = getReviewImportAction();
  if (action.opensStartConfirmation) {
    draft.value.startConfirmed = false;
    showStartSyncModal.value = true;
  }
}

function acceptPreflightAndOpenStartSync() {
  if (!preflightWarningConfirmed.value) return;
  preflightAccepted.value = true;
  showMistakeModal.value = false;
  openStartSyncModal();
}

async function startProductSync() {
  if (!canStartProductSync(draft.value.startConfirmed)) return;
  isSaving.value = true;
  try {
    const result = await ShopifyProductSyncService.startInitialImport({
      shopId: props.id,
      productStoreId: draft.value.selectedProductStoreId,
      productIdentifierEnumId: draft.value.selectedIdentifierEnumId
    });

    if (shouldShowProductSyncProgress(result)) {
      syncJobId.value = result.syncJobId || result.progress?.syncJobId;
      progressState.value = result.progress || progressState.value;
      draft.value.syncStarted = true;
      showStartSyncModal.value = false;
      currentStep.value = "progress";
      await loadProgress();
      startProgressPolling();
    } else {
      showToast(result.error || translate("Product sync could not be started."));
    }
  } catch (error: any) {
    logger.error(error);
    showToast(translate("Failed to start product sync"));
  }
  isSaving.value = false;
}

async function loadProgress() {
  if (!syncJobId.value) return;
  progressState.value = await ShopifyProductSyncService.fetchProgress({
    shopId: props.id,
    syncJobId: syncJobId.value
  });

  if (reconcileAvailable.value) {
    stopProgressPolling();
  }
}

function startProgressPolling() {
  stopProgressPolling();
  progressPoll = window.setInterval(loadProgress, 5000);
}

function stopProgressPolling() {
  if (progressPoll) {
    window.clearInterval(progressPoll);
    progressPoll = undefined;
  }
}

function startNextSyncRefreshPolling() {
  stopNextSyncRefreshPolling();
  currentTimeMs.value = Date.now();
  nextSyncRefreshPoll = window.setInterval(() => {
    currentTimeMs.value = Date.now();
  }, 60000);
}

function stopNextSyncRefreshPolling() {
  if (nextSyncRefreshPoll) {
    window.clearInterval(nextSyncRefreshPoll);
    nextSyncRefreshPoll = undefined;
  }
}

async function loadReconcile() {
  reconcileState.value = await ShopifyProductSyncService.fetchReconcile({
    shopId: props.id,
    productStoreId: draft.value.selectedProductStoreId,
    syncJobId: syncJobId.value
  });
  if (!reviewStats.value.loaded) {
    await loadReviewStats();
  }
}

function isJobPaused(job: any) {
  const status = String(job?.statusId || job?.status || "").toLowerCase();
  return job?.paused === "Y" || job?.paused === true || job?.isPaused === true || status === "paused";
}

function getRelativeNextRunLabel(job: any) {
  if (!job?.cronExpression) {
    return translate("Not scheduled");
  }
  if (isJobPaused(job)) {
    return translate("Paused");
  }

  const nextRun = getNextRunDateTime(job);
  if (!nextRun) {
    return translate("Scheduled");
  }

  const diffInMinutes = Math.max(0, Math.round(nextRun.diff(DateTime.fromMillis(currentTimeMs.value), "minutes").minutes));
  if (diffInMinutes < 1) {
    return translate("Now");
  }
  if (diffInMinutes === 1) {
    return translate("1 min");
  }
  return translate("{count} mins", { count: diffInMinutes });
}

function getNextRunDateTime(job: any) {
  const nextExecutionDateTime = job?.nextExecutionDateTime || job?.nextRunTime || job?.nextRunDate || job?.nextRuntime;
  if (nextExecutionDateTime) {
    const parsed = DateTime.fromISO(nextExecutionDateTime);
    if (parsed.isValid) return parsed;
    const fallbackParsed = DateTime.fromJSDate(new Date(nextExecutionDateTime));
    if (fallbackParsed.isValid) return fallbackParsed;
  }

  if (!job?.cronExpression) return null;

  try {
    const interval = cronParser.parseExpression(job.cronExpression, {
      tz: userProfile.value?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      currentDate: new Date(currentTimeMs.value)
    });
    return DateTime.fromMillis((interval.next() as any)["_date"].ts);
  } catch (error) {
    logger.error("Failed to calculate next service job run", error);
    return null;
  }
}

function formatDateTime(value: string) {
  if (!value) return translate("Unavailable");
  return new Date(value).toLocaleString();
}

function formatParameterValue(value: unknown) {
  if (value === undefined || value === null || value === "") return translate("Unavailable");
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getSyncJobStatusLabel(job: any) {
  return job?.statusId || job?.status || (isJobPaused(job) ? translate("Paused") : translate("Active"));
}

function getSyncJobRunKey(run: any) {
  return run.jobRunId || run.runId || run.serviceJobRunId || run.systemMessageId || run.createdDate || JSON.stringify(run);
}

function getSyncJobRunTitle(run: any) {
  return run.jobRunId || run.runId || run.serviceJobRunId || run.systemMessageId || translate("Run");
}

function getSyncJobRunStartedAt(run: any) {
  return run.startDate || run.startTime || run.createdDate || run.createdStamp || run.lastUpdatedStamp || "";
}

function getSyncJobRunCompletedAt(run: any) {
  return run.endDate || run.endTime || run.finishDateTime || "";
}

function getSyncJobRunStatus(run: any) {
  if (run.hasError === "Y") return translate("Failed");
  if (getSyncJobRunCompletedAt(run)) return translate("Success");
  if (getSyncJobRunStartedAt(run)) return translate("Running");
  return translate("Terminated");
}

function getSyncJobRunStatusColor(run: any) {
  if (run.hasError === "Y") return "danger";
  if (getSyncJobRunCompletedAt(run)) return "success";
  if (getSyncJobRunStartedAt(run)) return "primary";
  return "warning";
}

function getSyncJobRunDuration(run: any) {
  if (run.runtime) return `${run.runtime} ms`;
  if (run.elapsedTime) return `${run.elapsedTime} ms`;

  const startTime = parseDateTimeValue(getSyncJobRunStartedAt(run));
  const endTime = parseDateTimeValue(getSyncJobRunCompletedAt(run));
  if (!startTime || !endTime) return "";

  const diff = endTime.diff(startTime, ["minutes", "seconds"]).toObject();
  const minutes = Math.floor(diff.minutes || 0);
  const seconds = Math.floor(diff.seconds || 0);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function getSyncJobRunCount(run: any) {
  if (run.objectCount) return `${run.objectCount} ${translate("objects")}`;
  if (run.totalRecordCount) return `${run.totalRecordCount} ${translate("records")}`;
  return "";
}

function getSyncJobRunUser(run: any) {
  return run.userId || run.runAsUser || run.createdByUserLogin || "";
}

function getSyncJobRunMessage(run: any) {
  return run.messages || run.message || run.errorMessage || run.reason || run.errors || "";
}

function parseDateTimeValue(value: string | number) {
  if (!value) return null;

  if (typeof value === "number") {
    const dateTime = DateTime.fromMillis(value);
    return dateTime.isValid ? dateTime : null;
  }

  const candidates = [
    DateTime.fromFormat(value, "yyyy-MM-dd HH:mm:ss.SSS"),
    DateTime.fromSQL(value),
    DateTime.fromISO(value),
    DateTime.fromJSDate(new Date(value))
  ];

  return candidates.find((candidate) => candidate.isValid) || null;
}

</script>
