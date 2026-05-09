import api from "@/api";
import logger from "@/logger";
import { klaviyoMockData } from "./klaviyoMockData";
import type {
  CommGatewayAuth,
  CommGatewayConfig,
  ProductStoreEmailSetting,
  SystemMessageRemote,
} from "./klaviyoMockData";

// All Klaviyo backend endpoints are documented in
// `documentation/klaviyo-api-contracts.md`. The functions in this file are the
// single layer that translates Vue components → REST.
//
// The OMS instance behind `dev-maarg` may not yet have the new endpoints
// deployed. To keep the UI usable end-to-end, every function here falls back
// to a local mock layer when the backend returns a recognisable
// "not deployed" error (404, 405, network error). The fallback is purely a
// dev convenience — a banner is shown in the UI when it kicks in.

// Public so the rest of the app (banner, debug menu) can read/toggle.
// QA/dev affordance: visiting any Klaviyo URL with `?mock=1` flips forceMock on
// for the rest of the session so the UI is testable without a live OMS.
const detectForceMock = () => {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mock") === "1") {
      window.sessionStorage?.setItem("klaviyoForceMock", "1");
      return true;
    }
    return window.sessionStorage?.getItem("klaviyoForceMock") === "1";
  } catch {
    return false;
  }
};

export const klaviyoServiceState = {
  // Set to `true` when any call has fallen back to mock data this session.
  mockFallbackTriggered: false,
  // Forces mock mode even when the backend is reachable. Intended for QA.
  forceMock: detectForceMock(),
};

const isNotDeployedError = (error: any) => {
  const status = error?.response?.status;
  if (status === 404 || status === 405 || status === 501) return true;
  // Network-level errors (CORS preflight failures, DNS, etc.).
  if (!error?.response && error?.message) return true;
  return false;
};

