<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/klaviyo" />
        </ion-buttons>
        <ion-title v-if="isLoading">
          <ion-skeleton-text animated />
        </ion-title>
        <ion-title v-else>{{ connection?.description || translate("Klaviyo connection") }}</ion-title>
        <ion-buttons slot="end" v-if="connection">
          <ion-button @click="openEditModal">
            <ion-icon slot="start" :icon="createOutline" />
            {{ translate("Edit") }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list v-if="isLoading" inset>
        <ion-item v-for="item in 5" :key="item">
          <ion-label>
            <h2><ion-skeleton-text animated /></h2>
            <p><ion-skeleton-text animated /></p>
          </ion-label>
        </ion-item>
      </ion-list>

      <ion-card v-else-if="!connection">
        <ion-card-header>
          <ion-card-title>{{ translate("Connection not found") }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>{{ translate("This connection may have been deleted, or it doesn't belong to your tenant.") }}</p>
          <ion-button expand="block" fill="outline" @click="goBack">{{ translate("Back to Klaviyo") }}</ion-button>
        </ion-card-content>
      </ion-card>

      <template v-else>
        <ion-list inset>
          <ion-item>
            <ion-label>
              <h2>{{ translate("Klaviyo connection") }}</h2>
              <p>{{ connection.description || translate("Untitled connection") }}</p>
            </ion-label>
            <ion-badge slot="end" color="success">{{ translate("Active") }}</ion-badge>
          </ion-item>
          <ion-item>
            <ion-label>
              <h3>{{ translate("Connection ID") }}</h3>
              <p>{{ connection.commGatewayAuthId }}</p>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-label>
              <h3>{{ translate("Endpoint") }}</h3>
              <p>{{ connection.baseUrl }}</p>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-label>
              <h3>{{ translate("API key") }}</h3>
              <p>{{ maskedKey }}</p>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-label>
              <h3>{{ translate("Tenant") }}</h3>
              <p>{{ connection.tenantPartyId || "—" }}</p>
            </ion-label>
          </ion-item>
        </ion-list>

        <klaviyo-email-events-modal :connection="connection" />

        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ translate("Disconnect Klaviyo") }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p v-if="eventsForThisConnection.length">
              {{ translate("This connection currently sends {count} email event(s). Removing it will stop those emails immediately.", { count: eventsForThisConnection.length }) }}
            </p>
            <p v-else>
              {{ translate("This connection isn't sending any emails right now, but disconnecting will permanently remove the API key and configuration.") }}
            </p>
            <ion-button color="danger" fill="outline" expand="block" @click="confirmDelete">
              <ion-icon slot="start" :icon="trashOutline" />
              {{ translate("Disconnect") }}
            </ion-button>
          </ion-card-content>
        </ion-card>
      </template>
    </ion-content>

    <ion-modal :is-open="showDeleteModal" :backdrop-dismiss="!isDeleting" @didDismiss="cancelDelete">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-button @click="cancelDelete" :disabled="isDeleting">
              <ion-icon slot="icon-only" :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
          <ion-title>{{ translate("Disconnect Klaviyo?") }}</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list inset>
          <ion-item>
            <ion-label>
              {{ translate("This cannot be undone") }}
              <p>{{ translate("Disconnecting {name} will:", { name: connection?.description || translate("this connection") }) }}</p>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-label>{{ translate("Permanently delete the saved Klaviyo API key from Unigate") }}</ion-label>
          </ion-item>
          <ion-item v-if="eventsForThisConnection.length">
            <ion-label>{{ translate("Stop {count} email event(s) from being sent", { count: eventsForThisConnection.length }) }}</ion-label>
          </ion-item>
          <ion-item>
            <ion-label>{{ translate("Require re-entering the API key if you ever want to reconnect") }}</ion-label>
          </ion-item>
          <ion-item v-if="eventsForThisConnection.length">
            <ion-label>
              <h3>{{ translate("Type DELETE below to confirm:") }}</h3>
            </ion-label>
          </ion-item>
          <ion-item v-if="eventsForThisConnection.length">
            <ion-input
              v-model="deleteConfirmText"
              :placeholder="'DELETE'"
              autocomplete="off"
              spellcheck="false"
            />
          </ion-item>
        </ion-list>
      </ion-content>
      <ion-footer>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-button fill="clear" @click="cancelDelete" :disabled="isDeleting">{{ translate("Keep connection") }}</ion-button>
          </ion-buttons>
          <ion-buttons slot="end">
            <ion-button
              color="danger"
              @click="performDelete"
              :disabled="!canConfirmDelete || isDeleting"
            >
              <ion-spinner v-if="isDeleting" name="crescent" />
              <span v-else>{{ translate("Disconnect Klaviyo") }}</span>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-footer>
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, defineProps, ref } from "vue";
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
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonSkeletonText,
  IonSpinner,
  IonTitle,
  IonToolbar,
  modalController,
  onIonViewWillEnter,
} from "@ionic/vue";
import { closeOutline, createOutline, trashOutline } from "ionicons/icons";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { translate } from "@/i18n";
import { KlaviyoService } from "@/services/KlaviyoService";
import KlaviyoConnectionModal from "@/components/KlaviyoConnectionModal.vue";
import KlaviyoEmailEventsModal from "@/components/KlaviyoEmailEventsModal.vue";
import { getResponseErrorMessage, showToast } from "@/utils";
import logger from "@/logger";

