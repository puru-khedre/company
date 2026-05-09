<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal" :aria-label="translate('Close')">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Email events") }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list inset>
      <ion-item>
        <ion-label>
          <h2>{{ translate("Choose which emails Klaviyo sends") }}</h2>
          <p>{{ translate("Each email event below corresponds to a moment in your customer's journey. Turn one on to send it through {connection} for the selected store.", { connection: connection?.description || translate("this connection") }) }}</p>
        </ion-label>
      </ion-item>
      <ion-item>
        <ion-select
          interface="popover"
          :value="selectedStoreId"
          @ionChange="handleStoreChange($event.detail.value)"
          :label="translate('Product store')"
          label-placement="stacked"
          :placeholder="translate('Select a product store')"
        >
          <ion-select-option v-for="store in productStores" :key="store.productStoreId" :value="store.productStoreId">
            {{ store.storeName || store.productStoreId }}
          </ion-select-option>
        </ion-select>
      </ion-item>
    </ion-list>

    <ion-card v-if="!selectedStoreId">
      <ion-card-header>
        <ion-card-title>{{ translate("Pick a product store to begin") }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <p>{{ translate("Email events are configured per store. Choose one above to see what is currently sent.") }}</p>
      </ion-card-content>
    </ion-card>

    <ion-list v-else-if="isLoading" inset>
      <ion-item v-for="item in 4" :key="item">
        <ion-label>
          <h2><ion-skeleton-text animated /></h2>
          <p><ion-skeleton-text animated /></p>
        </ion-label>
      </ion-item>
    </ion-list>

    <ion-list v-else inset>
      <template v-for="evt in eventsForStore" :key="evt.emailType">
        <ion-item>
          <ion-label>
            <h2>{{ getEventLabel(evt.emailType) }}</h2>
            <p>{{ getStateLabel(evt) }}</p>
            <p v-if="evt.enabled && evt.ownedByThisGateway">{{ translate("Subject") }}: {{ evt.subject || defaultSubjectFor(evt.emailType) }}</p>
            <p v-else-if="evt.enabled && !evt.ownedByThisGateway">{{ translate("This event is sent through a different connection. Disable it there first to manage it from here.") }}</p>
          </ion-label>
          <ion-toggle
            slot="end"
            :checked="evt.enabled && evt.ownedByThisGateway"
            :disabled="evt.enabled && !evt.ownedByThisGateway || busyEvent === evt.emailType"
            @ionChange="toggleEvent(evt, $event.detail.checked)"
          />
        </ion-item>
        <ion-item v-if="evt.enabled && evt.ownedByThisGateway">
          <ion-input
            :value="evt.subject"
            :label="translate('Subject')"
            label-placement="stacked"
            :placeholder="translate('Email subject your customer sees')"
            @ionInput="onSubjectInput(evt, $event.detail.value)"
            @ionBlur="commitSubjectIfChanged(evt)"
            :debounce="200"
          />
        </ion-item>
      </template>
    </ion-list>
  </ion-content>
</template>

<script setup lang="ts">
import { computed, defineProps, onMounted, ref } from "vue";
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
  IonTitle,
  IonToggle,
  IonToolbar,
  modalController,
} from "@ionic/vue";
import { closeOutline } from "ionicons/icons";
import { useStore } from "vuex";
import { translate } from "@/i18n";
import { KlaviyoService, ProductStoreEmailSetting } from "@/services/KlaviyoService";
import { getResponseErrorMessage, showToast } from "@/utils";
import logger from "@/logger";

const props = defineProps<{ connection: any; initialProductStoreId?: string }>();
const store = useStore();

const isLoading = ref(false);
const busyEvent = ref<string | null>(null);
const selectedStoreId = ref<string>(props.initialProductStoreId || "");
const subjectDrafts = ref<Record<string, string>>({});

const productStores = computed(() => store.getters["productStore/getProductStores"] || []);
const allSettings = computed<ProductStoreEmailSetting[]>(() => store.getters["klaviyo/getEmailSettings"] || []);
const emailTypes = computed(() => store.getters["util/getEmailTypes"] || []);

// The full PRDS_EMAIL enum has dozens of types unrelated to Klaviyo (quotes,
// returns, gift-card flows, etc.). Klaviyo only handles transactional emails
// the SECAs in `hotwax-poorti` actually trigger, plus the catch-all event.
// We curate the list here so the modal stays focused on what this connection
// can actually do.
const KLAVIYO_SUPPORTED_EMAIL_TYPES: { enumId: string; fallbackLabel: string }[] = [
  { enumId: "READY_FOR_PICKUP",     fallbackLabel: "BOPIS Order Ready for Pickup" },
  { enumId: "REJECT_BOPIS_ORDER",   fallbackLabel: "BOPIS Order Rejection" },
  { enumId: "CANCEL_BOPIS_ORDER",   fallbackLabel: "BOPIS Order Cancellation" },
  { enumId: "HANDOVER_BOPIS_ORDER", fallbackLabel: "BOPIS Order Handover/Completion" },
  { enumId: "CREATE_KLAVIYO_EVENT", fallbackLabel: "Create Klaviyo Event" },
];

