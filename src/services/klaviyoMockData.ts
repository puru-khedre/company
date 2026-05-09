// Mock data for the Klaviyo integration UI.
//
// Used when the OMS REST endpoints described in
// `documentation/klaviyo-api-contracts.md` are unavailable (e.g. when running
// against an OMS that hasn't deployed them yet, or in local dev with no
// backend). KlaviyoService falls back to this on 404 / network errors.
//
// Shapes here mirror the documented contracts exactly so the UI behaves
// identically against real and mocked data.

export type CommGatewayAuth = {
  commGatewayAuthId: string;
  commGatewayConfigId: string;
  tenantPartyId: string;
  description: string;
  baseUrl: string;
  authHeaderName: string;
  publicKey: string;
  username?: string | null;
  password?: string | null;
  modeEnumId?: string | null;
  authTypeEnumId?: string | null;
};

export type CommGatewayConfig = {
  commGatewayConfigId: string;
  description: string;
  sendEmailServiceName?: string;
  createEventServiceName?: string;
};

export type ProductStoreEmailSetting = {
  productStoreId: string;
  emailType: string;
  subject: string;
  fromAddress?: string | null;
  systemMessageRemoteId: string;
  gatewayAuthId: string;
};

export type SystemMessageRemote = {
  systemMessageRemoteId: string;
  internalId?: string;
  description?: string;
  sendUrl?: string;
  publicKey?: string;
  authHeaderName?: string;
};

const KLAVIYO_CONFIG: CommGatewayConfig = {
  commGatewayConfigId: "KLAVIYO",
  description: "Klaviyo email and event gateway",
  sendEmailServiceName: "co.hotwax.klaviyo.KlaviyoServices.send#EmailCommunication",
  createEventServiceName: "co.hotwax.klaviyo.KlaviyoServices.create#WorkflowEvent",
};

// In-memory store. Reset on page reload — that is intentional for mock use.
const mockState: {
  unigateConfig: SystemMessageRemote | null;
  auths: CommGatewayAuth[];
  emailSettings: ProductStoreEmailSetting[];
} = {
  unigateConfig: {
    systemMessageRemoteId: "UNIGATE_CONFIG",
    internalId: "DEMO_TENANT",
    description: "Mock Unigate tenant",
    sendUrl: "https://dev-unigate.hotwax.io/rest/s1/unigate/",
    publicKey: "mock-unigate-key",
    authHeaderName: "api_key",
  },
  auths: [
    {
      commGatewayAuthId: "KLAVIYO_DEMO_BRAND_001",
      commGatewayConfigId: "KLAVIYO",
      tenantPartyId: "DEMO_TENANT",
      description: "Demo Brand — production",
      baseUrl: "https://a.klaviyo.com/api/",
      authHeaderName: "Authorization",
      publicKey: "Klaviyo-API-Key pk_demoabcdef0123456789mock",
    },
  ],
  emailSettings: [
    {
      productStoreId: "STORE",
      emailType: "READY_FOR_PICKUP",
      subject: "Your order is ready for pickup",
      fromAddress: "store@demobrand.com",
      systemMessageRemoteId: "UNIGATE_CONFIG",
      gatewayAuthId: "KLAVIYO_DEMO_BRAND_001",
    },
    {
      productStoreId: "STORE",
      emailType: "HANDOVER_BOPIS_ORDER",
      subject: "Thanks for picking up your order",
      fromAddress: "store@demobrand.com",
      systemMessageRemoteId: "UNIGATE_CONFIG",
      gatewayAuthId: "KLAVIYO_DEMO_BRAND_001",
    },
  ],
};

const wrap = <T>(value: T) => Promise.resolve({ data: value, status: 200 } as any);

export const klaviyoMockData = {
  // Tenant readiness
  fetchSystemMessageRemotes: () => {
    const list = mockState.unigateConfig ? [mockState.unigateConfig] : [];
    return wrap(list);
  },

  // Connections
  fetchCommGatewayAuths: () => wrap(mockState.auths.slice()),

  fetchCommGatewayConfigs: () => wrap([KLAVIYO_CONFIG]),

  createCommGatewayAuth: (payload: Partial<CommGatewayAuth>) => {
    const auth: CommGatewayAuth = {
      commGatewayAuthId: payload.commGatewayAuthId || `KLAVIYO_AUTH_${Date.now()}`,
      commGatewayConfigId: payload.commGatewayConfigId || "KLAVIYO",
      tenantPartyId: mockState.unigateConfig?.internalId || "DEMO_TENANT",
      description: payload.description || "",
      baseUrl: payload.baseUrl || "https://a.klaviyo.com/api/",
      authHeaderName: payload.authHeaderName || "Authorization",
      publicKey: payload.publicKey || "",
    };
    mockState.auths.push(auth);
    return wrap(auth);
  },

  updateCommGatewayAuth: (commGatewayAuthId: string, payload: Partial<CommGatewayAuth>) => {
    const idx = mockState.auths.findIndex((a) => a.commGatewayAuthId === commGatewayAuthId);
    if (idx === -1) return Promise.reject({ response: { status: 404, data: { _ERROR_MESSAGE_: "Connection not found" } } });
    mockState.auths[idx] = { ...mockState.auths[idx], ...payload };
    return wrap(mockState.auths[idx]);
  },

  deleteCommGatewayAuth: (commGatewayAuthId: string) => {
    const before = mockState.auths.length;
    mockState.auths = mockState.auths.filter((a) => a.commGatewayAuthId !== commGatewayAuthId);
    mockState.emailSettings = mockState.emailSettings.filter((s) => s.gatewayAuthId !== commGatewayAuthId);
    return wrap({ deleted: before !== mockState.auths.length });
  },

  // Email settings
  fetchEmailSettings: (productStoreId?: string) => {
    const list = productStoreId
      ? mockState.emailSettings.filter((s) => s.productStoreId === productStoreId)
      : mockState.emailSettings.slice();
    return wrap(list);
  },

  fetchEmailSettingsByGateway: (commGatewayAuthId: string) => {
    return wrap(mockState.emailSettings.filter((s) => s.gatewayAuthId === commGatewayAuthId));
  },

  upsertEmailSetting: (payload: ProductStoreEmailSetting) => {
    const idx = mockState.emailSettings.findIndex(
      (s) => s.productStoreId === payload.productStoreId && s.emailType === payload.emailType
    );
    if (idx === -1) mockState.emailSettings.push(payload);
    else mockState.emailSettings[idx] = payload;
    return wrap(payload);
  },

  deleteEmailSetting: (productStoreId: string, emailType: string) => {
    const before = mockState.emailSettings.length;
    mockState.emailSettings = mockState.emailSettings.filter(
      (s) => !(s.productStoreId === productStoreId && s.emailType === emailType)
    );
    return wrap({ deleted: before !== mockState.emailSettings.length });
  },
};
