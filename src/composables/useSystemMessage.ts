import { reactive, toRefs } from 'vue';
import api from '@/api';
import logger from '@/logger';

export function useSystemMessage() {
  const state = reactive({
    currentSystemMessage: {} as Record<string, any>,
    currentMdmLog: {} as Record<string, any>,
    currentShopifyBulkOperation: {} as Record<string, any>,
    errorLogs: [] as any[],
    errorCsvRecords: null as any,
    loading: false
  });

  const fetchSystemMessageById = async (systemMessageId: string) => {
    state.loading = true;
    try {
      const response = await api({
        url: "admin/systemMessages",
        method: "GET",
        params: {
          systemMessageId: encodeURIComponent(systemMessageId),
          pageSize: 1
        }
      }) as any;

      if (response?.data?.systemMessages?.length) {
        state.currentSystemMessage = response.data.systemMessages[0];
        return state.currentSystemMessage;
      }
    } catch (err) {
      logger.error(`Failed to fetch system message ${systemMessageId}`, err);
    } finally {
      state.loading = false;
    }
    return null;
  };

  const fetchSystemMessages = async (params: any) => {
    state.loading = true;
    try {
      const response = await api({
        url: "admin/systemMessages",
        method: "GET",
        params
      }) as any;

      if (response?.data?.systemMessages) {
        return response.data.systemMessages;
      }
    } catch (err) {
      logger.error(`Failed to fetch system messages`, err);
    } finally {
      state.loading = false;
    }
    return [];
  };

  const isValidJSON = (data: any) => {
    try {
      JSON.parse(data);
      return true;
    } catch (err) {
      return false;
    }
  };

  const fetchFailedRecords = async (configId: string, errorLogContentId: string) => {
    try {
      const resp = await api({
        url: "admin/dataManager/downloadDataManagerFile",
        method: "GET",
        params: {
          configId,
          logContentId: errorLogContentId
        }
      }) as any;

      state.errorCsvRecords = resp?.data?.csvData || resp?.data;
      if (isValidJSON(state.errorCsvRecords)) {
        state.errorLogs = JSON.parse(state.errorCsvRecords);
      } else {
        // Fallback since PapaParse might not be available in this app
        // Stores raw CSV string as an array of rows
        state.errorLogs = state.errorCsvRecords && typeof state.errorCsvRecords === 'string' 
          ? state.errorCsvRecords.split('\n').filter(Boolean) 
          : [];
      }
    } catch (err) {
      logger.error("Failed to download the error records", err);
    }
  };

  const fetchMdmLogBySystemMessageId = async (systemMessageId: string) => {
    state.loading = true;
    try {
      const resp = await api({
        url: "admin/dataManager/details",
        method: "GET",
        params: {
          systemMessageId
        }
      }) as any;

      if (resp?.data?.dataManagerLogsCount) {
        state.currentMdmLog = resp.data.dataManagerLogs[0];
        state.currentMdmLog["successRecordCount"] = (Number(state.currentMdmLog.totalRecordCount) || 0) - (Number(state.currentMdmLog.failedRecordCount) || 0);

        if (state.currentMdmLog.errorLogContentId) {
          await fetchFailedRecords(state.currentMdmLog.configId, state.currentMdmLog.errorLogContentId);
        }
        return state.currentMdmLog;
      }
    } catch (err) {
      logger.error(`Failed to fetch MDM log for system message ${systemMessageId}`, err);
    } finally {
      state.loading = false;
    }
    return null;
  };

  const fetchShopifyBulkOperation = async (bulkOperationId: string) => {
    state.loading = true;
    try {
      // Placeholder: The Shopify GraphQL passthrough API is not yet available in Moqui.
      // We mock the response for now.
      logger.info(`Mock fetching Shopify Bulk Operation for ID: ${bulkOperationId}`);
      state.currentShopifyBulkOperation = {
        id: bulkOperationId,
        status: "PENDING_API",
        objectCount: 0
      };
      return state.currentShopifyBulkOperation;
    } catch (err) {
      logger.error(`Failed to fetch Shopify Bulk Operation ${bulkOperationId}`, err);
    } finally {
      state.loading = false;
    }
    return null;
  };

  const fetchRelatedRecords = async (systemMessageId: string) => {
    const systemMessage = await fetchSystemMessageById(systemMessageId);
    
    if (systemMessage) {
      // Find related MDM log via systemMessageId
      await fetchMdmLogBySystemMessageId(systemMessageId);

      // Find related Shopify Bulk Operation via remoteMessageId
      if (systemMessage.remoteMessageId) {
        await fetchShopifyBulkOperation(systemMessage.remoteMessageId);
      } else {
        state.currentShopifyBulkOperation = {};
      }
    } else {
      state.currentMdmLog = {};
      state.currentShopifyBulkOperation = {};
    }
    
    return {
      systemMessage: state.currentSystemMessage,
      mdmLog: state.currentMdmLog,
      shopifyBulkOperation: state.currentShopifyBulkOperation
    };
  };

  return {
    ...toRefs(state),
    fetchSystemMessageById,
    fetchMdmLogBySystemMessageId,
    fetchFailedRecords,
    fetchShopifyBulkOperation,
    fetchRelatedRecords,
    fetchSystemMessages
  };
}
