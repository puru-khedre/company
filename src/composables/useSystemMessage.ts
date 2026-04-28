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
        query
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

  const fetchSystemMessagesPage = async (params: any) => {
    state.loading = true;
    try {
      const response = await api({
        url: "admin/systemMessages",
        method: "GET",
        params
      }) as any;

      return response?.data || { systemMessages: [], systemMessagesCount: 0 };
    } catch (err) {
      logger.error(`Failed to fetch system messages`, err);
    } finally {
      state.loading = false;
    }
    return { systemMessages: [], systemMessagesCount: 0 };
  };

  const getGraphqlPayload = (response: any) => {
    const responseData = response?.data || response;
    return responseData?.response?.data ||
      responseData?.data ||
      responseData?.response ||
      responseData;
  };

  const getSystemMessageBulkOperationId = (systemMessage: any) => {
    return systemMessage?.remoteId || systemMessage?.remoteMessageId || "";
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

      const graphQlPayload = getGraphqlPayload(response);
      const payload = graphQlPayload?.node;
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

  const fetchShopifyBulkOperationBySystemMessageId = async (systemMessageId: string, systemMessageData?: any) => {
    const systemMessage = systemMessageData || await fetchSystemMessageById(systemMessageId);
    
    if (systemMessageData) state.currentSystemMessage = systemMessageData;

    let shopifyBulkOperation = {};
    const bulkOperationId = getSystemMessageBulkOperationId(systemMessage);
    if (systemMessage && bulkOperationId && systemMessage.systemMessageRemoteId) {
      shopifyBulkOperation = await fetchShopifyBulkOperation(bulkOperationId, systemMessage.systemMessageRemoteId) || {};
    } else {
      state.currentShopifyBulkOperation = {};
    }
    
    return {
      systemMessage: systemMessage || state.currentSystemMessage,
      shopifyBulkOperation: shopifyBulkOperation || state.currentShopifyBulkOperation
    };
  };

  return {
    ...toRefs(state),
    fetchSystemMessageById,
    fetchShopifyBulkOperation,
    fetchShopifyBulkOperationBySystemMessageId,
    fetchSystemMessages,
    fetchSystemMessagesPage
  };
}
