/**
 * ODPT Train API response types.
 *
 * These interfaces represent the JSON structures returned by the
 * ODPT Train API (Chapter 3 of the ODPT API Specification v4.15).
 *
 * @see https://developer.odpt.org/documents
 */

export interface OdptStationTitle {
  ja: string;
  en: string;
  ko?: string;
  'zh-Hans'?: string;
}

export interface OdptStation {
  'owl:sameAs': string;
  'dc:date': string;
  'geo:lat': number;
  'geo:long': number;
  'odpt:stationCode': string;
  'odpt:stationTitle': OdptStationTitle;
}

export interface OdptStationOrder {
  'odpt:index': number;
  'odpt:station': string;
  'odpt:stationTitle': OdptStationTitle;
}

export interface OdptRailway {
  'dc:date': string;
  'dc:title': string;
  'odpt:color': string;
  'odpt:lineCode': string;
  'odpt:railwayTitle': OdptStationTitle;
  'odpt:stationOrder': OdptStationOrder[];
}

export interface OdptTimetableObject {
  'odpt:departureTime': string;
  'odpt:destinationStation': string[];
}

export interface OdptStationTimetable {
  'owl:sameAs': string;
  'dct:issued': string;
  'odpt:station': string;
  'odpt:calendar': string;
  'odpt:railDirection': string;
  'odpt:stationTimetableObject': OdptTimetableObject[];
}
