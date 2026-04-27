<template>
  <section class="sync-summary">
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ translate("Summary") }}</ion-card-title>
        <ion-card-subtitle>{{ translate("Running every 15 min") }}</ion-card-subtitle>
        <ion-buttons>
          <ion-button fill="clear" :disabled="!syncJobObj" @click="$emit('run-job', syncJobObj)">

            <ion-icon slot="icon-only" :icon="flashOutline" />
          </ion-button>


          <ion-button fill="clear" @click="openActionsPopover($event)">
            <ion-icon slot="icon-only" :icon="ellipsisVerticalOutline" />
          </ion-button>

        </ion-buttons>
      </ion-card-header>
      <ion-list lines="full">
        <ion-item>
          <ion-label>{{ translate("Last sync") }}</ion-label>
          <ion-note slot="end">{{ lastSyncLabel }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>{{ translate("Next sync time") }}
            <p v-if="isSyncScheduled">{{ nextSyncLabel }}</p>
          </ion-label>
          <ion-note slot="end" v-if="isSyncScheduled">4 mins</ion-note>
          <ion-button slot="end" fill="outline" color="primary" v-else @click="openScheduleModal()">{{ translate("Schedule") }}</ion-button>
        </ion-item>
        <ion-item>
          <ion-label>{{ translate("Product store") }}</ion-label>
          <ion-note slot="end">{{ selectedProductStoreName }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>{{ translate("Un-synced updates") }}</ion-label>
          <ion-badge slot="end" color="medium">{{ unsyncedUpdatesCount }}</ion-badge>
        </ion-item>
      </ion-list>
    </ion-card>

    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ translate("Track sync progress") }}</ion-card-title>
        <ion-card-subtitle>{{ translate("Monitor each step as products get imported from Shopify") }}</ion-card-subtitle>
        <ion-buttons>
          <ion-button fill="clear" @click="$emit('openHistory')">
            <ion-icon slot="icon-only" :icon="timeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-card-header>
      <ion-list lines="full">
        <ion-item v-for="step in progressSteps" :key="step.name">
          <ion-label>
            {{ step.name }}
            <p v-if="step.caption">{{ step.caption }}</p>
          </ion-label>
          <ion-badge v-if="step.status" slot="end" :color="step.color">{{ step.status }}</ion-badge>
        </ion-item>
      </ion-list>
    </ion-card>
  </section>

  <section class="sync-stat">
    <div class="stat-header">
      <ion-item class="stat-title" lines="none">
        <ion-label>
          <h2>{{ translate("Recently synced product updates") }}</h2>
          <p>{{ translate("Audit what products were recently updated and what exactly changed in them") }}</p>
        </ion-label>
      </ion-item>
      <ion-searchbar v-model="updatesQuery" :placeholder="translate('Search by internal name')" />
    </div>
    <div class="stat-data">
      <ion-card v-for="item in filteredUpdates" :key="item.id">
        <ion-list lines="full">
          <ion-item>
            <ion-label>
              {{ item.internalName }}
              <p>{{ item.shopifyId }}</p>
            </ion-label>
            <ion-note slot="end">{{ item.updatedTime }}</ion-note>
          </ion-item>
          <ion-item-divider color="light">
            <ion-label>{{ translate("Changes") }}</ion-label>
          </ion-item-divider>
          <ion-item v-for="(detail, index) in item.details" :key="index">
            <ion-label>
              {{ detail.label }}
              <p :class="detail.type === 'added' ? 'ion-text-success' : 'ion-text-danger'">
                {{ detail.type === 'added' ? translate('Added') : translate('Removed') }}
              </p>
            </ion-label>
            <ion-label slot="end" class="ion-text-wrap ion-text-end">
              {{ detail.value }}
            </ion-label>
          </ion-item>
          <ion-item v-if="!item.details.length">
            <ion-label>{{ translate("No details found for this update") }}</ion-label>
          </ion-item>
        </ion-list>
      </ion-card>

      <ion-card v-if="!filteredUpdates.length">
        <ion-list lines="full">
          <ion-item>
            <ion-label>{{ translate("No recently synced product updates") }}</ion-label>
          </ion-item>
        </ion-list>
      </ion-card>
    </div>
  </section>

  <section class="sync-stat">
    <div class="stat-header">
      <ion-item class="stat-title" lines="none">
        <ion-label>
          <h2>{{ translate("Recent sync errors") }}</h2>
          <p>{{ translate("Audit what products failed to sync recently and retry them") }}</p>
        </ion-label>
      </ion-item>
      <ion-searchbar v-model="errorsQuery" :placeholder="translate('Search by internal name')" />
    </div>
    <div class="stat-data">
      <ion-card v-for="item in filteredErrors" :key="item.id">
      <ion-list lines="full">
        <ion-item>
          <ion-label>
            {{ item.internalName }}
            <p>{{ item.shopifyId }}</p>
          </ion-label>
          <ion-note slot="end">{{ item.updatedTime }}</ion-note>
        </ion-item>
        <ion-item>
          <ion-label>{{ item.errorContent }}</ion-label>
        </ion-item>
      </ion-list>
      <ion-card-content>
        <ion-button fill="clear">{{ translate("Retry") }}</ion-button>
        <ion-button fill="clear">{{ translate("Download raw file") }}</ion-button>
      </ion-card-content>
    </ion-card>
    <ion-card v-if="!filteredErrors.length">
      <ion-list lines="full">
        <ion-item>
          <ion-label>{{ translate("No recent sync errors") }}</ion-label>
        </ion-item>
      </ion-list>
    </ion-card>
    </div>
  </section>

