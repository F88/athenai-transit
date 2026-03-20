import { describe, expect, it } from 'vitest';
import { splitCsvLine } from '../gtfs-csv-parser';

describe('splitCsvLine', () => {
  // --- Basic cases ---

  it('splits simple comma-separated fields', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('returns single field for no commas', () => {
    expect(splitCsvLine('hello')).toEqual(['hello']);
  });

  it('returns single empty string for empty input', () => {
    expect(splitCsvLine('')).toEqual(['']);
  });

  // --- Empty fields ---

  it('handles empty fields between commas', () => {
    expect(splitCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });

  it('handles trailing comma (produces empty final field)', () => {
    expect(splitCsvLine('a,b,')).toEqual(['a', 'b', '']);
  });

  it('handles leading comma (produces empty first field)', () => {
    expect(splitCsvLine(',b,c')).toEqual(['', 'b', 'c']);
  });

  it('handles all empty fields', () => {
    expect(splitCsvLine(',,')).toEqual(['', '', '']);
  });

  // --- Quoted fields ---

  it('handles quoted fields', () => {
    expect(splitCsvLine('"a","b","c"')).toEqual(['a', 'b', 'c']);
  });

  it('handles commas inside quoted fields', () => {
    expect(splitCsvLine('"a,b",c')).toEqual(['a,b', 'c']);
  });

  it('handles escaped quotes (doubled) inside quoted fields', () => {
    expect(splitCsvLine('"say ""hello""",b')).toEqual(['say "hello"', 'b']);
  });

  it('handles empty quoted field', () => {
    expect(splitCsvLine('"",b')).toEqual(['', 'b']);
  });

  it('handles quoted field with only escaped quote', () => {
    expect(splitCsvLine('"""",b')).toEqual(['"', 'b']);
  });

  // --- Mixed quoted and unquoted ---

  it('handles mix of quoted and unquoted fields', () => {
    expect(splitCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('handles quoted field at end', () => {
    expect(splitCsvLine('a,"b"')).toEqual(['a', 'b']);
  });

  it('handles quoted field at start', () => {
    expect(splitCsvLine('"a",b')).toEqual(['a', 'b']);
  });

  // --- GTFS-realistic cases ---

  it('parses typical GTFS header line', () => {
    expect(splitCsvLine('stop_id,stop_name,stop_lat,stop_lon')).toEqual([
      'stop_id',
      'stop_name',
      'stop_lat',
      'stop_lon',
    ]);
  });

  it('parses GTFS data with quoted stop name containing comma', () => {
    expect(splitCsvLine('S001,"Shibuya, Tokyo",35.6580,139.7016')).toEqual([
      'S001',
      'Shibuya, Tokyo',
      '35.6580',
      '139.7016',
    ]);
  });

  it('parses GTFS translations with quoted Japanese text', () => {
    expect(splitCsvLine('stops,stop_name,ja,"渋谷駅",S001')).toEqual([
      'stops',
      'stop_name',
      'ja',
      '渋谷駅',
      'S001',
    ]);
  });
});
