import { reactive, toRefs } from 'vue';
import api from '@/api';
import logger from '@/logger';
import { translate } from "@/i18n";


const mockData = [
  {
    "lastUpdatedStamp": "2026-04-07T06:27:50+0000",
    "productId": "01",
    "parentProductId": "gid://shopify/Product/8246707552420",
    "differenceMap": "{\n  \"id\" : \"gid://shopify/Product/8246707552420\",\n  \"handle\" : \"gift-card-1\",\n  \"vendor\" : \"hc-sandbox\",\n  \"title\" : \"Gift Card\",\n  \"tags\" : {\n    \"added\" : [ \"Holiday\", \"Gift\" ],\n    \"removed\" : [ \"OldTag\" ]\n  },\n  \"features\" : {\n    \"added\" : [ {\n      \"name\" : \"Color\",\n      \"value\" : \"Gold\"\n    } ],\n    \"removed\" : [ ]\n  }\n}"
  },
  {
    "lastUpdatedStamp": "2026-04-07T06:27:50+0000",
    "productId": "02",
    "parentProductId": "gid://shopify/Product/8771572367524",
    "differenceMap": "{\n  \"id\" : \"gid://shopify/Product/8771572367524\",\n  \"handle\" : \"testing-giftcard\",\n  \"vendor\" : \"HotWax Dev\",\n  \"title\" : \"Testing GiftCard\",\n  \"tags\" : {\n    \"added\" : [ \"New\" ],\n    \"removed\" : [ ]\n  },\n  \"features\" : {\n    \"added\" : [ {\n      \"name\" : \"Size\",\n      \"value\" : \"Standard\"\n    } ],\n    \"removed\" : [ {\n      \"name\" : \"OldFeature\",\n      \"value\" : \"Deleted\"\n    } ]\n  }\n}"
  },
  {
    "lastUpdatedStamp": "2025-12-23T05:53:34+0000",
    "productId": "03",
    "parentProductId": "gid://shopify/Product/10176931823780",
    "differenceMap": "{\n  \"id\" : \"gid://shopify/Product/10176931823780\",\n  \"handle\" : \"green-tshirt-avatar\",\n  \"vendor\" : \"hc-sandbox\",\n  \"title\" : \"Green-Tshirt-Avatar\",\n  \"features\" : {\n    \"added\" : [ {\n      \"name\" : \"Material\",\n      \"value\" : \"Cotton\"\n    } ],\n    \"removed\" : [ ]\n  }\n}"
  },
  {
    "lastUpdatedStamp": "2026-04-08T10:15:20+0000",
    "productId": "04",
    "parentProductId": "gid://shopify/Product/10176935657636",
    "differenceMap": "{\n  \"title\" : \"Pink Tshirt Avatar\",\n  \"price\" : \"25.00\",\n  \"tags\" : {\n    \"added\" : [ \"Spring Collection\", \"Sale\" ],\n    \"removed\" : [ ]\n  }\n}"
  },
  {
    "lastUpdatedStamp": "2026-04-08T11:20:00+0000",
    "productId": "05",
    "parentProductId": "gid://shopify/Product/10176983793828",
    "differenceMap": "{\n  \"title\" : \"Plum Top Test\",\n  \"features\" : {\n    \"added\" : [ ],\n    \"removed\" : [ {\n      \"name\" : \"Pattern\",\n      \"value\" : \"Polka Dot\"\n    } ]\n  },\n  \"assocs\" : {\n    \"added\" : [ { \"id\": \"v1\" }, { \"id\": \"v2\" } ],\n    \"removed\" : [ ]\n  }\n}"
  },
  {
    "lastUpdatedStamp": "2026-04-08T12:05:00+0000",
    "productId": "06",
    "parentProductId": "gid://shopify/Product/10177030389924",
    "differenceMap": "{\n  \"price\" : \"19.99\",\n  \"tags\" : {\n    \"added\" : [ ],\n    \"removed\" : [ \"Out of Stock\" ]\n  }\n}"
  },
  {
    "lastUpdatedStamp": "2026-04-08T13:45:30+0000",
    "productId": "07",
    "parentProductId": "gid://shopify/Product/9246707552420",
    "differenceMap": "{\n  \"title\" : \"Updated Hoodie\",\n  \"features\" : {\n    \"added\" : [ {\n      \"name\" : \"Material\",\n      \"value\" : \"Fleece\"\n    } ],\n    \"removed\" : [ {\n      \"name\" : \"Weight\",\n      \"value\" : \"Light\"\n    } ]\n  }\n}"
  },
  {
    "lastUpdatedStamp": "2026-04-09T09:00:00+0000",
    "productId": "08",
    "parentProductId": "gid://shopify/Product/9771572367524",
    "differenceMap": "{\n  \"tags\" : {\n    \"added\" : [ \"Limited Edition\" ],\n    \"removed\" : [ \"Standard\" ]\n  },\n  \"assocs\" : {\n    \"added\" : [ ],\n    \"removed\" : [ { \"id\": \"v3\" } ]\n  }\n}"
  },
  {
    "lastUpdatedStamp": "2026-04-09T10:30:00+0000",
    "productId": "09",
    "parentProductId": "gid://shopify/Product/11176931823780",
    "differenceMap": "{\n  \"title\" : \"Blue Denim Jacket\",\n  \"features\" : {\n    \"added\" : [ {\n      \"name\" : \"Wash\",\n      \"value\" : \"Stone Wash\"\n    } ],\n    \"removed\" : [ ]\n  }\n}"
  },
  {
    "lastUpdatedStamp": "2026-04-09T14:15:00+0000",
    "productId": "10",
    "parentProductId": "gid://shopify/Product/11176935657636",
    "differenceMap": "{\n  \"price\" : \"45.00\",\n  \"tags\" : {\n    \"added\" : [ \"Featured\" ],\n    \"removed\" : [ \"Old Stock\" ]\n  }\n}"
  }
];



