export default interface UtilState {
  facilityGroups: any;
  facilities: any[];
  operatingCountries: any;
  dbicCountries: any;
  productIdentifiers: any;
  shipmentMethodTypes: any;
  organizationPartyId: string;
  statusItems: any;
  fetchStatus: {
    facilities: string;
    statuses: string;
    organizationPartyId: string;
    facilityGroups: string;
    dbicCountries: string;
    operatingCountries: string;
    productIdentifiers: string;
    shipmentMethodTypes: string;
    lastFetched: number;
  };
}