const eventsForStore = computed(() => {
  const storeId = selectedStoreId.value;
  if (!storeId) return [];
  // Use the curated supported list; enrich each entry with the description
  // from util/getEmailTypes when the OMS instance has it registered.
  const list = KLAVIYO_SUPPORTED_EMAIL_TYPES.map((supported) => {
    const enumRow = emailTypes.value.find((item: any) => item?.enumId === supported.enumId);
    // Prefer enumName (short, like "BOPIS Order Rejection") over description
    // (which is a long sentence on most rows).
    return {
      emailType: supported.enumId,
      label: enumRow?.enumName || enumRow?.description || supported.fallbackLabel,
    };
  });
  return list.map((type: any) => {
    const setting = allSettings.value.find(
      (item) => item.productStoreId === storeId && item.emailType === type.emailType
    );
    const enabled = !!setting;
    const ownedByThisGateway = enabled && setting?.gatewayAuthId === props.connection?.commGatewayAuthId;
    return {
      emailType: type.emailType,
      label: type.label,
      enabled,
      ownedByThisGateway,
      gatewayAuthId: setting?.gatewayAuthId || "",
      subject: subjectDrafts.value[type.emailType] ?? setting?.subject ?? "",
      setting,
    };
  });
});

onMounted(async () => {
  isLoading.value = true;
  try {
    if (!productStores.value?.length) {
      await store.dispatch("productStore/fetchProductStores");
    }
    if (!emailTypes.value?.length) {
      await store.dispatch("util/fetchEmailTypes");
    }
    if (!allSettings.value?.length) {
      await store.dispatch("klaviyo/fetchAllEmailSettings");
    }
  } catch (error) {
    logger.error(error);
  } finally {
    isLoading.value = false;
  }
});

function closeModal() {
  modalController.dismiss({ dismissed: true });
}

function handleStoreChange(value: string) {
  selectedStoreId.value = value;
  subjectDrafts.value = {};
}

function getEventLabel(emailType: string) {
  const enumRow = emailTypes.value.find((item: any) => item.enumId === emailType);
  if (enumRow?.enumName || enumRow?.description) {
    return enumRow.enumName || enumRow.description;
  }
  const fallback = KLAVIYO_SUPPORTED_EMAIL_TYPES.find((s) => s.enumId === emailType);
  return fallback?.fallbackLabel || emailType;
}

function getStateLabel(evt: any) {
  if (!evt.enabled) return translate("Off");
  if (!evt.ownedByThisGateway) return translate("On (other connection)");
  return translate("On");
}

function defaultSubjectFor(emailType: string) {
  const map: Record<string, string> = {
    READY_FOR_PICKUP: translate("Your order is ready for pickup"),
    REJECT_BOPIS_ORDER: translate("Update on your pickup order"),
    CANCEL_BOPIS_ORDER: translate("Your pickup order has been cancelled"),
    HANDOVER_BOPIS_ORDER: translate("Thanks for picking up your order"),
    CREATE_KLAVIYO_EVENT: translate("Order event"),
  };
  return map[emailType] || getEventLabel(emailType);
}

function onSubjectInput(evt: any, value: string | null | undefined) {
  subjectDrafts.value[evt.emailType] = value || "";
}

async function commitSubjectIfChanged(evt: any) {
  if (!evt.ownedByThisGateway || !evt.setting) return;
  const draft = subjectDrafts.value[evt.emailType];
  if (draft === undefined) return;
  if (draft === evt.setting.subject) return;
  if (!draft.trim()) return;
  busyEvent.value = evt.emailType;
  try {
    const payload: ProductStoreEmailSetting = {
      productStoreId: selectedStoreId.value,
      emailType: evt.emailType,
      subject: draft.trim(),
      systemMessageRemoteId: "UNIGATE_CONFIG",
      gatewayAuthId: props.connection.commGatewayAuthId,
      fromAddress: evt.setting.fromAddress,
    };
    await KlaviyoService.upsertEmailSetting(payload);
    await store.dispatch("klaviyo/fetchAllEmailSettings");
    showToast(translate("Subject updated"));
    delete subjectDrafts.value[evt.emailType];
  } catch (error: any) {
    logger.error(error);
    showToast(getResponseErrorMessage(error, translate("Failed to update subject")));
  } finally {
    busyEvent.value = null;
  }
}

async function toggleEvent(evt: any, enabled: boolean) {
  if (busyEvent.value) return;
  if (evt.enabled && !evt.ownedByThisGateway) return;
  busyEvent.value = evt.emailType;
  try {
    if (enabled) {
      const payload: ProductStoreEmailSetting = {
        productStoreId: selectedStoreId.value,
        emailType: evt.emailType,
        subject: evt.setting?.subject || defaultSubjectFor(evt.emailType),
        systemMessageRemoteId: "UNIGATE_CONFIG",
        gatewayAuthId: props.connection.commGatewayAuthId,
      };
      await KlaviyoService.upsertEmailSetting(payload);
      showToast(translate("{label} turned on", { label: getEventLabel(evt.emailType) }));
    } else {
      await KlaviyoService.deleteEmailSetting(selectedStoreId.value, evt.emailType);
      showToast(translate("{label} turned off", { label: getEventLabel(evt.emailType) }));
    }
    await store.dispatch("klaviyo/fetchAllEmailSettings");
  } catch (error: any) {
    logger.error(error);
    showToast(getResponseErrorMessage(error, translate("Failed to update email event")));
  } finally {
    busyEvent.value = null;
  }
}
</script>