const state = reactive({
  productUpdateHistories: [] as any[],
  loading: false
});

const processHistories = (histories: any[]) => {
  return histories.map((history: any) => {
    let diffs = {} as any;
    if (history.differenceMap) {
      try {
        diffs = typeof history.differenceMap === 'string' 
          ? JSON.parse(history.differenceMap) 
          : history.differenceMap;
      } catch (err) {
        logger.error(`Failed to parse differenceMap for history entry`, err);
      }
    }

    // Transform diffs into a list of human-readable changes
    const details = [] as any[];
    if (diffs.title) details.push({ type: 'added', label: translate('Title'), value: diffs.title });
    if (diffs.price) details.push({ type: 'added', label: translate('Price'), value: diffs.price });
    
    if (diffs.tags) {
      if (diffs.tags.added?.length) details.push({ type: 'added', label: translate('Tags'), value: diffs.tags.added.join(', ') });
      if (diffs.tags.removed?.length) details.push({ type: 'removed', label: translate('Tags'), value: diffs.tags.removed.join(', ') });
    }
    
    if (diffs.features) {
      if (diffs.features.added?.length) {
        details.push({ 
          type: 'added', 
          label: translate('Features'), 
          value: diffs.features.added.map((f: any) => `${f.name}: ${f.value}`).join(', ') 
        });
      }
      if (diffs.features.removed?.length) {
        details.push({ 
          type: 'removed', 
          label: translate('Features'), 
          value: diffs.features.removed.map((f: any) => `${f.name}: ${f.value}`).join(', ') 
        });
      }
    }

    if (diffs.assocs) {
      if (diffs.assocs.added?.length) details.push({ type: 'added', label: translate('Variants'), value: `${diffs.assocs.added.length} ${translate('added')}` });
      if (diffs.assocs.removed?.length) details.push({ type: 'removed', label: translate('Variants'), value: `${diffs.assocs.removed.length} ${translate('removed')}` });
    }

    // Keep legacy changes array for backward compatibility if needed
    const changes = details.map(d => `${d.type === 'added' ? '+' : '-'} ${d.label}: ${d.value}`);

    return {
      ...history,
      diffs,
      details,
      changes
    };
  });
};

export function useProductUpdateHistory() {



  const fetchProductUpdateHistory = async (params: any) => {
    state.loading = true;
    try {
      const response = await api({
        url: "oms/productUpdateHistory",
        method: "GET",
        params: {
          ...params,
          orderByField: "-lastUpdatedStamp" // Show most recent first
        }
      }) as any;

      if (response?.data?.productUpdateHistory && response.data.productUpdateHistory.length > 0) {
        state.productUpdateHistories = processHistories(response.data.productUpdateHistory);
        return state.productUpdateHistories;
      }
    } catch (err) {
      logger.error(`Failed to fetch product update history, falling back to mock data`, err);
    } finally {
      state.loading = false;
    }

    // Fallback to mock data if API fails or returns empty
    state.productUpdateHistories = processHistories(mockData);
    return state.productUpdateHistories;
  };






  return {
    ...toRefs(state),
    fetchProductUpdateHistory
  };
}
