<template>
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

  <ion-button v-if="currentStep === 'home'" expand="block" @click="$emit('goNext')" data-testid="review-configurations">
    {{ translate("Review configurations") }}
  </ion-button>

  <ion-card v-if="currentStep === 'product-store'">
    <ion-card-header>
      <ion-card-title>{{ translate("Confirm product store") }}</ion-card-title>
      <ion-card-subtitle>{{ translate("Only Shopify stores with the same catalog should share a Product Store.")
        }}</ion-card-subtitle>
    </ion-card-header>
    <ion-list lines="full">
      <ion-radio-group :value="draft.selectedProductStoreId"
        @ionChange="$emit('productStoreChange', $event.detail.value)">
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
          <p>{{ relatedShop.shopId === shopId ? translate("New shop") : translate("Connected shop") }}</p>
        </ion-label>
        <ion-note slot="end">{{ relatedShop.createdDate || relatedShop.createdStamp || translate("Created date unavailable") }}</ion-note>
      </ion-item>
    </ion-list>
    <ion-item lines="full" button :disabled="!draft.selectedProductStoreId || productStoreLocked"
      @click="$emit('toggleProductStoreVerification')">
      <ion-checkbox :checked="draft.productStoreVerified"
        :disabled="!draft.selectedProductStoreId || productStoreLocked" data-testid="product-store-verification">
        {{ translate("I have verified that these Shopify stores are part of the selected Product Store.") }}
      </ion-checkbox>
    </ion-item>
    <ion-card-content>
      <ion-button expand="block" fill="clear" @click="$emit('goBack')">{{ translate("Back") }}</ion-button>
      <ion-button expand="block" :disabled="nextDisabled || isSaving" @click="$emit('goNext')"
        data-testid="product-store-next">
        {{ translate("Next") }}
      </ion-button>
    </ion-card-content>
  </ion-card>

  <ion-card v-if="currentStep === 'identifier'">
    <ion-card-header>
      <ion-card-title>{{ translate("Confirm internal name mapping") }}</ion-card-title>
      <ion-card-subtitle>{{ translate("The identifier controls how Shopify products match HotWax products.")
        }}</ion-card-subtitle>
    </ion-card-header>
    <ion-list v-if="identifierLocked" lines="full">
      <ion-item>
        <ion-label>
          {{ translate("This setting cannot be changed because this Product Store already has synced products.") }}
        </ion-label>
      </ion-item>
    </ion-list>
    <ion-list lines="full">
      <ion-radio-group :value="draft.selectedIdentifierEnumId"
        @ionChange="$emit('identifierChange', $event.detail.value)">
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
          <p>{{ relatedShop.shopId === shopId ? translate("New shop") : translate("Connected shop") }}</p>
        </ion-label>
      </ion-item>
    </ion-list>
    <ion-card-content>
      <ion-button fill="clear" @click="$emit('goBack')">{{ translate("Back") }}</ion-button>
      <ion-button expand="block" :disabled="nextDisabled || isSaving" @click="$emit('goNext')"
        data-testid="identifier-next">
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
      <ion-button fill="clear" @click="$emit('goBack')">{{ translate("Back") }}</ion-button>
      <ion-button expand="block" :disabled="nextDisabled" @click="$emit('goNext')" data-testid="finish-configuration">
        {{ translate("Finish configuration") }}
      </ion-button>
    </ion-card-content>
  </ion-card>

  <ion-card v-if="currentStep === 'review'">
    <ion-card-header>
      <ion-card-title>{{ translate("Review product import") }}</ion-card-title>
      <ion-card-subtitle>{{ translate("Compare Shopify and HotWax catalog state before starting the first import.")
        }}</ion-card-subtitle>
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
      <ion-button fill="clear" @click="$emit('goBack')">{{ translate("Back") }}</ion-button>
      <ion-button expand="block" fill="outline" :disabled="!reviewReady" @click="$emit('openMistakeModal')"
        data-testid="mistake-check">
        {{ translate("Am I making a mistake?") }}
      </ion-button>
      <ion-button expand="block" :disabled="!reviewReady" @click="$emit('openStartSyncModal')"
        data-testid="run-product-import">
        {{ translate("Run product import") }}
      </ion-button>
    </ion-card-content>
  </ion-card>

  <template v-if="currentStep === 'progress'">
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ translate("Track sync progress") }}</ion-card-title>
        <ion-card-subtitle>{{ translate("Monitor each step as products get imported from Shopify")
          }}</ion-card-subtitle>
      </ion-card-header>
      <ion-list lines="full">
        <template v-if="currentSyncRun && currentSyncRun.systemMessageId">
          <ion-item button detail @click="$emit('openStepDetails', { type: 'systemMessage', id: currentSyncRun.systemMessageId })">
            <ion-label>
              {{ translate("System message") }}
              <p>{{ currentSyncRun.systemMessageId }}</p>
            </ion-label>
            <ion-badge slot="end" :color="currentSyncRun.statusColor">{{ currentSyncRun.status }}</ion-badge>
          </ion-item>
          <ion-item button detail @click="$emit('openStepDetails', { type: 'bulkOperation', id: currentSyncRun.bulkOperation.id })" :disabled="!currentSyncRun.bulkOperation?.id">
            <ion-label>
              {{ translate("Shopify bulk operation") }}
              <p>{{ currentSyncRun.bulkOperation?.id || translate("Not started") }}</p>
            </ion-label>
            <ion-note slot="end" v-if="currentSyncRun.bulkOperation?.objectCount">
              {{ currentSyncRun.bulkOperation.objectCount }} {{ translate("objects") }}
            </ion-note>
            <ion-badge slot="end" :color="currentSyncRun.bulkOperation?.statusColor || 'medium'">{{ currentSyncRun.bulkOperation?.statusLabel || translate("Pending") }}</ion-badge>
          </ion-item>
          <ion-item button detail @click="$emit('openStepDetails', { type: 'mdmLog', id: currentSyncRun.mdmLog.id })" :disabled="!currentSyncRun.mdmLog?.id">
            <ion-label>
              {{ translate("HotWax bulk import") }}
              <p>{{ currentSyncRun.mdmLog?.id || translate("Not started") }}</p>
            </ion-label>
            <ion-note slot="end" v-if="currentSyncRun.mdmLog?.totalRecordCount">
              {{ currentSyncRun.mdmLog.totalRecordCount }} {{ translate("records") }}
            </ion-note>
            <ion-badge slot="end" :color="currentSyncRun.mdmLog?.statusColor || 'medium'">{{ currentSyncRun.mdmLog?.statusLabel || translate("Pending") }}</ion-badge>
          </ion-item>
        </template>
        <ion-item v-else>
          <ion-label>{{ translate("Syncing...") }}</ion-label>
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
        <ion-button expand="block" fill="outline" @click="$emit('loadProgress')">{{ translate("Refresh status")
          }}</ion-button>
        <ion-button expand="block" :disabled="!reconcileAvailable" @click="$emit('goNext')"
          data-testid="reconcile-sync">
          {{ translate("Reconcile product sync") }}
        </ion-button>
      </ion-card-content>
    </ion-card>
  </template>

  <ion-card v-if="currentStep === 'reconcile'">
    <ion-card-header>
      <ion-card-title>{{ translate("Product sync setup complete") }}</ion-card-title>
      <ion-card-subtitle>{{ translate("Shopify product sync now runs automatically every 15 minutes.")
        }}</ion-card-subtitle>
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

  <ion-modal :is-open="showMistakeModal" @didDismiss="$emit('closeMistakeModal')">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Am I making a mistake?") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('closeMistakeModal')">{{ translate("Close") }}</ion-button>
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
        <ion-item v-if="preflightRequiresConfirmation" lines="full" button
          @click="$emit('togglePreflightWarningConfirmation')">
          <ion-checkbox :checked="preflightWarningConfirmed" label-placement="end"
            data-testid="preflight-warning-confirmation">
            {{ translate("I reviewed the warning and want to continue.") }}
          </ion-checkbox>
        </ion-item>
        <ion-card-content v-if="preflightRequiresConfirmation">
          <ion-button expand="block" :disabled="!preflightWarningConfirmed"
            @click="$emit('acceptPreflightAndOpenStartSync')" data-testid="accept-preflight-warning">
            {{ translate("Continue to import") }}
          </ion-button>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-modal>

  <ion-modal :is-open="showStartSyncModal" @didDismiss="$emit('closeStartSyncModal')">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Start product sync") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('closeStartSyncModal')">{{ translate("Close") }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ translate("First product sync cannot be cancelled") }}</ion-card-title>
          <ion-card-subtitle>{{ translate("Incorrect Shopify store to Product Store mapping can corrupt catalog state.")
            }}</ion-card-subtitle>
        </ion-card-header>
        <ion-item lines="full" button @click="$emit('toggleStartConfirmation')">
          <ion-checkbox :checked="draft.startConfirmed" label-placement="end" data-testid="start-sync-confirmation">
            {{ translate("I understand and want to start the first product sync.") }}
          </ion-checkbox>
        </ion-item>
        <ion-card-content>
          <ion-button expand="block" :disabled="startSyncDisabled || isSaving" @click="$emit('startProductSync')"
            data-testid="start-product-sync">
            {{ translate("Start product sync") }}
          </ion-button>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import type { ShopifyProductSyncRun } from "@/services/ShopifyProductSyncService";
