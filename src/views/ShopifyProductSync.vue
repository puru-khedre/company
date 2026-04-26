<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="'/shopify-connection-details/' + id" />
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

      <template v-else>
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ translate("Sync product catalog") }}</ion-card-title>
          </ion-card-header>

          <ion-card-content>
            <p v-if="currentStep === 'home'">
              {{ translate("Looks like you’re syncing products from this Shopify account to HotWax for the first time.") }}
            </p>
            <p v-if="currentStep === 'home'">
              {{ translate("Before you start the import process, lets make sure everything is configured correctly.") }}
            </p>
          </ion-card-content>

          <ion-list lines="full">
            <ion-item>
              <ion-label>{{ translate("Product store") }}</ion-label>
              <ion-note slot="end">{{ selectedProductStoreName }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("Internal name mapping") }}</ion-label>
              <ion-note slot="end">{{ selectedIdentifierLabel }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("Product types") }}</ion-label>
              <ion-note slot="end">{{ productTypeMappingsLabel }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("Start product import") }}</ion-label>
              <ion-badge slot="end" :color="importStatusBadgeColor">{{ importStatusLabel }}</ion-badge>
            </ion-item>
          </ion-list>
        </ion-card>

        <ion-card v-if="currentStep === 'home'">
          <ion-card-content>
            <ion-button expand="block" @click="goNext()" data-testid="review-configurations">
              {{ translate("Review configurations") }}
            </ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card v-if="currentStep === 'product-store'">
          <ion-card-header>
            <ion-card-title>{{ translate("Confirm product store") }}</ion-card-title>
            <ion-card-subtitle>{{ translate("Only Shopify stores with the same catalog should share a Product Store.") }}</ion-card-subtitle>
          </ion-card-header>
          <ion-list lines="full">
            <ion-radio-group :value="draft.selectedProductStoreId" @ionChange="handleProductStoreChange($event.detail.value)">
              <ion-item v-for="productStore in productStores" :key="productStore.productStoreId">
                <ion-radio slot="start" :value="productStore.productStoreId" :disabled="productStoreLocked" />
                <ion-label>
                  {{ getProductStoreName(productStore) }}
                  <p>{{ productStore.productStoreId }}</p>
                  <p>{{ getConnectedShopLabel(productStore.productStoreId) }}</p>
                </ion-label>
              </ion-item>
            </ion-radio-group>
          </ion-list>
          <ion-list v-if="hasRelatedShops" lines="full">
            <ion-item>
              <ion-label>
                {{ translate("Verify related Shopify stores") }}
                <p>{{ translate("Make sure these Shopify stores use the same catalog before continuing.") }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-for="relatedShop in relatedShops" :key="relatedShop.shopId">
              <ion-label>
                {{ relatedShop.name || relatedShop.shopId }}
                <p>{{ relatedShop.shopId === id ? translate("New shop") : translate("Connected shop") }}</p>
              </ion-label>
              <ion-note slot="end">{{ relatedShop.createdDate || relatedShop.createdStamp || translate("Created date unavailable") }}</ion-note>
            </ion-item>
          </ion-list>
          <ion-item
            lines="full"
            button
            :disabled="!draft.selectedProductStoreId || productStoreLocked"
            @click="toggleProductStoreVerification()"
          >
            <ion-checkbox
              :checked="draft.productStoreVerified"
              :disabled="!draft.selectedProductStoreId || productStoreLocked"
              label-placement="end"
              data-testid="product-store-verification"
            >
              {{ translate("I have verified that these Shopify stores are part of the selected Product Store.") }}
            </ion-checkbox>
          </ion-item>
          <ion-card-content>
            <ion-button fill="clear" @click="goBack()">{{ translate("Back") }}</ion-button>
            <ion-button expand="block" :disabled="nextDisabled || isSaving" @click="goNext()" data-testid="product-store-next">
              {{ translate("Next") }}
            </ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card v-if="currentStep === 'identifier'">
          <ion-card-header>
            <ion-card-title>{{ translate("Confirm internal name mapping") }}</ion-card-title>
            <ion-card-subtitle>{{ translate("The identifier controls how Shopify products match HotWax products.") }}</ion-card-subtitle>
          </ion-card-header>
          <ion-list v-if="identifierLocked" lines="full">
            <ion-item>
              <ion-label>
                {{ translate("This setting cannot be changed because this Product Store already has synced products.") }}
              </ion-label>
            </ion-item>
          </ion-list>
          <ion-list lines="full">
            <ion-radio-group :value="draft.selectedIdentifierEnumId" @ionChange="handleIdentifierChange($event.detail.value)">
              <ion-item v-for="identifier in identifierOptions" :key="identifier.enumId">
                <ion-radio slot="start" :value="identifier.enumId" :disabled="identifierLocked" />
                <ion-label>
                  {{ identifier.description || identifier.enumId }}
                  <p v-if="identifier.enumId === recommendedIdentifierEnumId">{{ translate("Recommended") }}</p>
                </ion-label>
              </ion-item>
            </ion-radio-group>
          </ion-list>
          <ion-list v-if="hasRelatedShops" lines="full">
            <ion-item v-for="relatedShop in relatedShops" :key="relatedShop.shopId">
              <ion-label>
                {{ relatedShop.name || relatedShop.shopId }}
                <p>{{ relatedShop.shopId === id ? translate("New shop") : translate("Connected shop") }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
          <ion-card-content>
            <ion-button fill="clear" @click="goBack()">{{ translate("Back") }}</ion-button>
            <ion-button expand="block" :disabled="nextDisabled || isSaving" @click="goNext()" data-testid="identifier-next">
              {{ translate("Next") }}
            </ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card v-if="currentStep === 'product-types'">
          <ion-card-header>
            <ion-card-title>{{ translate("Map product types") }}</ion-card-title>
            <ion-card-subtitle>{{ translate("Review the Shopify product type mappings before import.") }}</ion-card-subtitle>
          </ion-card-header>
          <ion-list lines="full">
            <ion-item v-if="!productTypeMappings.length">
              <ion-label>
                {{ translate("No product type mappings found") }}
                <p>{{ translate("Product type mapping is informational for this first version.") }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-for="mapping in productTypeMappings" :key="`${mapping.mappedKey}-${mapping.mappedValue}`">
              <ion-label>
                {{ mapping.mappedKey }}
                <p>{{ mapping.mappedValue }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
          <ion-card-content>
            <ion-button fill="clear" @click="goBack()">{{ translate("Back") }}</ion-button>
            <ion-button expand="block" :disabled="nextDisabled" @click="goNext()" data-testid="finish-configuration">
              {{ translate("Finish configuration") }}
            </ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card v-if="currentStep === 'review'">
          <ion-card-header>
            <ion-card-title>{{ translate("Review product import") }}</ion-card-title>
            <ion-card-subtitle>{{ translate("Compare Shopify and HotWax catalog state before starting the first import.") }}</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content v-if="isReviewLoading">
            <ion-spinner name="crescent" />
          </ion-card-content>
          <ion-list v-else lines="full">
            <ion-item>
              <ion-label>{{ translate("Shopify products") }}</ion-label>
              <ion-note slot="end">{{ reviewStats.shopifyProductCount }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("Shopify variants") }}</ion-label>
              <ion-note slot="end">{{ reviewStats.shopifyVariantCount }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("HotWax products") }}</ion-label>
              <ion-note slot="end">{{ reviewStats.omsProductCount }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("HotWax variants") }}</ion-label>
              <ion-note slot="end">{{ reviewStats.omsVariantCount }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("Linked Shopify stores") }}</ion-label>
              <ion-note slot="end">{{ reviewStats.linkedShopCount }}</ion-note>
            </ion-item>
          </ion-list>
          <ion-card-content>
            <ion-button fill="clear" @click="goBack()">{{ translate("Back") }}</ion-button>
            <ion-button expand="block" fill="outline" :disabled="!reviewReady" @click="openMistakeModal()" data-testid="mistake-check">
              {{ translate("Am I making a mistake?") }}
            </ion-button>
            <ion-button expand="block" :disabled="!reviewReady" @click="openStartSyncModal()" data-testid="run-product-import">
              {{ translate("Run product import") }}
            </ion-button>
          </ion-card-content>
        </ion-card>

        <template v-if="currentStep === 'progress'">
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ translate("Track sync progress") }}</ion-card-title>
              <ion-card-subtitle>{{ translate("Monitor each step as products get imported from Shopify") }}</ion-card-subtitle>
            </ion-card-header>
            <ion-list lines="full">
              <ion-item v-for="step in progressSteps" :key="step.name">
                <ion-label>
                  {{ step.name }}
                  <p v-if="step.caption">{{ step.caption }}</p>
                </ion-label>
                <ion-badge slot="end" :color="step.color">{{ step.status }}</ion-badge>
              </ion-item>
            </ion-list>
          </ion-card>
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ translate("Bulk operation") }}</ion-card-title>
              <ion-card-subtitle>{{ translate("Status from the backend sync lifecycle") }}</ion-card-subtitle>
            </ion-card-header>
            <ion-progress-bar v-if="progressStatus === 'running'" type="indeterminate" />
            <ion-list lines="full">
              <ion-item>
                <ion-label>{{ translate("System message") }}</ion-label>
                <ion-note slot="end">{{ progressState.systemMessageState }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>{{ translate("Sync status") }}</ion-label>
                <ion-badge slot="end" :color="progressBadgeColor">{{ progressStatus }}</ion-badge>
              </ion-item>
              <ion-item>
                <ion-label>{{ translate("Bulk operation id") }}</ion-label>
                <ion-note slot="end">{{ progressState.bulkOperationId || translate("Not available") }}</ion-note>
              </ion-item>
              <ion-item>
                <ion-label>{{ translate("Queued jobs ahead") }}</ion-label>
                <ion-note slot="end">{{ progressState.queuedJobsAhead || 0 }}</ion-note>
              </ion-item>
            </ion-list>
            <ion-card-content>
              <ion-button expand="block" fill="outline" @click="loadProgress()">{{ translate("Refresh status") }}</ion-button>
              <ion-button expand="block" :disabled="!reconcileAvailable" @click="goNext()" data-testid="reconcile-sync">
                {{ translate("Reconcile product sync") }}
              </ion-button>
            </ion-card-content>
          </ion-card>
        </template>

        <ion-card v-if="currentStep === 'reconcile'">
          <ion-card-header>
            <ion-card-title>{{ translate("Product sync setup complete") }}</ion-card-title>
            <ion-card-subtitle>{{ translate("Shopify product sync now runs automatically every 15 minutes.") }}</ion-card-subtitle>
          </ion-card-header>
          <ion-list lines="full">
            <ion-item>
              <ion-label>{{ translate("Shopify products") }}</ion-label>
              <ion-note slot="end">{{ reviewStats.shopifyProductCount }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("HotWax products") }}</ion-label>
              <ion-note slot="end">{{ reviewStats.omsProductCount }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("Completion status") }}</ion-label>
              <ion-badge slot="end" color="success">{{ translate("Complete") }}</ion-badge>
            </ion-item>
          </ion-list>
        </ion-card>

        <ion-modal :is-open="showMistakeModal" @didDismiss="showMistakeModal = false">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ translate("Am I making a mistake?") }}</ion-title>
              <ion-buttons slot="end">
                <ion-button @click="showMistakeModal = false">{{ translate("Close") }}</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-card>
              <ion-card-header>
                <ion-card-title>{{ preflightTitle }}</ion-card-title>
                <ion-card-subtitle>{{ preflightSubtitle }}</ion-card-subtitle>
              </ion-card-header>
              <ion-list lines="full">
                <ion-item v-for="item in preflightResult.items" :key="item.label || item.id">
                  <ion-label>
                    {{ item.label || item.name || item.identifier }}
                    <p>{{ item.detail || item.identifier || item.status }}</p>
                  </ion-label>
                  <ion-badge slot="end" :color="getPreflightBadgeColor(item.status)">{{ item.status }}</ion-badge>
                </ion-item>
              </ion-list>
              <ion-item
                v-if="preflightRequiresConfirmation"
                lines="full"
                button
                @click="togglePreflightWarningConfirmation()"
              >
                <ion-checkbox
                  :checked="preflightWarningConfirmed"
                  label-placement="end"
                  data-testid="preflight-warning-confirmation"
                >
                  {{ translate("I reviewed the warning and want to continue.") }}
                </ion-checkbox>
              </ion-item>
              <ion-card-content v-if="preflightRequiresConfirmation">
                <ion-button expand="block" :disabled="!preflightWarningConfirmed" @click="acceptPreflightAndOpenStartSync()" data-testid="accept-preflight-warning">
                  {{ translate("Continue to import") }}
                </ion-button>
              </ion-card-content>
            </ion-card>
          </ion-content>
        </ion-modal>

        <ion-modal :is-open="showStartSyncModal" @didDismiss="showStartSyncModal = false">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ translate("Start product sync") }}</ion-title>
              <ion-buttons slot="end">
                <ion-button @click="showStartSyncModal = false">{{ translate("Close") }}</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-card>
              <ion-card-header>
                <ion-card-title>{{ translate("First product sync cannot be cancelled") }}</ion-card-title>
                <ion-card-subtitle>{{ translate("Incorrect Shopify store to Product Store mapping can corrupt catalog state.") }}</ion-card-subtitle>
              </ion-card-header>
              <ion-item lines="full" button @click="toggleStartConfirmation()">
                <ion-checkbox
                  :checked="draft.startConfirmed"
                  label-placement="end"
                  data-testid="start-sync-confirmation"
                >
                  {{ translate("I understand and want to start the first product sync.") }}
                </ion-checkbox>
              </ion-item>
              <ion-card-content>
                <ion-button expand="block" :disabled="startSyncDisabled || isSaving" @click="startProductSync()" data-testid="start-product-sync">
                  {{ translate("Start product sync") }}
                </ion-button>
              </ion-card-content>
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
  IonCardSubtitle,
  IonCardTitle,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  onIonViewWillEnter,
  IonPage,
  IonProgressBar,
  IonRadio,
  IonRadioGroup,
  IonSpinner,
  IonTitle,
  IonToolbar
} from "@ionic/vue";
import { translate } from "@/i18n";
import { computed, defineProps, onBeforeUnmount, ref, watch } from "vue";
import { useStore } from "vuex";
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
  ProductSyncWizardStep,
  requiresPreflightConfirmation,
  selectProductStore,
  shouldShowProductSyncProgress
} from "@/utils/shopifyProductSyncWizard";
import { hasError, showToast } from "@/utils";
import logger from "@/logger";

