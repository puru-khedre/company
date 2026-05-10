import { ActionTree } from "vuex"
import RootState from "@/store/RootState"
import * as types from "./mutation-types"
import { hasError } from "@/utils"
import logger from "@/logger"
import UtilState from "./UtilState"
import { UtilService } from "@/services/UtilService"
import api from "@/api"

const actions: ActionTree<UtilState, RootState> = {

  async fetchFacilityGroups({ commit }) {
    commit(types.UTIL_FETCH_STATUS_UPDATED, { facilityGroups: 'pending' })
    let facilityGroups = [] as any, pageIndex = 0, resp;

    try {
      do {
        resp = await UtilService.fetchFacilityGroups({ pageSize: 100, pageIndex });

        if(!hasError(resp)) {
          facilityGroups = facilityGroups.concat(resp.data);
        } else {
          throw resp.data;
        }
        pageIndex++;
      } while (resp.data.length >= 100);
      commit(types.UTIL_FETCH_STATUS_UPDATED, { facilityGroups: 'success', lastFetched: Date.now() })
    } catch(error: any) {
      logger.error(error);
      commit(types.UTIL_FETCH_STATUS_UPDATED, { facilityGroups: 'error' })
    }
    commit(types.UTIL_FACILITY_GROUPS_UPDATED, facilityGroups);
  },
  
  async fetchFacilities({ commit }) {
    commit(types.UTIL_FETCH_STATUS_UPDATED, { facilities: 'pending' })
    let facilities = [] as any, pageIndex = 0, resp;

    try {
      do {
        resp = await UtilService.fetchFacilities({
          facilityTypeId: "VIRTUAL_FACILITY",
          facilityTypeId_not: "Y",
          parentTypeId: "VIRTUAL_FACILITY",
          parentTypeId_not: "Y",
          pageSize: 100,
          pageIndex
        })

        if(!hasError(resp) && resp.data) {
          facilities = facilities.concat(resp.data.filter((facility: any) => facility.externalId));
        } else {
          throw resp.data
        }
        pageIndex++;
      } while (resp.data.length >= 100);
      commit(types.UTIL_FETCH_STATUS_UPDATED, { facilities: 'success', lastFetched: Date.now() })
    } catch (error) {
      logger.error(error);
      commit(types.UTIL_FETCH_STATUS_UPDATED, { facilities: 'error' })
    }
    commit(types.UTIL_FACILITIES_UPDATED, facilities)
  },
  
  async fetchDBICCountries({ commit }) {
    commit(types.UTIL_FETCH_STATUS_UPDATED, { dbicCountries: 'pending' })
    let countries = [] as any;

    try {
      const resp = await UtilService.fetchDBICCountries({toGeoId: "DBIC", pageSize: 200 })
      if(!hasError(resp)) {
        countries = resp.data;
        commit(types.UTIL_FETCH_STATUS_UPDATED, { dbicCountries: 'success', lastFetched: Date.now() })
      } else {
        throw resp.data;
      }
    } catch(error: any) {
      logger.error(error);
      commit(types.UTIL_FETCH_STATUS_UPDATED, { dbicCountries: 'error' })
    }
    commit(types.UTIL_DBIC_COUNTRIES_UPDATED, { list: countries, total: countries.length })
  },

  async fetchOperatingCountries({ commit, state }) {
    if(state.operatingCountries.length) return;
    commit(types.UTIL_FETCH_STATUS_UPDATED, { operatingCountries: 'pending' })

    let operatingCountries = [] as any;

    try {
      const resp = await UtilService.fetchOperatingCountries({ pageSize: 300, geoTypeEnumId: 'GEOT_COUNTRY' })
      if(!hasError(resp)) {
        operatingCountries = resp.data;
        commit(types.UTIL_FETCH_STATUS_UPDATED, { operatingCountries: 'success', lastFetched: Date.now() })
      } else {
        throw resp.data;
      }
    } catch(error: any) {
      logger.error(error);
      commit(types.UTIL_FETCH_STATUS_UPDATED, { operatingCountries: 'error' })
    }
    commit(types.UTIL_OPERATING_COUNTRIES_UPDATED, operatingCountries)
  },

  async fetchProductIdentifiers({ commit, state }) {
    if(state.productIdentifiers.length) return;
    commit(types.UTIL_FETCH_STATUS_UPDATED, { productIdentifiers: 'pending' })

    let productIdentifiers = [] as any;

    try {
      const resp = await UtilService.fetchEnums({ enumTypeId: "SHOP_PROD_IDENTITY", pageSize: 100 })
      if(!hasError(resp)) {
        productIdentifiers = resp.data;
        commit(types.UTIL_FETCH_STATUS_UPDATED, { productIdentifiers: 'success', lastFetched: Date.now() })
      } else {
        throw resp.data;
      }
    } catch(error: any) {
      logger.error(error);
      commit(types.UTIL_FETCH_STATUS_UPDATED, { productIdentifiers: 'error' })
    }
    commit(types.UTIL_PRODUCT_IDENTIFIERS_UPDATED, productIdentifiers)
  },

  async fetchEmailTypes({ commit, state }) {
    if(state.emailTypes.length) return;
    commit(types.UTIL_FETCH_STATUS_UPDATED, { emailTypes: 'pending' })

    let emailTypes = [] as any;

    try {
      const resp = await UtilService.fetchEnums({ enumTypeId: "PRDS_EMAIL", pageSize: 100 })
      if(!hasError(resp)) {
        emailTypes = resp.data;
        commit(types.UTIL_FETCH_STATUS_UPDATED, { emailTypes: 'success', lastFetched: Date.now() })
      } else {
        throw resp.data;
      }
    } catch(error: any) {
      logger.error(error);
      commit(types.UTIL_FETCH_STATUS_UPDATED, { emailTypes: 'error' })
    }
    commit(types.UTIL_EMAIL_TYPES_UPDATED, emailTypes)
  },

  async fetchShipmentMethodTypes({ commit, state }) {
    if(state.shipmentMethodTypes.length) return;
    commit(types.UTIL_FETCH_STATUS_UPDATED, { shipmentMethodTypes: 'pending' })

    let shipmentMethodTypes = [] as any, pageIndex = 0, resp;

    try {
      do {
        resp = await UtilService.fetchShipmentMethodTypes({ pageSize: 100, pageIndex });

        if(!hasError(resp)) {
          shipmentMethodTypes = shipmentMethodTypes.concat(resp.data);
        } else {
          throw resp.data;
        }
        pageIndex++;
      } while (resp.data.length >= 100);
      commit(types.UTIL_FETCH_STATUS_UPDATED, { shipmentMethodTypes: 'success', lastFetched: Date.now() })
    } catch (error: any) {
      logger.error(error);
      commit(types.UTIL_FETCH_STATUS_UPDATED, { shipmentMethodTypes: 'error' })
    }
    commit(types.UTIL_SHIPMENT_METHOD_TYPES_UPDATED, shipmentMethodTypes)
  },

  async fetchOrganizationPartyId({ commit }) {
    commit(types.UTIL_FETCH_STATUS_UPDATED, { organizationPartyId: 'pending' })
    let partyId = ""

    try {
      const resp = await UtilService.fetchOrganization({
        roleTypeId: 'INTERNAL_ORGANIZATIO',
        pageSize: 1
      })

      if(!hasError(resp)) {
        partyId = resp.data[0]?.partyId
        commit(types.UTIL_FETCH_STATUS_UPDATED, { organizationPartyId: 'success', lastFetched: Date.now() })
      } else {
        throw resp.data
      }
    } catch (error) {
      logger.error(error)
      commit(types.UTIL_FETCH_STATUS_UPDATED, { organizationPartyId: 'error' })
    }
    commit(types.UTIL_ORGANIZATION_PARTY_ID_UPDATED, partyId)
  },

  async fetchStatusItems({ commit }) {
    commit(types.UTIL_FETCH_STATUS_UPDATED, { statuses: 'pending' })
    let statusItems = {} as any;

    try {
      const resp = await UtilService.fetchStatusItems({
        pageSize: 1000
      })

      if(!hasError(resp) && resp.data) {
        statusItems = resp.data.reduce((items: any, item: any) => {
          items[item.statusId] = item;
          return items;
        }, {});
        commit(types.UTIL_FETCH_STATUS_UPDATED, { statuses: 'success', lastFetched: Date.now() })
      } else {
        throw resp.data
      }
    } catch (error) {
      logger.error(error)
      commit(types.UTIL_FETCH_STATUS_UPDATED, { statuses: 'error' })
    }
    commit(types.UTIL_STATUS_ITEMS_UPDATED, statusItems)
  },

  // /admin/maarg returns the OMS instance metadata (instancePurpose,
  // componentRelease, deployed component versions, etc.). The values are
  // stable for the lifetime of a session, so this action is idempotent —
  // callers can dispatch it freely and only the first call hits the API.
  async fetchMaargInfo({ commit, state }) {
    if (state.maargInfo) return
    if (state.fetchStatus.maargInfo === 'pending') return
    commit(types.UTIL_FETCH_STATUS_UPDATED, { maargInfo: 'pending' })
    try {
      const resp: any = await api({ url: "admin/maarg", method: "get" })
      if (resp?.data && typeof resp.data === 'object' && !hasError(resp)) {
        commit(types.UTIL_MAARG_INFO_UPDATED, resp.data)
        commit(types.UTIL_FETCH_STATUS_UPDATED, { maargInfo: 'success', lastFetched: Date.now() })
      } else {
        commit(types.UTIL_FETCH_STATUS_UPDATED, { maargInfo: 'error' })
      }
    } catch (error) {
      logger.warn("Failed to fetch maarg info", error)
      commit(types.UTIL_FETCH_STATUS_UPDATED, { maargInfo: 'error' })
    }
  },

  async clearUtilState({ commit }) {
    commit(types.UTIL_CLEARED)
    commit(types.UTIL_ORGANIZATION_PARTY_ID_UPDATED, "")
    commit(types.UTIL_MAARG_INFO_UPDATED, null)
  }
}

export default actions;