import { reactive, toRefs } from 'vue';
import api from '@/api';
import logger from '@/logger';

const BULK_OPERATION_QUERY = `
  query BulkOperation($id: ID!) {
    node(id: $id) {
      ... on BulkOperation {
        id
        status
        errorCode
        createdAt
        completedAt
        objectCount
        fileSize
        url
      }
    }
  }
`;

export function useSystemMessage() {
  const state = reactive({
    currentSystemMessage: {} as Record<string, any>,
    currentShopifyBulkOperation: {} as Record<string, any>,
    loading: false
  });

  const fetchSystemMessageById = async (systemMessageId: string) => {
    state.loading = true;
    state.currentSystemMessage = {};
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


  const fetchShopifyBulkOperation = async (bulkOperationId: string, systemMessageRemoteId: string) => {
    state.loading = true;
    state.currentShopifyBulkOperation = {};
    try {
      const response = await api({
        url: "shopify/graphql",
        method: "post",
        data: {
          systemMessageRemoteId,
          queryText: BULK_OPERATION_QUERY,
          variables: {
            id: bulkOperationId
          }
        }
      }) as any;

      const payload = response?.data?.node || response?.response?.data?.node;
      if (payload) {
        state.currentShopifyBulkOperation = payload;
        return state.currentShopifyBulkOperation;
      }
    } catch (err) {
      logger.error(`Failed to fetch Shopify Bulk Operation ${bulkOperationId}`, err);
    } finally {
      state.loading = false;
    }
    return null;
  };

  const fetchShopifyBulkOperationBySystemMessageId = async (systemMessageId: string) => {
    const systemMessage = await fetchSystemMessageById(systemMessageId);
    
    if (systemMessage && systemMessage.remoteMessageId && systemMessage.systemMessageRemoteId) {
      await fetchShopifyBulkOperation(systemMessage.remoteMessageId, systemMessage.systemMessageRemoteId);
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
    fetchShopifyBulkOperationBySystemMessageId,
    fetchSystemMessages
  };
}