const tryReal = async <T>(real: () => Promise<T>, mock: () => Promise<T>): Promise<T> => {
  if (klaviyoServiceState.forceMock) return mock();
  try {
    return await real();
  } catch (error: any) {
    if (isNotDeployedError(error)) {
      klaviyoServiceState.mockFallbackTriggered = true;
      logger.warn("[Klaviyo] backend endpoint unavailable, falling back to mock data", error?.message || error);
      return mock();
    }
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Tenant readiness — UNIGATE_CONFIG check
// ---------------------------------------------------------------------------

// The OMS service returns either a bare array OR `{ systemMessageRemoteList: [...] }`
// depending on which underlying service handles the request. Normalize here.
const unwrapList = (data: any, key?: string): any[] => {
  if (Array.isArray(data)) return data;
  if (key && Array.isArray(data?.[key])) return data[key];
  return [];
};

const fetchSystemMessageRemotes = async (): Promise<SystemMessageRemote[]> => {
  return tryReal(
    async () => {
      const resp: any = await api({ url: "oms/systemMessageRemotes", method: "get" });
      return unwrapList(resp?.data, "systemMessageRemoteList");
    },
    async () => {
      const resp: any = await klaviyoMockData.fetchSystemMessageRemotes();
      return resp.data;
    }
  );
};

const fetchUnigateConfig = async (): Promise<SystemMessageRemote | null> => {
  const remotes = await fetchSystemMessageRemotes();
  return remotes.find((r: any) => r?.systemMessageRemoteId === "UNIGATE_CONFIG") || null;
};

// ---------------------------------------------------------------------------
// CommGatewayAuth (Klaviyo connections)
// ---------------------------------------------------------------------------

const fetchCommGatewayAuths = async (): Promise<CommGatewayAuth[]> => {
  return tryReal(
    async () => {
      const resp: any = await api({ url: "oms/commGatewayAuths", method: "get" });
      return unwrapList(resp?.data, "commAuthList");
    },
    async () => {
      const resp: any = await klaviyoMockData.fetchCommGatewayAuths();
      return resp.data;
    }
  );
};

const fetchCommGatewayConfigs = async (): Promise<CommGatewayConfig[]> => {
  return tryReal(
    async () => {
      const resp: any = await api({ url: "oms/commGatewayConfigs", method: "get" });
      return unwrapList(resp?.data, "commConfigList");
    },
    async () => {
      const resp: any = await klaviyoMockData.fetchCommGatewayConfigs();
      return resp.data;
    }
  );
};

const createCommGatewayAuth = async (payload: Partial<CommGatewayAuth>): Promise<CommGatewayAuth> => {
  return tryReal(
    async () => {
      const resp: any = await api({ url: "oms/commGatewayAuths", method: "post", data: payload });
      return resp.data;
    },
    async () => {
      const resp: any = await klaviyoMockData.createCommGatewayAuth(payload);
      return resp.data;
    }
  );
};

const updateCommGatewayAuth = async (commGatewayAuthId: string, payload: Partial<CommGatewayAuth>): Promise<CommGatewayAuth> => {
  return tryReal(
    async () => {
      const resp: any = await api({
        url: `oms/commGatewayAuths/${encodeURIComponent(commGatewayAuthId)}`,
        method: "put",
        data: payload,
      });
      return resp.data;
    },
    async () => {
      const resp: any = await klaviyoMockData.updateCommGatewayAuth(commGatewayAuthId, payload);
      return resp.data;
    }
  );
};

const deleteCommGatewayAuth = async (commGatewayAuthId: string): Promise<void> => {
  return tryReal(
    async () => {
      await api({
        url: `oms/commGatewayAuths/${encodeURIComponent(commGatewayAuthId)}`,
        method: "delete",
      });
    },
    async () => {
      await klaviyoMockData.deleteCommGatewayAuth(commGatewayAuthId);
    }
  );
};

// ---------------------------------------------------------------------------
// ProductStoreEmailSetting
// ---------------------------------------------------------------------------

const fetchEmailSettingsForStore = async (productStoreId: string): Promise<ProductStoreEmailSetting[]> => {
  return tryReal(
    async () => {
      const resp: any = await api({
        url: `oms/productStoreEmailSettings/${encodeURIComponent(productStoreId)}/emailSettings`,
        method: "get",
      });
      return Array.isArray(resp?.data) ? resp.data : [];
    },
    async () => {
      const resp: any = await klaviyoMockData.fetchEmailSettings(productStoreId);
      return resp.data;
    }
  );
};

const fetchAllEmailSettings = async (): Promise<ProductStoreEmailSetting[]> => {
  return tryReal(
    async () => {
      const resp: any = await api({ url: "oms/productStoreEmailSettings", method: "get" });
      return Array.isArray(resp?.data) ? resp.data : [];
    },
    async () => {
      const resp: any = await klaviyoMockData.fetchEmailSettings();
      return resp.data;
    }
  );
};

const upsertEmailSetting = async (payload: ProductStoreEmailSetting): Promise<ProductStoreEmailSetting> => {
  return tryReal(
    async () => {
      const resp: any = await api({
        url: `oms/productStoreEmailSettings/${encodeURIComponent(payload.productStoreId)}/emailSettings`,
        method: "post",
        data: payload,
      });
      return resp.data || payload;
    },
    async () => {
      const resp: any = await klaviyoMockData.upsertEmailSetting(payload);
      return resp.data;
    }
  );
};

const deleteEmailSetting = async (productStoreId: string, emailType: string): Promise<void> => {
  return tryReal(
    async () => {
      await api({
        url: `oms/productStoreEmailSettings/${encodeURIComponent(productStoreId)}/emailSettings/${encodeURIComponent(emailType)}`,
        method: "delete",
      });
    },
    async () => {
      await klaviyoMockData.deleteEmailSetting(productStoreId, emailType);
    }
  );
};

// Email-type enumerations are not fetched here. They live in the existing
// `util` Vuex module (action: `util/fetchEmailTypes`, getter: `util/getEmailTypes`)
// which calls the existing `admin/enums?enumTypeId=PRDS_EMAIL` endpoint and
// caches per-session like every other enum the app uses.

// ---------------------------------------------------------------------------
// Helpers — formatting + ID generation
// ---------------------------------------------------------------------------

const KLAVIYO_KEY_PREFIX = "Klaviyo-API-Key ";

const stripKeyPrefix = (publicKey?: string | null) => {
  if (!publicKey) return "";
  return publicKey.startsWith(KLAVIYO_KEY_PREFIX) ? publicKey.slice(KLAVIYO_KEY_PREFIX.length) : publicKey;
};

const ensureKeyPrefix = (rawKey: string) => {
  const trimmed = (rawKey || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith(KLAVIYO_KEY_PREFIX) ? trimmed : `${KLAVIYO_KEY_PREFIX}${trimmed}`;
};

// `••••••••wxyz` style mask. The underlying value never leaves the service.
const maskApiKey = (publicKey?: string | null) => {
  const stripped = stripKeyPrefix(publicKey);
  if (!stripped) return "";
  if (stripped.length <= 4) return "•".repeat(stripped.length);
  const tail = stripped.slice(-4);
  return `${"•".repeat(8)}${tail}`;
};

const slugify = (input: string) => {
  return (input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
};

const generateAuthId = (description: string) => {
  const slug = slugify(description) || "BRAND";
  const id = `KLAVIYO_${slug}_${Date.now()}`;
  return id.slice(0, 60);
};

export const KlaviyoService = {
  // Tenant
  fetchSystemMessageRemotes,
  fetchUnigateConfig,
  // CommGatewayAuth
  fetchCommGatewayAuths,
  fetchCommGatewayConfigs,
  createCommGatewayAuth,
  updateCommGatewayAuth,
  deleteCommGatewayAuth,
  // Email settings
  fetchEmailSettingsForStore,
  fetchAllEmailSettings,
  upsertEmailSetting,
  deleteEmailSetting,
  // Helpers
  stripKeyPrefix,
  ensureKeyPrefix,
  maskApiKey,
  generateAuthId,
  slugify,
  KLAVIYO_KEY_PREFIX,
};

export type { CommGatewayAuth, CommGatewayConfig, ProductStoreEmailSetting, SystemMessageRemote };