const props = defineProps(["id"]);
const store = useStore();
const isLoading = ref(true);
const isSaving = ref(false);
const isReviewLoading = ref(false);
const showMistakeModal = ref(false);
const showStartSyncModal = ref(false);
const preflightLoaded = ref(false);
const preflightAccepted = ref(false);
const preflightWarningConfirmed = ref(false);
const currentStep = ref<ProductSyncWizardStep>("home");
const draft = ref(createProductSyncWizardDraft());
const relatedShops = ref<any[]>([]);
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
const productIdentifiers = computed(() => store.getters["util/getProductIdentifiers"] || []);
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
const identifierOptions = computed(() => {
  if (productIdentifiers.value.length) {
    return productIdentifiers.value;
  }

  return [
    { enumId: "SHOPIFY_PRODUCT_SKU", description: "SKU" },
    { enumId: "SHOPIFY_PRODUCT_UPCA", description: "UPCA / Barcode" },
    { enumId: "SHOPIFY_PRODUCT_ID", description: "Shopify internal id" }
  ];
});
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

    await Promise.all([
      store.dispatch("productStore/fetchProductStores"),
      store.dispatch("util/fetchProductIdentifiers"),
      store.dispatch("shopify/fetchShopifyTypeMappings", "SHOPIFY_PRODUCT_TYPE")
    ]);

    if (shop.value.productStoreId) {
      await store.dispatch("productStore/fetchProductStoreDetails", shop.value.productStoreId);
    }

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

function getPreflightBadgeColor(status: string) {
  if (status === "matched") return "success";
  if (status === "missing" || status === "duplicate" || status === "conflicting" || status === "conflict") return "danger";
  return "warning";
}
</script>