const props = defineProps<{ id: string }>();
const store = useStore();
const router = useRouter();

const isLoading = ref(false);
const showDeleteModal = ref(false);
const isDeleting = ref(false);
const deleteConfirmText = ref("");

const decodedId = computed(() => {
  try {
    return decodeURIComponent(props.id);
  } catch {
    return props.id;
  }
});

const connection = computed(() => store.getters["klaviyo/getConnectionById"](decodedId.value));

const eventsForThisConnection = computed(() => {
  return store.getters["klaviyo/getEmailSettingsForGateway"](decodedId.value) || [];
});
const maskedKey = computed(() => KlaviyoService.maskApiKey(connection.value?.publicKey) || translate("Not set"));

const canConfirmDelete = computed(() => {
  if (!eventsForThisConnection.value.length) return true;
  return deleteConfirmText.value.trim().toUpperCase() === "DELETE";
});

onIonViewWillEnter(async () => {
  isLoading.value = true;
  try {
    await store.dispatch("klaviyo/hydrate");
  } catch (error) {
    logger.error(error);
  } finally {
    isLoading.value = false;
  }
});

async function openEditModal() {
  const modal = await modalController.create({
    component: KlaviyoConnectionModal,
    componentProps: { connection: connection.value },
  });
  modal.onDidDismiss().then(async () => {
    await store.dispatch("klaviyo/fetchConnections");
  });
  modal.present();
}

function confirmDelete() {
  showDeleteModal.value = true;
  deleteConfirmText.value = "";
}

function cancelDelete() {
  if (isDeleting.value) return;
  showDeleteModal.value = false;
  deleteConfirmText.value = "";
}

async function performDelete() {
  if (!connection.value) return;
  if (!canConfirmDelete.value) return;
  isDeleting.value = true;
  try {
    await KlaviyoService.deleteCommGatewayAuth(connection.value.commGatewayAuthId);
    showToast(translate("Klaviyo connection disconnected"));
    showDeleteModal.value = false;
    await store.dispatch("klaviyo/hydrate");
    router.replace("/klaviyo");
  } catch (error: any) {
    logger.error(error);
    showToast(getResponseErrorMessage(error, translate("Failed to disconnect Klaviyo")));
  } finally {
    isDeleting.value = false;
  }
}

function goBack() {
  router.replace("/klaviyo");
}
</script>
