<template>
  <ion-list inset>
    <ion-item>
      <ion-label>
        <h2>{{ translate("Choose which emails Klaviyo sends") }}</h2>
        <p>{{ translate("Each email event below corresponds to a moment in your customer's journey. Turn one on to send it through {connection} for the selected store.", { connection: connection?.description || translate("this connection") }) }}</p>
      </ion-label>
    </ion-item>
  </ion-list>

  <ion-segment
    v-if="productStores.length"
    :value="selectedStoreId"
    scrollable
    @ionChange="handleStoreChange($event.detail.value)"
  >
    <ion-segment-button
      v-for="productStore in productStores"
      :key="productStore.productStoreId"
      :value="productStore.productStoreId"
    >
      <ion-label>{{ productStore.storeName || productStore.productStoreId }}</ion-label>
    </ion-segment-button>
  </ion-segment>

  <ion-card v-if="!productStores.length && !isLoading">
    <ion-card-header>
      <ion-card-title>{{ translate("No product stores available") }}</ion-card-title>
    </ion-card-header>
    <ion-card-content>
      <p>{{ translate("Add or load a product store first before configuring Klaviyo email events.") }}</p>
    </ion-card-content>
  </ion-card>

  <ion-card v-else-if="!selectedStoreId">
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
          <h2>{{ evt.label }}</h2>
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
</template>

<script setup lang="ts">
import { computed, defineProps, onMounted, ref, watch } from "vue";
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonToggle,
} from "@ionic/vue";
import { useStore } from "vuex";
import { translate } from "@/i18n";
import { KlaviyoService, ProductStoreEmailSetting } from "@/services/KlaviyoService";
import { getResponseErrorMessage, showToast } from "@/utils";
import logger from "@/logger";
import {
  getDefaultKlaviyoProductStoreId,
  getKlaviyoEventLabel,
  getKlaviyoEventsForStore,
} from "@/utils/klaviyoEmailEvents";

const props = defineProps<{ connection: any; initialProductStoreId?: string }>();
const store = useStore();

const isLoading = ref(false);
const busyEvent = ref<string | null>(null);
const selectedStoreId = ref<string>(props.initialProductStoreId || "");
const subjectDrafts = ref<Record<string, string>>({});

const productStores = computed(() => store.getters["productStore/getProductStores"] || []);
const allSettings = computed<ProductStoreEmailSetting[]>(() => store.getters["klaviyo/getEmailSettings"] || []);
const emailTypes = computed(() => store.getters["util/getEmailTypes"] || []);

const preferredStoreId = computed(() => {
  const firstConfiguredEvent = allSettings.value.find(
    (setting) => setting.gatewayAuthId === props.connection?.commGatewayAuthId
  );
  return firstConfiguredEvent?.productStoreId || props.initialProductStoreId || "";
});

const eventsForStore = computed(() => {
  return getKlaviyoEventsForStore({
    productStoreId: selectedStoreId.value,
    emailTypes: emailTypes.value,
    allSettings: allSettings.value,
    gatewayAuthId: props.connection?.commGatewayAuthId,
    subjectDrafts: subjectDrafts.value,
  });
});

watch(
  [() => productStores.value, () => preferredStoreId.value],
  ([stores, nextPreferredStoreId]) => {
    selectedStoreId.value = getDefaultKlaviyoProductStoreId(
      stores,
      selectedStoreId.value,
      nextPreferredStoreId
    );
  },
  { immediate: true }
);

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

function handleStoreChange(value: string) {
  selectedStoreId.value = value;
  subjectDrafts.value = {};
}

function getEventLabel(emailType: string) {
  return getKlaviyoEventLabel(emailTypes.value, emailType);
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
