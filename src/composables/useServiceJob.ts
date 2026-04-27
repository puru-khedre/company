import { reactive, toRefs } from 'vue';
import api from '@/api';
import logger from '@/logger';
import cronstrue from 'cronstrue';
import store from '@/store';

const getCronString = (cronExpression: any) => {
  try {
    return cronstrue.toString(cronExpression);
  } catch(e) {
    logger.error(e);
    return "";
  }
}

const getNormalizedJob = (job: any = {}) => ({
  serviceInParameters: Array.isArray(job?.serviceInParameters) ? job.serviceInParameters : [],
  serviceJobParameters: Array.isArray(job?.serviceJobParameters) ? job.serviceJobParameters : [],
  ...job
});

export const getJobDetailWithFallback = (jobDetail: any = {}, fallbackJob: any = {}) => {
  const resolvedJob = Object.keys(jobDetail || {}).length ? jobDetail : fallbackJob;
  return getNormalizedJob(resolvedJob);
};

const state = reactive({
  jobs: [] as Array<any>,
  products: {} as any,
  loading: false
});

export default function useServiceJob() {

  const fetchJobs = async () => {
    state.loading = true;
    try {
      let total = 0;
      let pageIndex = 0;
      let allJobs = [] as any[];
      do {
        const resp = await api({
          url: "admin/serviceJobs",
          method: "GET",
          params: {
            pageSize: 250,
            pageIndex,
            instanceOfProductId_op: "empty",
            instanceOfProductId_not: "Y"
          }
        }) as any;

        const respJobs = (resp?.data || []).map((job: any) => ({
          ...job,
          cronString: job.cronExpression ? getCronString(job.cronExpression) : ''
        }));

        total = respJobs.length;
        allJobs = pageIndex > 0 ? allJobs.concat(respJobs) : respJobs;
        pageIndex++;
      } while(total === 250);
      
      state.jobs = allJobs;
    } catch(err) {
      logger.error("Failed to fetch jobs", err);
    } finally {
      state.loading = false;
    }
  };

  const fetchServiceParams = async (serviceName: string) => {
    const encodedServiceName = encodeURIComponent(serviceName);
    let parameters = [];
    try {
      const resp = await api({
        url: `admin/services/${encodedServiceName}/parameters`,
        method: "GET",
        params: {
          pageSize: 1000
        }
      }) as any;
      parameters = resp?.data?.serviceInParameters || [];
    } catch(err) {
      logger.error("Failed to fetch service parameters", err);
    }
    return parameters;
  };

  const fetchProductDetail = async (productId: string) => {
    try {
      const resp = await api({
        url: `oms/products/${productId}`,
        method: "GET"
      }) as any;
      if (resp?.data) {
        state.products[productId] = resp.data;
      }
    } catch(err) {
      logger.error("Failed to fetch product detail", err);
    }
  };

  const fetchJobDetail = async (jobName: string) => {
    let jobDetails: Record<string, any> = {};
    try {
      const resp = await api({
        url: `admin/serviceJobs/${jobName}`,
        method: "GET",
        params: {
          pageSize: 1000
        }
      }) as any;
      const job = resp?.data?.jobDetail || {};

      const isJobProductStoreDependent = () => job.serviceJobParameters?.some((param: any) => param.parameterName === "productStoreIds");

      if (isJobProductStoreDependent()) {
        const jobProductStore = job.serviceJobParameters.find((param: any) => param.parameterName === "productStoreIds");
        // get productStoreId from store
        const currentProductStoreId = store.getters["productStore/getCurrent"]?.productStoreId; 
        
        if (jobProductStore?.parameterName && jobProductStore.parameterValue === currentProductStoreId) {
          jobDetails = job;
        } else if (!jobProductStore?.parameterName) {
          jobDetails = { ...job, isDraftJob: true };
        }
      } else {
        jobDetails = job;
      }
    } catch(err) {
      logger.error("Failed to fetch job details", err);
    }

    let fallbackJob = state.jobs.find((job: any) => job.jobName === jobName) || {};

    if (!Object.keys(fallbackJob).length && !Object.keys(jobDetails || {}).length) {
      await fetchJobs();
      fallbackJob = state.jobs.find((job: any) => job.jobName === jobName) || {};
    }

    const job = getJobDetailWithFallback(jobDetails, fallbackJob);
    if (job.instanceOfProductId && !state.products[job.instanceOfProductId]) {
      fetchProductDetail(job.instanceOfProductId);
    }
    return job;
  };

  const fetchJobRuns = async (jobName: string, payload = { pageSize: 250, pageIndex: 0 }) => {
    let jobRuns = [] as any;
    try {
      const resp = await api({
        url: `admin/serviceJobs/${jobName}/runs`,
        method: "GET",
        params: {
          ...payload
        }
      }) as any;
      jobRuns = resp?.data || [];
    } catch(err) {
      logger.error("Failed to fetch job runs", err);
    }
    return Array.isArray(jobRuns) ? jobRuns : [];
  };

  const updateJob = async (payload: any) => {
    return await api({
      url: `admin/serviceJobs/${payload.jobName}`,
      method: "PUT",
      data: payload,
    });
  };

  const runNow = async (jobName: string) => {
    return await api({
      url: `admin/serviceJobs/${jobName}/runNow`,
      method: "POST"
    });
  };

  return {
    ...toRefs(state),
    fetchJobs,
    fetchServiceParams,
    fetchProductDetail,
    fetchJobDetail,
    fetchJobRuns,
    updateJob,
    runNow
  };
}
