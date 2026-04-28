import { reactive, toRefs } from 'vue';
import api from '@/api';
import logger from '@/logger';

export function useDataManagerLog() {
  const state = reactive({
    currentMdmLog: {} as Record<string, any>,
    recentMdmLogs: [] as any[],
    errorLogs: [] as any[],
    errorCsvRecords: null as any,
    loading: false
  });

  const isValidJSON = (data: any) => {
    try {
      JSON.parse(data);
      return true;
    } catch (err) {
      return false;
    }
  };

  const downloadDataManagerFile = async (configId: string, logContentId: string) => {
    if (!configId || !logContentId) return null;

    return api({
      url: "admin/dataManager/downloadDataManagerFile",
      method: "GET",
      params: {
        configId,
        logContentId
      }
    }) as any;
  };

  const fetchFailedRecords = async (configId: string, errorLogContentId: string) => {
    try {
      const resp = await downloadDataManagerFile(configId, errorLogContentId);

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

  const applyMdmLogDetails = async (mdmLog: any) => {
    state.currentMdmLog = mdmLog;
    state.currentMdmLog["successRecordCount"] = (Number(state.currentMdmLog.totalRecordCount) || 0) - (Number(state.currentMdmLog.failedRecordCount) || 0);

    if (state.currentMdmLog.errorLogContentId) {
      await fetchFailedRecords(state.currentMdmLog.configId, state.currentMdmLog.errorLogContentId);
    }

    return state.currentMdmLog;
  };

  const getFirstMdmLog = (responseData: any) => {
    return responseData?.dataManagerLogs?.length ? responseData.dataManagerLogs[0] : null;
  };

  const fetchMdmLogBySystemMessageId = async (systemMessageId: string) => {
    if (!systemMessageId) return null;

    state.loading = true;
    state.currentMdmLog = {};
    state.errorLogs = [];
    state.errorCsvRecords = null;
    try {
      const resp = await api({
        url: "admin/dataManager/details",
        method: "GET",
        params: {
          systemMessageId,
          systemMessageId_op: "equals",
          pageSize: 1
        }
      }) as any;

      const mdmLog = getFirstMdmLog(resp?.data);
      if (mdmLog) return applyMdmLogDetails(mdmLog);
    } catch (err) {
      logger.error(`Failed to fetch MDM log for system message ${systemMessageId}`, err);
    } finally {
      state.loading = false;
    }
    return null;
  };

  const fetchMdmLogBySystemMessageIds = async (systemMessageIds: string[]) => {
    const candidateSystemMessageIds = systemMessageIds
      .map((systemMessageId) => String(systemMessageId || "").trim())
      .filter((systemMessageId, index, list) => systemMessageId && list.indexOf(systemMessageId) === index);

    for (const systemMessageId of candidateSystemMessageIds) {
      const mdmLog = await fetchMdmLogBySystemMessageId(systemMessageId);
      if (mdmLog) return mdmLog;
    }

    return null;
  };

  const fetchLogDetails = async (logId: string) => {
    state.loading = true;
    state.currentMdmLog = {};
    state.errorLogs = [];
    state.errorCsvRecords = null;
    try {
      const resp = await api({
        url: "admin/dataManager/details",
        method: "GET",
        params: {
          logId
        }
      }) as any;

      const mdmLog = getFirstMdmLog(resp?.data);
      if (mdmLog) return applyMdmLogDetails(mdmLog);
    } catch(err) {
      logger.error(`Failed to fetch log with id ${logId}`, err);
    } finally {
      state.loading = false;
    }
    return null;
  };

  const fetchRecentLogsByConfigId = async (configId: string, pageSize = 10) => {
    if (!configId) return [];

    state.loading = true;
    try {
      const resp = await api({
        url: "admin/dataManager/details",
        method: "GET",
        params: {
          configId,
          pageSize,
          pageIndex: 0
        }
      }) as any;

      state.recentMdmLogs = resp?.data?.dataManagerLogs || [];
      return state.recentMdmLogs;
    } catch (err) {
      logger.error(`Failed to fetch recent MDM logs for config ${configId}`, err);
      state.recentMdmLogs = [];
    } finally {
      state.loading = false;
    }
    return [];
  };

  return {
    ...toRefs(state),
    downloadDataManagerFile,
    fetchFailedRecords,
    fetchMdmLogBySystemMessageId,
    fetchMdmLogBySystemMessageIds,
    fetchLogDetails,
    fetchRecentLogsByConfigId
  };
}
