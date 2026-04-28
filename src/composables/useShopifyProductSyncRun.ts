import { computed, reactive, toRefs } from 'vue';
import { useStore } from 'vuex';
import { useSystemMessage } from './useSystemMessage';
import { useDataManagerLog } from './useDataManagerLog';
import { ShopifyProductSyncRun } from '@/services/ShopifyProductSyncService';
import { translate } from '@/i18n';

export function useShopifyProductSyncRun() {
  const store = useStore();
  const statusItems = computed(() => store.getters['util/getStatusItems']);
  const { currentSystemMessage, currentShopifyBulkOperation, fetchShopifyBulkOperationBySystemMessageId } = useSystemMessage();
  const { currentMdmLog, fetchMdmLogBySystemMessageId } = useDataManagerLog();

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

  const fetchSyncRun = async (systemMessageId: string) => {
    if (!systemMessageId) return null;
    
    state.loading = true;
    try {
      // Fetch System Message and related Shopify Bulk Operation
      await fetchShopifyBulkOperationBySystemMessageId(systemMessageId);
      
      // Fetch MDM Log
      await fetchMdmLogBySystemMessageId(systemMessageId);

      // Map to ShopifyProductSyncRun
      state.currentSyncRun = {
        systemMessageId,
        systemMessage: {
          ...currentSystemMessage.value,
          statusLabel: getStatusLabel(currentSystemMessage.value?.statusId),
          statusColor: getStatusColor(currentSystemMessage.value?.statusId)
        },
        bulkOperation: {
          id: currentShopifyBulkOperation.value?.id,
          status: currentShopifyBulkOperation.value?.status,
          statusLabel: getStatusLabel(currentShopifyBulkOperation.value?.status),
          statusColor: getStatusColor(currentShopifyBulkOperation.value?.status),
          objectCount: currentShopifyBulkOperation.value?.objectCount
        },
        mdmLog: {
          id: currentMdmLog.value?.logId,
          statusId: currentMdmLog.value?.statusId,
          statusLabel: getStatusLabel(currentMdmLog.value?.statusId),
          statusColor: getStatusColor(currentMdmLog.value?.statusId),
          totalRecordCount: currentMdmLog.value?.totalRecordCount,
          failedRecordCount: currentMdmLog.value?.failedRecordCount,
          successRecordCount: currentMdmLog.value?.successRecordCount
        },
        status: getStatusLabel(currentMdmLog.value?.statusId || currentShopifyBulkOperation.value?.status || currentSystemMessage.value?.statusId),
        statusColor: getStatusColor(currentMdmLog.value?.statusId || currentShopifyBulkOperation.value?.status || currentSystemMessage.value?.statusId),
        completed: currentMdmLog.value?.statusId === "DmlSuccess" || currentMdmLog.value?.statusId === "DmlError"
      };

      return state.currentSyncRun;
    } finally {
      state.loading = false;
    }
  };

  return {
    ...toRefs(state),
    fetchSyncRun
  };
}
