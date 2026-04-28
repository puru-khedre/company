import { computed, reactive, toRefs } from 'vue';
import { useStore } from 'vuex';
import { useSystemMessage } from './useSystemMessage';
import { useDataManagerLog } from './useDataManagerLog';
import { ShopifyProductSyncRun } from '@/services/ShopifyProductSyncService';
import { translate } from '@/i18n';

export function useShopifyProductSyncRun() {
  const store = useStore();
  const statusItems = computed(() => store.getters['util/getStatusItems']);
  const { fetchShopifyBulkOperationBySystemMessageId } = useSystemMessage();
  const { fetchMdmLogBySystemMessageId } = useDataManagerLog();

  const state = reactive({
    currentSyncRun: {} as ShopifyProductSyncRun,
    loading: false
  });

  const getStatusColor = (status: string) => {
    if (!status) return "medium";
    const s = status.toLowerCase();
    if (s.includes("success") || s.includes("completed") || s.includes("consumed") || s.includes("finished") || s === "dmlsuccess") return "success";
    if (s.includes("error") || s.includes("failed") || s.includes("rejected") || s === "dmlerror") return "danger";
    if (s.includes("running") || s.includes("sent") || s.includes("produced") || s.includes("smsg")) return "primary";
    return "medium";
  };

  const getStatusLabel = (status: string) => {
    if (!status) return translate("Pending");

    if (statusItems.value[status]) {
      return statusItems.value[status].description || statusItems.value[status].statusId;
    }

    const s = status.toLowerCase();
    if (s === "running") return translate("Running");
    if (s === "completed") return translate("Complete");
    if (s === "failed") return translate("Error");
    if (s === "canceled") return translate("Canceled");
    return status;
  };

  const fetchSyncRun = async (systemMessageId: string, systemMessageData?: any) => {
    if (!systemMessageId && !systemMessageData) return null;
    
    state.loading = true;
    try {
      // Fetch System Message and related Shopify Bulk Operation
      const { systemMessage, shopifyBulkOperation } = await fetchShopifyBulkOperationBySystemMessageId(systemMessageId, systemMessageData);
      const syncRunSystemMessageId = systemMessageId || systemMessage?.systemMessageId;
      
      // Fetch MDM Log
      const mdmLog = await fetchMdmLogBySystemMessageId(syncRunSystemMessageId) || {};

      // Map to ShopifyProductSyncRun
      const syncRun: ShopifyProductSyncRun = {
        systemMessageId: syncRunSystemMessageId,
        systemMessage: {
          ...systemMessage,
          statusLabel: getStatusLabel(systemMessage?.statusId),
          statusColor: getStatusColor(systemMessage?.statusId)
        },
        bulkOperation: {
          id: shopifyBulkOperation?.id,
          status: shopifyBulkOperation?.status,
          statusLabel: getStatusLabel(shopifyBulkOperation?.status),
          statusColor: getStatusColor(shopifyBulkOperation?.status),
          objectCount: shopifyBulkOperation?.objectCount,
          query: shopifyBulkOperation?.query
        },
        mdmLog: {
          id: mdmLog?.logId,
          statusId: mdmLog?.statusId,
          statusLabel: getStatusLabel(mdmLog?.statusId),
          statusColor: getStatusColor(mdmLog?.statusId),
          totalRecordCount: mdmLog?.totalRecordCount,
          failedRecordCount: mdmLog?.failedRecordCount,
          successRecordCount: mdmLog?.successRecordCount
        },
        status: getStatusLabel(mdmLog?.statusId || shopifyBulkOperation?.status || systemMessage?.statusId),
        statusColor: getStatusColor(mdmLog?.statusId || shopifyBulkOperation?.status || systemMessage?.statusId),
        completed: mdmLog?.statusId === "DmlSuccess" || mdmLog?.statusId === "DmlError"
      };

      state.currentSyncRun = syncRun;
      return syncRun;
    } finally {
      state.loading = false;
    }
  };

  return {
    ...toRefs(state),
    fetchSyncRun
  };
}
