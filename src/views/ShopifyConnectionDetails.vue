<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-back-button slot="start" default-href="/shopify"/>
        <ion-title v-if="isLoading"><ion-skeleton-text animated style="width: 100px" /></ion-title>
        <ion-title v-else>{{ shop.name || id }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding-horizontal">
      <div v-if="isLoading">
        <section class="ion-margin-top" v-for="i in 3" :key="i">
          <ion-skeleton-text animated style="width: 150px; height: 32px;" class="ion-margin-bottom" />
          <div class="grid-container">
            <ion-item v-for="j in (i === 1 ? 2 : (i === 2 ? 2 : 4))" :key="j" class="item-box" lines="none">
              <ion-label>
                <ion-skeleton-text animated style="width: 70%" />
                <p><ion-skeleton-text animated style="width: 50%" /></p>
              </ion-label>
            </ion-item>
          </div>
        </section>
      </div>

      <div v-else>
        <div class="ion-margin-top">
          <h1>{{ translate("Configuration") }}</h1>
          <section>
            <ion-item detail class="item-box" lines="none" button @click="openShopDetails()">
              <ion-label>
                {{ shop.name || id }}
                <p>{{ translate("Instance details and timezone") }}</p>
              </ion-label>
            </ion-item>
            <ion-item detail class="item-box" lines="none" button @click="openProductStoreModal()">
              <ion-label>
                {{ shop.productStoreId || translate("Not linked") }}
                <p>{{ translate("Product Store") }}</p>
              </ion-label>
            </ion-item>
          </section>
        </div>

        <div class="ion-margin-top">
          <h1>{{ translate("Products and Inventory") }}</h1>
          <section>
            <ion-item detail class="item-box" lines="none" button @click="openDownloadProductsModal()">
              <ion-label>{{ translate("Download products") }}</ion-label>
            </ion-item>
            <ion-item detail class="item-box" lines="none" button @click="openShopifyLocations()">
              <ion-label>{{ translate("Inventory locations") }}</ion-label>
            </ion-item>
            <ion-item detail class="item-box" lines="none" button @click="openProductTypes()">
              <ion-label>{{ translate("Product types") }}</ion-label>
            </ion-item>
          </section>
        </div>

        <div class="ion-margin-top">
          <h1>{{ translate("Orders and fulfillment") }}</h1>
          <section>
            <ion-item detail class="item-box" lines="none" button @click="openShipmentMethods()">
              <ion-label>{{ translate("Shipping methods") }}</ion-label>
            </ion-item>
            <ion-item detail class="item-box" lines="none" button @click="openPaymentMethods()">
              <ion-label>{{ translate("Payment methods") }}</ion-label>
            </ion-item>
            <ion-item detail class="item-box" lines="none" button @click="openSalesChannels()">
              <ion-label>{{ translate("Sales channels") }}</ion-label>
            </ion-item>
          </section>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>


<script setup lang="ts">
import { alertController, IonBackButton, IonContent, IonHeader, IonItem, IonLabel, IonPage, IonSkeletonText, IonTitle, IonToolbar, modalController, onIonViewWillEnter } from "@ionic/vue";
import { translate } from "@/i18n";
import { computed, defineProps, ref } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import ShopifyProductStoreModal from "@/components/ShopifyProductStoreModal.vue";

const props = defineProps(['id']);
const store = useStore();
const router = useRouter();
const isLoading = ref(true);

const shop = computed(() => store.getters["shopify/getShopById"](props.id) || {});

onIonViewWillEnter(async () => {
  isLoading.value = true;
  if (!shop.value.shopId) {
    await store.dispatch("shopify/fetchShopifyShops")
  }
  isLoading.value = false;
})

async function openProductStoreModal() {
  const modal = await modalController.create({
    component: ShopifyProductStoreModal,
    componentProps: { shop: shop.value }
  });
  modal.onDidDismiss().then(async () => {
    await store.dispatch("shopify/fetchShopifyShops");
  });
  modal.present();
}

async function openDownloadProductsModal() {
  const alert = await alertController.create({
    header: translate("Download products"),
    message: translate("This will trigger a background job to import new products from Shopify. proceed?", { name: shop.value.name }),
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      { 
        text: translate("Download"),
        handler: () => {
          store.dispatch("shopify/triggerProductDownload", { shopId: shop.value.shopId });
        }
      }
    ]
  });
  await alert.present();
}

function openShopDetails() {
  router.push(`/shopify-connection-details/${props.id}/instance-details`);
}

function openShopifyLocations() {
  router.push(`/shopify-connection-details/${props.id}/locations`);
}

function openShipmentMethods() {
  router.push(`/shopify-connection-details/${props.id}/shipment-methods`);
}

function openPaymentMethods() {
  router.push(`/shopify-connection-details/${props.id}/payment-methods`);
}

function openSalesChannels() {
  router.push(`/shopify-connection-details/${props.id}/sales-channels`);
}

function openProductTypes() {
  router.push(`/shopify-connection-details/${props.id}/product-types`);
}
</script>

<style scoped>
.item-box::part(native) {
  --border-radius: var(--spacer-xs);
  border: var(--border-medium);
}

section {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacer-sm);
}

@media screen and (min-width: 700px) {
  ion-content {
    --padding-start: var(--spacer-lg);
    --padding-end: var(--spacer-lg);
  }
}
</style>
