<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="'/shopify-connection-details/' + id" />
        </ion-buttons>
        <ion-title>{{ translate("New product sync upgrade") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-card v-if="isLoading">
        <ion-card-header>
          <ion-card-title>{{ translate("Loading upgrade assistant") }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-spinner name="crescent" />
        </ion-card-content>
      </ion-card>

      <ion-card v-else-if="loadErrorMessage">
        <ion-card-header>
          <ion-card-title>{{ translate("Upgrade assistant could not load") }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>{{ loadErrorMessage }}</p>
          <ion-button fill="outline" @click="loadAssistant">{{ translate("Retry") }}</ion-button>
        </ion-card-content>
      </ion-card>

      <template v-else>
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ assistantTitle }}</ion-card-title>
            <ion-card-subtitle>{{ assistantSubtitle }}</ion-card-subtitle>
          </ion-card-header>
          <ion-list lines="full">
            <ion-item>
              <ion-label>
                {{ translate("Backend release") }}
                <p>{{ backendReleaseDetail }}</p>
              </ion-label>
              <ion-badge slot="end" :color="eligibilityBadgeColor">{{ eligibilityBadgeLabel }}</ion-badge>
            </ion-item>
            <ion-item>
              <ion-label>
                {{ translate("New product sync messages") }}
                <p>{{ newSyncMessagesDetail }}</p>
              </ion-label>
              <ion-badge slot="end" :color="newSyncMessagesBadgeColor">{{ newSyncMessagesBadgeLabel }}</ion-badge>
            </ion-item>
            <ion-item lines="none">
              <ion-label>
                {{ translate("Per-shop sync job") }}
                <p>{{ perShopSyncJobDetail }}</p>
              </ion-label>
              <ion-badge slot="end" :color="syncJobBadgeColor">{{ syncJobBadgeLabel }}</ion-badge>
            </ion-item>
          </ion-list>
          <ion-card-content>
            <ion-button v-if="entryAction === 'current'" expand="block" @click="openProductSync">{{ translate("Open current product sync") }}</ion-button>
            <ion-button v-else-if="entryAction === 'setup'" expand="block" @click="openProductSync">{{ translate("Continue to setup new product sync") }}</ion-button>
            <ion-button v-else expand="block" fill="outline" @click="openConnectionDetails">{{ translate("Back to shop details") }}</ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ translate("1. Confirm readiness") }}</ion-card-title>
            <ion-card-subtitle>{{ translate("Verify the compatible backend release and the shared new-sync jobs before teardown starts.") }}</ion-card-subtitle>
          </ion-card-header>
          <ion-list lines="full">
            <ion-item v-for="artifactCheck in assistantState.artifactChecks" :key="artifactCheck.id">
              <ion-label>
                {{ translate(artifactCheck.label) }}
                <p>{{ artifactCheck.id }}</p>
                <p>{{ translate(artifactCheck.note) }}</p>
              </ion-label>
              <ion-badge slot="end" :color="artifactCheck.status === 'verified' ? 'success' : 'warning'">
                {{ artifactCheck.status === "verified" ? translate("Verified") : translate("Missing") }}
              </ion-badge>
            </ion-item>
            <ion-item>
              <ion-label>
                {{ translate("Expected new message type") }}
                <p>{{ migrationConfig.incoming.systemMessageTypes.productSync }}</p>
                <p>{{ translate("This should exist before the new product sync is used for this shop.") }}</p>
              </ion-label>
              <ion-badge slot="end" color="medium">{{ translate("Documented") }}</ion-badge>
            </ion-item>
            <ion-item lines="none">
              <ion-label>
                {{ translate("Data manager config") }}
                <p>{{ migrationConfig.incoming.dataManagerConfig }}</p>
                <p>{{ translate("This is expected during the new setup flow and should be verified before the first import runs.") }}</p>
              </ion-label>
              <ion-badge slot="end" color="medium">{{ translate("Setup flow") }}</ion-badge>
            </ion-item>
          </ion-list>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ translate("2. Deactivate the legacy sync") }}</ion-card-title>
            <ion-card-subtitle>{{ translate("Deprecate the old sync in place so historical records remain intact while the old jobs stop doing work.") }}</ion-card-subtitle>
          </ion-card-header>
          <ion-list lines="full">
            <ion-item>
              <ion-label>
                {{ translate("Legacy system message types") }}
                <p>{{ legacySystemMessageTypesDetail }}</p>
                <p>{{ translate("Rename them with a Deprecated label and clear bound services so they cannot accidentally run again.") }}</p>
              </ion-label>
              <ion-note slot="end">{{ legacySystemMessageTypesCount }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>
                {{ translate("Legacy service jobs") }}
                <p>{{ legacyServiceJobsDetail }}</p>
                <p>{{ translate("Delete product-sync-only jobs when safe, otherwise rename and clear execution fields so accidental runs become a no-op.") }}</p>
              </ion-label>
              <ion-note slot="end">{{ legacyServiceJobsCount }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>
                {{ translate("Legacy enumerations") }}
                <p>{{ legacyEnumerationsDetail }}</p>
                <p>{{ translate("Remove only the old enum records that are no longer needed by the new sync path.") }}</p>
              </ion-label>
              <ion-note slot="end">{{ legacyEnumerationsCount }}</ion-note>
            </ion-item>
            <ion-item lines="none">
              <ion-label>
                {{ translate("Legacy system messages") }}
                <p>{{ translate("Cancel old typed system messages unless they are already in the terminal confirmed state.") }}</p>
              </ion-label>
              <ion-badge slot="end" color="warning">{{ translate("Review") }}</ion-badge>
            </ion-item>
          </ion-list>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ translate("3. Setup the new sync") }}</ion-card-title>
            <ion-card-subtitle>{{ translate("Once readiness checks pass and the old sync is deactivated, continue to the current product-sync setup flow.") }}</ion-card-subtitle>
          </ion-card-header>
          <ion-list lines="full">
            <ion-item>
              <ion-label>
                {{ translate("Per-shop sync job pattern") }}
                <p>{{ perShopPatternLabel }}</p>
                <p>{{ translate("The app will configure or verify the shop-specific job from the shared sync template.") }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                {{ translate("Webhook topic") }}
                <p>{{ migrationConfig.incoming.webhookTopic }}</p>
                <p>{{ translate("The shop should be subscribed to bulk operation updates before relying on the new sync flow.") }}</p>
              </ion-label>
            </ion-item>
            <ion-item lines="none">
              <ion-label>
                {{ translate("Next step") }}
                <p>{{ nextStepDetail }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
          <ion-card-content>
            <ion-button v-if="entryAction !== 'request-upgrade'" expand="block" @click="openProductSync">{{ entryAction === "current" ? translate("Open current product sync") : translate("Go to new product sync setup") }}</ion-button>
          </ion-card-content>
        </ion-card>
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
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  onIonViewWillEnter
} from "@ionic/vue";
import { computed, defineProps, ref } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import { translate } from "@/i18n";
import { PRODUCT_SYNC_MIGRATION_CONFIG } from "@/config/productSyncMigration";
import {
  type ProductSyncMigrationAssistantState,
  type ProductSyncMigrationEntryAction,
  ShopifyProductSyncMigrationService
} from "@/services/ShopifyProductSyncMigrationService";

const props = defineProps(["id"]);
const router = useRouter();
const store = useStore();
const migrationConfig = PRODUCT_SYNC_MIGRATION_CONFIG;
const isLoading = ref(true);
const loadErrorMessage = ref("");
const assistantState = ref<ProductSyncMigrationAssistantState>({
  componentRelease: "",
  minimumComponentRelease: migrationConfig.minimumComponentRelease,
  isEligible: false,
  hasNewProductSyncMessages: false,
  systemMessageRemoteId: "",
  syncJobConfigured: false,
  syncJobName: "",
  artifactChecks: []
});

const shop = computed(() => store.getters["shopify/getShopById"](props.id) || {});
const entryAction = computed<ProductSyncMigrationEntryAction>(() => {
  return ShopifyProductSyncMigrationService.resolveEntryAction(assistantState.value);
});
const assistantTitle = computed(() => {
  if (entryAction.value === "current") {
    return translate("New product sync is already active");
  }

  if (entryAction.value === "setup") {
    return translate("This shop can move to the new product sync");
  }

  return translate("This shop is not yet eligible for the new product sync");
});
const assistantSubtitle = computed(() => {
  return shop.value.name || props.id;
});
const backendReleaseDetail = computed(() => {
  if (assistantState.value.componentRelease) {
    return translate("Current backend release: {release}", { release: assistantState.value.componentRelease });
  }

  return translate("The backend release could not be read from Maarg.");
});
const eligibilityBadgeLabel = computed(() => {
  return assistantState.value.isEligible ? translate("Eligible") : translate("Upgrade required");
});
const eligibilityBadgeColor = computed(() => {
  return assistantState.value.isEligible ? "success" : "warning";
});
const newSyncMessagesDetail = computed(() => {
  if (assistantState.value.hasNewProductSyncMessages) {
    return translate("This shop already has new product sync messages in the database.");
  }

  return translate("No new product sync messages were found for this shop yet.");
});
const newSyncMessagesBadgeLabel = computed(() => {
  return assistantState.value.hasNewProductSyncMessages ? translate("Active") : translate("Not started");
});
const newSyncMessagesBadgeColor = computed(() => {
  return assistantState.value.hasNewProductSyncMessages ? "success" : "medium";
});
const perShopSyncJobDetail = computed(() => {
  if (assistantState.value.syncJobConfigured && assistantState.value.syncJobName) {
    return assistantState.value.syncJobName;
  }

  return translate("No per-shop sync job is configured yet.");
});
const syncJobBadgeLabel = computed(() => {
  return assistantState.value.syncJobConfigured ? translate("Configured") : translate("Not configured");
});
const syncJobBadgeColor = computed(() => {
  return assistantState.value.syncJobConfigured ? "success" : "medium";
});
const legacySystemMessageTypesCount = computed(() => {
  return migrationConfig.outgoing.systemMessageTypes.length;
});
const legacySystemMessageTypesDetail = computed(() => {
  return migrationConfig.outgoing.systemMessageTypes.join(", ");
});
const legacyServiceJobsCount = computed(() => {
  return migrationConfig.outgoing.serviceJobs.length;
});
const legacyServiceJobsDetail = computed(() => {
  return migrationConfig.outgoing.serviceJobs.join(", ");
});
const legacyEnumerationsCount = computed(() => {
  return migrationConfig.outgoing.enumerations.length;
});
const legacyEnumerationsDetail = computed(() => {
  return migrationConfig.outgoing.enumerations.join(", ");
});
const perShopPatternLabel = computed(() => {
  return migrationConfig.incoming.serviceJobs.perShopPattern;
});
const nextStepDetail = computed(() => {
  if (entryAction.value === "current") {
    return translate("The new sync is already active, so continue on the current product sync page.");
  }

  if (entryAction.value === "setup") {
    return translate("Complete the readiness review, deactivate the old sync, and then continue to the new product sync setup flow.");
  }

  return translate("Request the backend upgrade first, then return here to complete readiness review and setup.");
});

onIonViewWillEnter(async () => {
  await loadAssistant();
});

async function loadAssistant() {
  isLoading.value = true;
  loadErrorMessage.value = "";

  try {
    if (!shop.value.shopId) {
      await store.dispatch("shopify/fetchShopifyShops");
    }

    assistantState.value = await ShopifyProductSyncMigrationService.fetchAssistantState({
      id: props.id,
      shopId: props.id,
      shopifyShopId: props.id,
      shop: shop.value
    });
  } catch (error: any) {
    loadErrorMessage.value = error?.message || translate("Failed to load the product sync upgrade assistant.");
  }

  isLoading.value = false;
}

function openProductSync() {
  router.push(`/shopify-connection-details/${props.id}/product-sync`);
}

function openConnectionDetails() {
  router.push(`/shopify-connection-details/${props.id}`);
}
</script>
