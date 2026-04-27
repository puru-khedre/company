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
          :last-sync-label="lastSyncLabel"
          :next-sync-label="nextSyncLabel"
          :progress-steps="returningProgressSteps"
          :recent-sync-errors="recentSyncErrors"
          :recent-sync-updates="recentSyncUpdates"
          :selected-product-store-name="selectedProductStoreName"
          :unsynced-updates-count="shopifyShopProductCount"
          :sync-job-obj="syncJobObj"
          @open-history="openHistory"
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
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
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
import { useSystemMessage } from "@/composables/useSystemMessage";
import { useProductUpdateHistory } from "@/composables/useProductUpdateHistory";

const props = defineProps(["id"]);
const store = useStore();
const router = useRouter();
const { jobs } = useServiceJob();
const { fetchSystemMessages, fetchMdmLogBySystemMessageId, currentMdmLog, errorLogs } = useSystemMessage();
const { productUpdateHistories, fetchProductUpdateHistory } = useProductUpdateHistory();

const latestSystemMessage = ref<any>(null);
const isLoading = ref(true);
const isSaving = ref(false);
const isReviewLoading = ref(false);
const showModeModal = ref(false);
const showMistakeModal = ref(false);
const showStartSyncModal = ref(false);
const preflightLoaded = ref(false);
const preflightAccepted = ref(false);
const preflightWarningConfirmed = ref(false);
const experienceMode = ref<ProductSyncExperienceMode>("auto");
const currentStep = ref<ProductSyncWizardStep>("home");
const draft = ref(createProductSyncWizardDraft());
const relatedShops = ref<any[]>([]);
const shopifyShopProductCount = ref(0);
const syncJobId = ref("");
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

const shop = computed(() => store.getters["shopify/getShopById"](props.id) || {});
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
  return progressState.value.updatedAt || progressState.value.lastUpdatedStamp || translate("Sync time");
});
const syncJobObj = computed(() => {
  if (syncJobId.value) {
    const job = jobs.value.find((j: any) => j.jobName === syncJobId.value);
    if (job) return job;
  }

  const possibleRemoteIds = [
    shop.value.systemMessageRemoteId,
    latestSystemMessage.value?.systemMessageRemoteId,
    shop.value.shopifyConfigId,
    props.id
  ].filter(Boolean);

  return jobs.value.find((job: any) => {
    return job.instanceOfProductId === "QUEUE_UPD_PRD_FEED" &&
      (job.serviceJobParameters || []).some((param: any) => possibleRemoteIds.includes(param.parameterValue));
  });
});




const isSyncScheduled = computed(() => {
  return !!syncJobObj.value?.cronString;
});
const nextSyncLabel = computed(() => {
  return syncJobObj.value?.cronString || translate("Not scheduled");
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
      status: requestComplete ? translate("Sent") : translate("Queued"),
      color: requestComplete ? "primary" : "medium"
    },
    {
      name: translate("Process export request in Shopify"),
      caption: progressState.value.bulkOperationStatus || "",
      status: shopifyComplete ? translate("Running") : translate("Pending"),
      color: shopifyComplete ? "primary" : "medium"
    },
    {
      name: translate("Process exported file from Shopify"),
      caption: progressState.value.objectCount ? `${progressState.value.objectCount}` : "",
      status: fileComplete ? translate("Complete") : translate("Pending"),
      color: fileComplete ? "success" : "medium"
    },
    {
      name: translate("Complete"),
      caption: "",
      status: fileComplete ? translate("Complete") : translate("Pending"),
      color: fileComplete ? "success" : "medium"
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
      reqStatus = translate("Sent");
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
      mdmStatus = translate("Running");
      mdmColor = "primary";
    }
  }

  return [
    {
      name: translate("Request product export from Shopify"),
      caption: reqCaption,
      status: reqStatus,
      color: reqColor
    },
    {
      name: translate("Process export request in Shopify"),
      status: translate("Pending"),
      color: "medium"
    },
    {
      name: translate("Process exported file from Shopify"),
      caption: mdmCaption,
      status: mdmStatus,
      color: mdmColor
    },
    {
      name: translate("Complete"),
      status: "",
      color: "medium"
    }
  ];
});
const recentSyncUpdates = computed(() => {
  return productUpdateHistories.value.map((history: any) => ({
    id: history.productId,
    internalName: history.diffs?.title || history.productId,
    shopifyId: history.parentProductId || "N/A",
    updatedTime: history.lastUpdatedStamp ? new Date(history.lastUpdatedStamp).toLocaleString() : translate("Recent"),
    details: history.details || []
  }));
});


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
});

async function loadWizard() {
  isLoading.value = true;
  try {
    if (!shop.value.shopId) {
      await store.dispatch("shopify/fetchShopifyShops");
    }

    const { fetchJobs, fetchJobDetail } = useServiceJob();
    await Promise.all([
      store.dispatch("productStore/fetchProductStores"),
      store.dispatch("shopify/fetchShopifyTypeMappings", "SHOPIFY_PRODUCT_TYPE"),
      fetchJobs()
    ]);


    // Fetch details for QUEUE_UPD_PRD_FEED jobs to get parameters (needed to find the job for this shop)
    const syncJobs = jobs.value.filter((job: any) => job.instanceOfProductId === "QUEUE_UPD_PRD_FEED" || (syncJobId.value && job.jobName === syncJobId.value));

    await Promise.all(syncJobs.map(async (job: any) => {
      const details = await fetchJobDetail(job.jobName);
      Object.assign(job, details);
    }));


    if (shop.value.productStoreId) {
      await store.dispatch("productStore/fetchProductStoreDetails", shop.value.productStoreId);
    }

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

async function loadShopifyShopProductCount() {
  const countState = await ShopifyProductSyncService.fetchShopifyShopProductCount({
    shopId: props.id
  });
  shopifyShopProductCount.value = Number(countState.count || 0);
}

async function loadLatestSystemMessage() {
  if (shop.value.systemMessageRemoteId) {
    const messages = await fetchSystemMessages({
      systemMessageTypeId: "BulkQueryShopifyProductUpdates",
      systemMessageRemoteId: shop.value.systemMessageRemoteId,
      orderBy: "-initDate",
      pageSize: 1
    });

    if (messages && messages.length > 0) {
      latestSystemMessage.value = messages[0];
      await fetchMdmLogBySystemMessageId(latestSystemMessage.value.systemMessageId);
    }
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
          const { runNow } = useServiceJob();
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
  reviewStats.value = await ShopifyProductSyncService.fetchReviewStats({
    shopId: props.id,
    productStoreId: draft.value.selectedProductStoreId,
    linkedShopCount: relatedShops.value.length
  });
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

</script>

<style>



</style>