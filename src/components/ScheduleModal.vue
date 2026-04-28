<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Schedule Sync") }}</ion-title>
    </ion-toolbar>
  </ion-header>
  
  <ion-content>
    <ion-list>
      <ion-item>
        <ion-input label-placement="floating" :label="translate('Expression')" v-model="expression"></ion-input>
        <ion-button slot="end" fill="clear" size="small" color="medium"
          href="https://www.quartz-scheduler.org/documentation/quartz-2.3.0/tutorials/crontrigger.html"
          target="_blank" rel="noopener noreferrer">
          <ion-icon :icon="informationCircleOutline" slot="icon-only" />
        </ion-button>
      </ion-item>
      <ion-item>
        <ion-icon slot="start" :icon="informationCircleOutline" />
        <ion-label>
          {{ translate("Quartz cron expression") }}
          <p>{{ translate("Validated with cron-parser before saving.") }}</p>
        </ion-label>
      </ion-item>
      <ion-item>
        <ion-icon slot="start" :icon="timerOutline"/>
        <ion-label>{{ isExpressionValid && getCronString ? getCronString : "-" }}</ion-label>
      </ion-item>
      <ion-item>
        <ion-icon slot="start" :icon="timeOutline"/>
        <ion-label>{{ isExpressionValid && getCronString ? getNextExecutionTime : translate("Provide a valid cron expression") }}</ion-label>
      </ion-item>
    </ion-list>

    <ion-list-header>{{ translate("Schedule Options") }}</ion-list-header>

    <ion-list>
      <ion-radio-group v-model="expression">
        <ion-item :key="expression" v-for="(expression, description) in cronExpressions">
          <ion-radio label-placement="end" justify="start" :value="expression">{{ description }}</ion-radio>
        </ion-item>
      </ion-radio-group>
    </ion-list>
    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button @click="saveChanges()" :disabled="!isExpressionUpdated() || !isExpressionValid || getCronString.length <= 0">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { translate } from "@/i18n";
import {
  alertController,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRadio,
  IonRadioGroup,
  IonTitle,
  IonToolbar,
  modalController,
} from "@ionic/vue";
import { closeOutline, informationCircleOutline, saveOutline, timeOutline, timerOutline } from "ionicons/icons";
import { computed, defineProps, ref } from "vue";
import cronstrue from "cronstrue";
import { CronExpressionParser } from "cron-parser";
import { useStore } from "vuex";
import { DateTime } from "luxon";

const props = defineProps({
  cronExpression: {
    type: String,
    default: "0 */15 * ? * *"
  }
})

let expression = ref(props.cronExpression)

const cronExpressions = {
  "Every 15 minutes": "0 */15 * ? * *",
  "Every 30 minutes": "0 */30 * ? * *",
  "Every hour": "0 0 * ? * *",
  "Every day at midnight": "0 0 0 ? * *"
}

const store = useStore()
const userProfile = computed(() => store.getters["user/getUserProfile"])

const isExpressionValid = computed(() => {
  try {
    CronExpressionParser.parse(expression.value, { tz: userProfile.value?.timeZone || "UTC" })
    return true
  } catch(e) {
    return false
  }
})

const getCronString = computed(() => {
  try {
    return cronstrue.toString(expression.value)
  } catch(e) {
    return ""
  }
})

const getNextExecutionTime = computed(() => {
  try {
    const interval = CronExpressionParser.parse(expression.value, { tz: userProfile.value?.timeZone || "UTC" })
    return DateTime.fromMillis(interval.next().getTime()).toLocaleString(DateTime.DATETIME_MED)
  } catch(e) {
    return ""
  }
})

function closeModal(expression = "") {
  modalController.dismiss({ expression });
}

function isExpressionUpdated() {
  return props.cronExpression !== expression.value
}

async function saveChanges() {
  const alert = await alertController
    .create({
      header: translate("Save changes"),
      message: translate("Are you sure you want to save these changes?"),
      buttons: [{
        text: translate("Cancel"),
        role: "cancel"
      }, {
        text: translate("Save"),
        handler: () => {
          closeModal(expression.value)
        }
      }]
    });
  return alert.present();
}
</script>
