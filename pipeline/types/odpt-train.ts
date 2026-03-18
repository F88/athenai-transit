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

/**
 * An entry in odpt:stationTimetableObject.
 * All fields are optional per the ODPT API Spec v4.15 Section 3.3.6.
 */
export interface OdptStationTimetableObject {
  'odpt:arrivalTime'?: string;
  'odpt:departureTime'?: string;
  'odpt:originStation'?: string[];
  'odpt:destinationStation'?: string[];
  'odpt:viaStation'?: string[];
  'odpt:trainType'?: string;
  'odpt:trainNumber'?: string;
  'odpt:platformNumber'?: string;
  'odpt:platformName'?: Record<string, string>;
  'odpt:note'?: Record<string, string>;
}

export interface OdptStationTimetable {
  'owl:sameAs': string;
  'dct:issued': string;
  'odpt:station': string;
  'odpt:calendar': string;
  'odpt:railDirection': string;
  'odpt:stationTimetableObject': OdptStationTimetableObject[];
}
