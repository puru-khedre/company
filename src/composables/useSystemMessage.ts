import { reactive, toRefs } from 'vue';
import api from '@/api';
import logger from '@/logger';

export function useSystemMessage() {
  const state = reactive({
    currentSystemMessage: {} as Record<string, any>,
    currentShopifyBulkOperation: {} as Record<string, any>,
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
      // Find related Shopify Bulk Operation via remoteMessageId
      if (systemMessage.remoteMessageId) {
        await fetchShopifyBulkOperation(systemMessage.remoteMessageId);
      } else {
        state.currentShopifyBulkOperation = {};
      }
    } else {
      state.currentShopifyBulkOperation = {};
    }
    
    return {
      systemMessage: state.currentSystemMessage,
      shopifyBulkOperation: state.currentShopifyBulkOperation
    };
  };

  return {
    ...toRefs(state),
    fetchSystemMessageById,
    fetchShopifyBulkOperation,
    fetchRelatedRecords,
    fetchSystemMessages
  };
}