import {
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
  IonProgressBar,
  IonRadio,
  IonRadioGroup,
  IonSpinner,
  IonTitle,
  IonToolbar
} from "@ionic/vue";
import { translate } from "@/i18n";
import { defineEmits, defineProps } from "vue";

defineProps<{
  currentStep: string
  draft: any
  getConnectedShopLabel: (productStoreId: string) => string
  getProductStoreName: (productStore: any) => string
  hasRelatedShops: boolean
  identifierLocked: boolean
  identifierOptions: any[]
  importStatusBadgeColor: string
  importStatusLabel: string
  isReviewLoading: boolean
  isSaving: boolean
  nextDisabled: boolean
  preflightRequiresConfirmation: boolean
  preflightResult: any
  preflightSubtitle: string
  preflightTitle: string
  preflightWarningConfirmed: boolean
  productStoreLocked: boolean
  productStores: any[]
  productTypeMappings: any[]
  productTypeMappingsLabel: string
  progressBadgeColor: string
  progressState: any
  progressStatus: string
  currentSyncRun?: ShopifyProductSyncRun
  reconcileAvailable: boolean
  recommendedIdentifierEnumId: string
  relatedShops: any[]
  reviewReady: boolean
  reviewStats: any
  selectedIdentifierLabel: string
  selectedProductStoreName: string
  shopId: string
  showMistakeModal: boolean
  showStartSyncModal: boolean
  startSyncDisabled: boolean
}>();

defineEmits([
  "acceptPreflightAndOpenStartSync",
  "closeMistakeModal",
  "closeStartSyncModal",
  "goBack",
  "goNext",
  "identifierChange",
  "loadProgress",
  "openMistakeModal",
  "openStartSyncModal",
  "openStepDetails",
  "productStoreChange",
  "startProductSync",
  "togglePreflightWarningConfirmation",
  "toggleProductStoreVerification",
  "toggleStartConfirmation"
]);

function getPreflightBadgeColor(status: string) {
  if (status === "matched") return "success";
  if (status === "missing" || status === "duplicate" || status === "conflicting" || status === "conflict") return "danger";
  return "warning";
}
</script>
