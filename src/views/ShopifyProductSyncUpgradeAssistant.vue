<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="'/shopify-connection-details/' + id" />
        </ion-buttons>
        <ion-title>New product sync upgrade</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-card v-if="isLoading">
          <ion-card-header>
            <ion-card-title>Loading upgrade assistant</ion-card-title>
          </ion-card-header>
        <ion-card-content>
          <ion-spinner name="crescent" />
        </ion-card-content>
      </ion-card>

      <ion-card v-else-if="loadErrorMessage">
          <ion-card-header>
            <ion-card-title>Upgrade assistant could not load</ion-card-title>
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
                Backend release
                <p>{{ backendReleaseDetail }}</p>
              </ion-label>
              <ion-badge slot="end" :color="eligibilityBadgeColor">{{ eligibilityBadgeLabel }}</ion-badge>
            </ion-item>
            <ion-item>
              <ion-label>
                New product sync messages
                <p>{{ newSyncMessagesDetail }}</p>
              </ion-label>
              <ion-badge slot="end" :color="newSyncMessagesBadgeColor">{{ newSyncMessagesBadgeLabel }}</ion-badge>
            </ion-item>
            <ion-item lines="none">
              <ion-label>
                Per-shop sync job
                <p>{{ perShopSyncJobDetail }}</p>
              </ion-label>
              <ion-badge slot="end" :color="syncJobBadgeColor">{{ syncJobBadgeLabel }}</ion-badge>
            </ion-item>
          </ion-list>
          <ion-card-content>
            <ion-button v-if="entryAction === 'current'" expand="block" @click="openProductSync">Open current product sync</ion-button>
            <ion-button v-else-if="entryAction === 'setup'" expand="block" @click="openProductSync">Continue to setup new product sync</ion-button>
            <ion-button v-else expand="block" fill="outline" @click="openConnectionDetails">Back to shop details</ion-button>
            <ion-button expand="block" fill="clear" @click="loadAssistant">Refresh checks</ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>1. Confirm readiness</ion-card-title>
            <ion-card-subtitle>Verify the compatible backend release and the shared new-sync jobs before teardown starts.</ion-card-subtitle>
          </ion-card-header>
          <ion-list lines="full">
            <ion-item v-for="artifactCheck in assistantState.artifactChecks" :key="artifactCheck.id">
              <ion-label>
                {{ artifactCheck.label }}
                <p>{{ artifactCheck.id }}</p>
                <p>{{ artifactCheck.note }}</p>
              </ion-label>
              <ion-badge slot="end" :color="artifactCheck.status === 'verified' ? 'success' : 'warning'">
                {{ artifactCheck.status === "verified" ? "Verified" : "Missing" }}
              </ion-badge>
            </ion-item>
          </ion-list>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>2. Deactivate the legacy sync</ion-card-title>
            <ion-card-subtitle>Use the same Moqui APIs as Job Manager to cancel unfinished legacy messages, pause legacy jobs, and deprecate legacy message types in place.</ion-card-subtitle>
          </ion-card-header>
          <ion-list lines="full">
            <ion-item>
              <ion-label>
                Legacy system message types
                <p>{{ legacySystemMessageTypesSummary }}</p>
                <p>These types are deprecated in place by clearing their bound services and paths.</p>
              </ion-label>
              <ion-note slot="end">{{ legacySystemMessageTypesCount }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>
                Legacy service jobs
                <p>{{ legacyServiceJobsSummary }}</p>
                <p>These jobs are paused and their service name is replaced with a no-op marker so accidental runs do nothing.</p>
              </ion-label>
              <ion-note slot="end">{{ legacyServiceJobsCount }}</ion-note>
            </ion-item>
            <ion-item lines="none">
              <ion-label>
                Legacy system messages
                <p>{{ legacySystemMessagesSummary }}</p>
                <p>Only non-terminal legacy messages are cancelled. Confirmed or consumed history is left intact.</p>
              </ion-label>
              <ion-note slot="end">{{ legacySystemMessagesCount }}</ion-note>
            </ion-item>
          </ion-list>
          <ion-card-content>
            <p>{{ teardownStepDetail }}</p>
            <p v-if="teardownErrorMessage" class="ion-color-danger">{{ teardownErrorMessage }}</p>
            <p v-else-if="teardownSuccessMessage">{{ teardownSuccessMessage }}</p>
            <ion-button
              expand="block"
              :disabled="isTeardownRunning || !canRunTeardown"
              @click="confirmLegacyTeardown"
            >
              <ion-spinner v-if="isTeardownRunning" name="crescent" slot="start" />
              {{ teardownActionLabel }}
            </ion-button>
            <ion-button expand="block" fill="outline" :disabled="isTeardownRunning" @click="loadAssistant">Refresh legacy checks</ion-button>
          </ion-card-content>
          <!-- Live teardown activity log -->
          <ion-list v-if="teardownLog.length" lines="full">
            <ion-list-header>Teardown activity</ion-list-header>
            <ion-item v-for="step in teardownLog" :key="`log-${step.kind}-${step.id}`">
              <ion-label>
                {{ step.label }}
                <p v-if="step.error">{{ step.error }}</p>
              </ion-label>
              <ion-spinner v-if="step.status === 'processing'" name="crescent" slot="end" />
              <ion-badge v-else slot="end" :color="getTeardownStepColor(step.status)">
                {{ getTeardownStepLabel(step.status) }}
              </ion-badge>
            </ion-item>
          </ion-list>

          <!-- Failure summary after teardown -->
          <ion-list v-if="teardownFailedSteps.length && !isTeardownRunning" lines="full">
            <ion-list-header>Steps that could not complete</ion-list-header>
            <ion-item v-for="step in teardownFailedSteps" :key="`fail-${step.kind}-${step.id}`">
              <ion-label color="danger">
                {{ step.label }}
                <p>{{ step.error }}</p>
              </ion-label>
              <ion-badge slot="end" color="danger">Failed</ion-badge>
            </ion-item>
          </ion-list>

          <ion-list v-if="assistantState.legacySystemMessageTypes.length || assistantState.legacyServiceJobs.length || assistantState.legacySystemMessages.length" lines="full">
            <ion-list-header>Legacy types</ion-list-header>
            <ion-item v-for="item in assistantState.legacySystemMessageTypes" :key="`type-${item.id}`">
              <ion-label>
                {{ item.label }}
                <p>{{ item.note }}</p>
              </ion-label>
              <ion-badge slot="end" :color="getLegacyItemColor(item.status)">{{ getLegacyItemLabel(item.status) }}</ion-badge>
            </ion-item>
            <ion-list-header>Legacy jobs</ion-list-header>
            <ion-item v-for="item in assistantState.legacyServiceJobs" :key="`job-${item.id}`">
              <ion-label>
                {{ item.label }}
                <p>{{ item.note }}</p>
              </ion-label>
              <ion-badge slot="end" :color="getLegacyItemColor(item.status)">{{ getLegacyItemLabel(item.status) }}</ion-badge>
            </ion-item>
            <ion-list-header>Legacy messages</ion-list-header>
            <ion-item v-for="item in legacySystemMessagesPreview" :key="`message-${item.id}`">
              <ion-label>
                {{ item.label }}
                <p>{{ item.id }}</p>
                <p>{{ item.note }}</p>
              </ion-label>
              <ion-badge slot="end" :color="getLegacyItemColor(item.status)">{{ getLegacyItemLabel(item.status) }}</ion-badge>
            </ion-item>
            <ion-item v-if="remainingLegacySystemMessageCount > 0" lines="none">
              <ion-label>
                Additional legacy messages
                <p>{{ remainingLegacySystemMessageCount }} more legacy messages were found for this shop.</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-card-title>3. Setup the new sync</ion-card-title>
            <ion-card-subtitle>Once readiness checks pass and the old sync is deactivated, continue to the current product-sync setup flow.</ion-card-subtitle>
          </ion-card-header>
          <ion-list lines="full">
            <ion-item>
              <ion-label>
                Per-shop sync job pattern
                <p>{{ perShopPatternLabel }}</p>
                <p>The app will configure or verify the shop-specific job from the shared sync template.</p>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                Webhook topic
                <p>{{ migrationConfig.incoming.webhookTopic }}</p>
                <p>The shop should be subscribed to bulk operation updates before relying on the new sync flow.</p>
              </ion-label>
            </ion-item>
            <ion-item lines="none">
              <ion-label>
                Next step
                <p>{{ nextStepDetail }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
          <ion-card-content>
            <ion-button v-if="entryAction !== 'request-upgrade'" expand="block" @click="openProductSync">{{ entryAction === "current" ? "Open current product sync" : "Go to new product sync setup" }}</ion-button>
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
  IonListHeader,
  IonNote,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  alertController,
  onIonViewWillEnter
} from "@ionic/vue";
import { computed, defineProps, ref } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import { translate } from "@/i18n";
import { PRODUCT_SYNC_MIGRATION_CONFIG } from "@/config/productSyncMigration";
import {
  type ProductSyncMigrationAssistantState,
  type ProductSyncMigrationLegacyItem,
  type ProductSyncMigrationTeardownStep,
  type ProductSyncMigrationEntryAction,
  ShopifyProductSyncMigrationService
} from "@/services/ShopifyProductSyncMigrationService";
import { showToast } from "@/utils";

const props = defineProps(["id"]);
const router = useRouter();
const store = useStore();
const migrationConfig = PRODUCT_SYNC_MIGRATION_CONFIG;
const isLoading = ref(true);
const loadErrorMessage = ref("");
const isTeardownRunning = ref(false);
const teardownErrorMessage = ref("");
const teardownSuccessMessage = ref("");
const teardownLog = ref<ProductSyncMigrationTeardownStep[]>([]);
const teardownFailedSteps = ref<ProductSyncMigrationTeardownStep[]>([]);
const assistantState = ref<ProductSyncMigrationAssistantState>({
  componentRelease: "",
  minimumComponentRelease: migrationConfig.minimumComponentRelease,
  isEligible: false,
  hasNewProductSyncMessages: false,
  systemMessageRemoteId: "",
  legacySystemMessageRemoteIds: [],
  legacySystemMessagesTotalCount: 0,
  syncJobConfigured: false,
  syncJobName: "",
  artifactChecks: [],
  legacySystemMessageTypes: [],
  legacyServiceJobs: [],
  legacySystemMessages: []
});

const shop = computed(() => store.getters["shopify/getShopById"](props.id) || {});
const entryAction = computed<ProductSyncMigrationEntryAction>(() => {
  return ShopifyProductSyncMigrationService.resolveEntryAction(assistantState.value);
});
const assistantTitle = computed(() => {
  if (entryAction.value === "current") {
    return "New product sync is already active";
  }

  if (entryAction.value === "setup") {
    return "This shop can move to the new product sync";
  }

  return "This shop is not yet eligible for the new product sync";
});
const assistantSubtitle = computed(() => {
  return shop.value.name || props.id;
});
const backendReleaseDetail = computed(() => {
  if (assistantState.value.componentRelease) {
    return `Current backend release: ${assistantState.value.componentRelease}`;
  }

  return "The backend release could not be read from Maarg.";
});
const eligibilityBadgeLabel = computed(() => {
  return assistantState.value.isEligible ? "Eligible" : "Upgrade required";
});
const eligibilityBadgeColor = computed(() => {
  return assistantState.value.isEligible ? "success" : "warning";
});
const newSyncMessagesDetail = computed(() => {
  if (assistantState.value.hasNewProductSyncMessages) {
    return "This shop already has new product sync messages in the database.";
  }

  return "No new product sync messages were found for this shop yet.";
});
const newSyncMessagesBadgeLabel = computed(() => {
  return assistantState.value.hasNewProductSyncMessages ? "Active" : "Not started";
});
const newSyncMessagesBadgeColor = computed(() => {
  return assistantState.value.hasNewProductSyncMessages ? "success" : "medium";
});
const perShopSyncJobDetail = computed(() => {
  if (assistantState.value.syncJobConfigured && assistantState.value.syncJobName) {
    return assistantState.value.syncJobName;
  }

  return "No per-shop sync job is configured yet.";
});
const syncJobBadgeLabel = computed(() => {
  return assistantState.value.syncJobConfigured ? "Configured" : "Not configured";
});
const syncJobBadgeColor = computed(() => {
  return assistantState.value.syncJobConfigured ? "success" : "medium";
});
const legacySystemMessageTypesCount = computed(() => {
  return assistantState.value.legacySystemMessageTypes.length;
});
const legacySystemMessageTypesSummary = computed(() => {
  const activeCount = assistantState.value.legacySystemMessageTypes.filter((item) => item.status === "active").length;
  const deprecatedCount = assistantState.value.legacySystemMessageTypes.filter((item) => item.status === "deprecated").length;
  return `${activeCount} still active, ${deprecatedCount} already deprecated.`;
});
const legacyServiceJobsCount = computed(() => {
  return assistantState.value.legacyServiceJobs.length;
});
const legacyServiceJobsSummary = computed(() => {
  const activeCount = assistantState.value.legacyServiceJobs.filter((item) => item.status === "active").length;
  const deactivatedCount = assistantState.value.legacyServiceJobs.filter((item) => item.status === "deactivated").length;
  return `${activeCount} still active, ${deactivatedCount} already deactivated.`;
});
const legacySystemMessagesCount = computed(() => {
  return assistantState.value.legacySystemMessagesTotalCount;
});
const legacySystemMessagesSummary = computed(() => {
  if (!assistantState.value.legacySystemMessagesTotalCount) {
    return "No legacy system messages were found for this shop.";
  }

  return `Showing ${assistantState.value.legacySystemMessages.length} legacy product-sync messages that exactly match the configured product-sync type IDs.`;
});
const perShopPatternLabel = computed(() => {
  return migrationConfig.incoming.serviceJobs.perShopPattern;
});
const nextStepDetail = computed(() => {
  if (entryAction.value === "current") {
    return "The new sync is already active, so continue on the current product sync page.";
  }

  if (entryAction.value === "setup") {
    return "Complete the readiness review, deactivate the old sync, and then continue to the new product sync setup flow.";
  }

  return "Request the backend upgrade first, then return here to complete readiness review and setup.";
});
const canRunTeardown = computed(() => {
  return assistantState.value.legacySystemMessageTypes.some((item) => item.status === "active") ||
    assistantState.value.legacyServiceJobs.some((item) => item.status === "active") ||
    assistantState.value.legacySystemMessages.some((item) => item.status === "active");
});
const teardownActionLabel = computed(() => {
  if (isTeardownRunning.value) {
    return "Deactivating legacy sync";
  }

  return canRunTeardown.value ? "Deactivate legacy sync" : "Legacy sync already deactivated";
});
const teardownStepDetail = computed(() => {
  if (canRunTeardown.value) {
    return "Review the legacy artifacts found for this shop, then deactivate the old sync in one guided step.";
  }

  return "No active legacy sync artifacts were found for this shop.";
});
const legacySystemMessagesPreview = computed(() => {
  return assistantState.value.legacySystemMessages.slice(0, 5);
});
const remainingLegacySystemMessageCount = computed(() => {
  return Math.max(assistantState.value.legacySystemMessages.length - legacySystemMessagesPreview.value.length, 0);
});

onIonViewWillEnter(async () => {
  await loadAssistant();
});

async function loadAssistant() {
  isLoading.value = true;
  loadErrorMessage.value = "";
  teardownErrorMessage.value = "";
  teardownSuccessMessage.value = "";
  teardownLog.value = [];
  teardownFailedSteps.value = [];

  try {
    if (!shop.value.shopId) {
      await store.dispatch("shopify/fetchShopifyShops");
    }

    const currentShop = store.getters["shopify/getShopById"](props.id) || {};

    assistantState.value = await ShopifyProductSyncMigrationService.fetchAssistantState({
      shopId: props.id,
      shop: currentShop
    });
  } catch (error: any) {
    loadErrorMessage.value = error?.message || "Failed to load the product sync upgrade assistant.";
  }

  isLoading.value = false;
}

function openProductSync() {
  router.push(`/shopify-connection-details/${props.id}/product-sync`);
}

function openConnectionDetails() {
  router.push(`/shopify-connection-details/${props.id}`);
}

function getLegacyItemLabel(status: ProductSyncMigrationLegacyItem["status"]) {
  switch (status) {
    case "active":
      return "Active";
    case "deprecated":
      return "Deprecated";
    case "deactivated":
      return "Deactivated";
    case "cancelled":
      return "Cancelled";
    case "terminal":
      return "Terminal";
    case "missing":
      return "Missing";
    default:
      return "Failed";
  }
}

function getLegacyItemColor(status: ProductSyncMigrationLegacyItem["status"]) {
  switch (status) {
    case "active":
      return "warning";
    case "deprecated":
    case "deactivated":
    case "cancelled":
    case "terminal":
      return "success";
    case "missing":
      return "medium";
    default:
      return "danger";
  }
}

function getTeardownStepLabel(status: ProductSyncMigrationTeardownStep["status"]) {
  switch (status) {
    case "processing":
      return "In progress";
    case "done":
      return "Done";
    case "skipped":
      return "Skipped";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
}

function getTeardownStepColor(status: ProductSyncMigrationTeardownStep["status"]) {
  switch (status) {
    case "done":
      return "success";
    case "skipped":
      return "medium";
    case "failed":
      return "danger";
    default:
      return "primary";
  }
}

async function confirmLegacyTeardown() {
  if (!canRunTeardown.value || isTeardownRunning.value) {
    return;
  }

  const alert = await alertController.create({
    header: "Deactivate legacy sync?",
    message: "This will cancel unfinished legacy system messages, pause legacy jobs, and deprecate legacy message types for this shop.",
    buttons: [
      {
        text: "Keep legacy sync",
        role: "cancel"
      },
      {
        text: "Deactivate",
        handler: async () => {
          await teardownLegacySync();
        }
      }
    ]
  });

  await alert.present();
}

async function teardownLegacySync() {
  isTeardownRunning.value = true;
  teardownErrorMessage.value = "";
  teardownSuccessMessage.value = "";
  teardownLog.value = [];
  teardownFailedSteps.value = [];

  try {
    const currentShop = store.getters["shopify/getShopById"](props.id) || {};
    const result = await ShopifyProductSyncMigrationService.teardownLegacySync(
      { shopId: props.id, shop: currentShop },
      (step: ProductSyncMigrationTeardownStep) => {
        // Update or append this step in the log
        const existingIndex = teardownLog.value.findIndex(
          (s) => s.kind === step.kind && s.id === step.id
        );
        if (existingIndex >= 0) {
          teardownLog.value[existingIndex] = { ...step };
        } else {
          teardownLog.value.push({ ...step });
        }
      }
    );

    assistantState.value = {
      ...assistantState.value,
      legacySystemMessageTypes: result.legacySystemMessageTypes,
      legacyServiceJobs: result.legacyServiceJobs,
      legacySystemMessages: result.legacySystemMessages,
      legacySystemMessagesTotalCount: result.legacySystemMessagesTotalCount,
      legacySystemMessageRemoteIds: result.legacySystemMessageRemoteIds
    };
    teardownFailedSteps.value = result.failedSteps;

    if (result.failedSteps.length > 0) {
      teardownSuccessMessage.value = `Teardown completed with ${result.failedSteps.length} step(s) that could not be completed. See details below.`;
      await showToast(`Teardown completed — ${result.failedSteps.length} step(s) failed.`);
    } else {
      teardownSuccessMessage.value = "Legacy product sync teardown completed successfully for all artifacts on this shop.";
      await showToast("Legacy product sync teardown completed.");
    }
  } catch (error: any) {
    teardownErrorMessage.value = error?.message || "Failed to deactivate the legacy product sync.";
    await showToast(teardownErrorMessage.value);
  } finally {
    isTeardownRunning.value = false;
  }
}
</script>