</template>

<script setup lang="ts">
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonIcon,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar
} from "@ionic/vue";
import { translate } from "@/i18n";
import { computed, defineEmits, defineProps, ref } from "vue";
import { ellipsisVerticalOutline, flashOutline, timeOutline } from "ionicons/icons";
import { modalController, popoverController } from "@ionic/vue";
import ScheduleModal from "./ScheduleModal.vue";
import ShopifyProductSyncActionsPopover from "./ShopifyProductSyncActionsPopover.vue";

const props = defineProps<{

  isSyncScheduled?: boolean
  lastSyncLabel: string
  nextSyncLabel: string
  progressSteps: Array<{ name: string, caption?: string, status?: string, color?: string }>
  recentSyncErrors: Array<{ id: string, internalName: string, shopifyId: string, updatedTime: string, errorContent: string }>
  recentSyncUpdates: Array<{ id: string, internalName: string, shopifyId: string, updatedTime: string, details: Array<{ type: string, label: string, value: string }> }>
  selectedProductStoreName: string
  unsyncedUpdatesCount: number | string
  syncJobObj?: any
}>();
const emit = defineEmits(["openHistory", "scheduleSync", "run-job"]);



async function openScheduleModal() {
  const scheduleModal = await modalController.create({
    component: ScheduleModal,
    componentProps: { cronExpression: "0 0/15 * * *" },
    showBackdrop: true,
    swipeToClose: true
  });
  scheduleModal.onDidDismiss().then((result) => {
    if (result.data && result.data.expression) {
      emit("scheduleSync", result.data.expression);
    }
  });
  await scheduleModal.present();
}

async function openActionsPopover(event: Event) {
  const popover = await popoverController.create({
    component: ShopifyProductSyncActionsPopover,
    event,
    showBackdrop: false
  });
  await popover.present();

  const { data } = await popover.onDidDismiss();
  if (data?.action === 'reschedule') {
    openScheduleModal();
  } else if (data?.action === 'pause') {
    // Handle pause
    console.log("Pause sync requested");
    // typically would call a service to unschedule/disable the job
  }
}



const updatesQuery = ref("");
const errorsQuery = ref("");

const filteredUpdates = computed(() => {
  const query = updatesQuery.value.trim().toLowerCase();
  if (!query) return props.recentSyncUpdates;

  return props.recentSyncUpdates.filter((item) => {
    return item.internalName.toLowerCase().includes(query) || item.shopifyId.toLowerCase().includes(query);
  });
});

const filteredErrors = computed(() => {
  const query = errorsQuery.value.trim().toLowerCase();
  if (!query) return props.recentSyncErrors;

  return props.recentSyncErrors.filter((item) => {
    return item.internalName.toLowerCase().includes(query) || item.shopifyId.toLowerCase().includes(query);
  });
});
</script>

<style>
ion-card-header {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: "title actions" "subtitle actions";
}

ion-card-title {
  grid-area: title;
}

ion-card-subtitle {
  grid-area: subtitle;
}

ion-buttons {
  grid-area: actions;
}

.sync-summary {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  align-items: start;
}

.sync-summary ion-card {
  flex: 0 1 375px;
}

.stat-header{
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  align-items: center;
}

.stat-title {
  flex: 1 2 375px;
}

.sync-stat ion-searchbar {
  flex: 0 1 375px;
}

.stat-data {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: scroll;
  align-items: start;
}

.stat-data ion-card {
  flex: 0 0 375px;
}
</style>