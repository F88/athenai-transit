/**
 * GTFS database schema definitions.
 *
 * Covers GTFS Static (gtfs.org) + GTFS-JP v3 — 34 tables total.
 * Tables are listed in FK dependency order (independent → dependent).
 *
 * ## Design decisions (intentional deviations from the GTFS spec)
 *
 * ### 1. PK omission on join/multi-row tables
 *
 * GTFS spec defines composite PKs for some tables (e.g. frequencies,
 * fare_products), but we omit them to tolerate duplicate rows in
 * real-world feeds. PK in SQLite implies NOT NULL + UNIQUE; violating
 * either causes INSERT to fail and aborts the import. Tables with a
 * single natural ID column (e.g. agency, stops, routes) do have PKs.
 *
 * Affected: frequencies, fare_products, fare_leg_rules,
 * fare_leg_join_rules, fare_transfer_rules.
 *
 * ### 2. nullable over NOT NULL for GTFS-JP v3 compatibility
 *
 * Columns that are Required in the latest GTFS spec but absent in
 * GTFS-JP v3 are kept nullable. If a column is NOT NULL and the CSV
 * lacks it entirely, the import aborts (see GTFS_TO_RDB.md). Making
 * new GTFS columns nullable ensures older GTFS-JP feeds import
 * without error.
 *
 * ### 3. Forward-reference FKs (table creation order)
 *
 * Some FK relationships reference tables created later in the
 * dependency chain. SQLite accepts these declarations when
 * foreign_keys is OFF (our import mode).
 *
 * ### 4. FK omissions due to composite/missing unique keys
 *
 * fare_products has no single-column unique key (its spec PK is
 * composite), so tables referencing fare_product_id cannot declare
 * an FK in SQLite. Noted inline.
 *
 * ### 5. service_id FK omitted (calendar_dates-only feeds)
 *
 * GTFS core specifies calendar.txt and calendar_dates.txt as both
 * conditionally required — either one is sufficient. Some feeds use
 * calendar_dates-only (no calendar.txt rows for a given service_id).
 * Declaring trips.service_id → calendar(service_id) would flag these
 * feeds as violations even though they are spec-compliant. FK is
 * therefore omitted for service_id columns. Data quality for
 * service_id references is validated in the JSON build step instead.
 */

// ---------------------------------------------------------------------------
// CREATE TABLE statements
// ---------------------------------------------------------------------------

export const SCHEMA: string[] = [
  // =========================================================================
  // Independent tables (no FK dependencies)
  // =========================================================================

  // agency.txt
  `CREATE TABLE IF NOT EXISTS agency (
    agency_id    TEXT PRIMARY KEY,
    agency_name  TEXT NOT NULL,
    agency_url   TEXT NOT NULL,
    agency_timezone TEXT NOT NULL,
    agency_lang  TEXT,
    agency_phone TEXT,
    agency_fare_url TEXT,
    agency_email TEXT
  )`,

  // agency_jp.txt (GTFS-JP)
  `CREATE TABLE IF NOT EXISTS agency_jp (
    agency_id              TEXT PRIMARY KEY,
    agency_official_name   TEXT,
    agency_zip_number      TEXT,
    agency_address         TEXT,
    agency_president_pos   TEXT,
    agency_president_name  TEXT,
    FOREIGN KEY (agency_id) REFERENCES agency(agency_id)
  )`,

  // calendar.txt
  `CREATE TABLE IF NOT EXISTS calendar (
    service_id TEXT PRIMARY KEY,
    monday     INTEGER NOT NULL,
    tuesday    INTEGER NOT NULL,
    wednesday  INTEGER NOT NULL,
    thursday   INTEGER NOT NULL,
    friday     INTEGER NOT NULL,
    saturday   INTEGER NOT NULL,
    sunday     INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date   TEXT NOT NULL
  )`,

  // calendar_dates.txt
  `CREATE TABLE IF NOT EXISTS calendar_dates (
    service_id     TEXT NOT NULL,
    date           TEXT NOT NULL,
    exception_type INTEGER NOT NULL,
    PRIMARY KEY (service_id, date)
    -- no FK: GTFS core allows calendar_dates-only service_ids (calendar.txt is conditionally required)
  )`,

  // levels.txt
  `CREATE TABLE IF NOT EXISTS levels (
    level_id    TEXT PRIMARY KEY,
    level_index REAL NOT NULL,
    level_name  TEXT
  )`,

  // stops.txt
  `CREATE TABLE IF NOT EXISTS stops (
    stop_id            TEXT PRIMARY KEY,
    stop_code          TEXT,
    stop_name          TEXT NOT NULL,
    stop_desc          TEXT,
    stop_lat           REAL NOT NULL,
    stop_lon           REAL NOT NULL,
    zone_id            TEXT,
    stop_url           TEXT,
    location_type      INTEGER,
    parent_station     TEXT,
    stop_timezone      TEXT,
    wheelchair_boarding INTEGER,
    platform_code      TEXT,
    tts_stop_name      TEXT,
    level_id           TEXT,
    stop_access        TEXT,
    FOREIGN KEY (parent_station) REFERENCES stops(stop_id),
    FOREIGN KEY (level_id) REFERENCES levels(level_id)
  )`,

  // routes.txt
  // network_id → networks(network_id): forward-reference FK (see design decision 3)
  `CREATE TABLE IF NOT EXISTS routes (
    route_id           TEXT PRIMARY KEY,
    agency_id          TEXT,
    route_short_name   TEXT,
    route_long_name    TEXT,
    route_desc         TEXT,
    route_type         INTEGER NOT NULL,
    route_url          TEXT,
    route_color        TEXT,
    route_text_color   TEXT,
    route_sort_order   INTEGER,
    continuous_pickup  INTEGER,
    continuous_drop_off INTEGER,
    network_id         TEXT,
    jp_parent_route_id TEXT,
    FOREIGN KEY (agency_id) REFERENCES agency(agency_id),
    FOREIGN KEY (network_id) REFERENCES networks(network_id)
  )`,

  // =========================================================================
  // Dependent tables
  // =========================================================================

  // trips.txt
  `CREATE TABLE IF NOT EXISTS trips (
    route_id              TEXT NOT NULL,
    service_id            TEXT NOT NULL,
    trip_id               TEXT PRIMARY KEY,
    trip_headsign         TEXT,
    trip_short_name       TEXT,
    direction_id          INTEGER,
    block_id              TEXT,
    shape_id              TEXT,
    wheelchair_accessible INTEGER,
    bikes_allowed         INTEGER,
    cars_allowed          INTEGER,
    jp_trip_desc          TEXT,
    jp_trip_desc_symbol   TEXT,
    jp_office_id          TEXT,
    jp_pattern_id         TEXT,
    FOREIGN KEY (route_id) REFERENCES routes(route_id)
    -- no FK on service_id: GTFS core allows calendar_dates-only service_ids
  )`,

  // stop_times.txt
  // location_group_id, pickup_booking_rule_id, drop_off_booking_rule_id:
  // forward-reference FKs (see design decision 3)
  `CREATE TABLE IF NOT EXISTS stop_times (
    trip_id                          TEXT NOT NULL,
    arrival_time                     TEXT,
    departure_time                   TEXT,
    stop_id                          TEXT NOT NULL,
    stop_sequence                    INTEGER NOT NULL,
    stop_headsign                    TEXT,
    pickup_type                      INTEGER,
    drop_off_type                    INTEGER,
    shape_dist_traveled              REAL,
    timepoint                        INTEGER,
    location_group_id                TEXT,
    location_id                      TEXT,
    start_pickup_drop_off_window     TEXT,
    end_pickup_drop_off_window       TEXT,
    continuous_pickup                INTEGER,
    continuous_drop_off              INTEGER,
    pickup_booking_rule_id           TEXT,
    drop_off_booking_rule_id         TEXT,
    PRIMARY KEY (trip_id, stop_sequence),
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id),
    FOREIGN KEY (stop_id) REFERENCES stops(stop_id),
    FOREIGN KEY (location_group_id) REFERENCES location_groups(location_group_id),
    FOREIGN KEY (pickup_booking_rule_id) REFERENCES booking_rules(booking_rule_id),
    FOREIGN KEY (drop_off_booking_rule_id) REFERENCES booking_rules(booking_rule_id)
  )`,

  // shapes.txt
  `CREATE TABLE IF NOT EXISTS shapes (
    shape_id            TEXT NOT NULL,
    shape_pt_lat        REAL NOT NULL,
    shape_pt_lon        REAL NOT NULL,
    shape_pt_sequence   INTEGER NOT NULL,
    shape_dist_traveled REAL,
    PRIMARY KEY (shape_id, shape_pt_sequence)
  )`,

  // fare_attributes.txt
  `CREATE TABLE IF NOT EXISTS fare_attributes (
    fare_id           TEXT PRIMARY KEY,
    price             REAL NOT NULL,
    ic_price          REAL,
    currency_type     TEXT NOT NULL,
    payment_method    INTEGER NOT NULL,
    transfers         INTEGER,
    agency_id         TEXT,
    transfer_duration INTEGER,
    FOREIGN KEY (agency_id) REFERENCES agency(agency_id)
  )`,

  // fare_rules.txt
  `CREATE TABLE IF NOT EXISTS fare_rules (
    fare_id        TEXT NOT NULL,
    route_id       TEXT,
    origin_id      TEXT,
    destination_id TEXT,
    contains_id    TEXT,
    FOREIGN KEY (fare_id) REFERENCES fare_attributes(fare_id),
    FOREIGN KEY (route_id) REFERENCES routes(route_id)
  )`,

  // feed_info.txt
  `CREATE TABLE IF NOT EXISTS feed_info (
    feed_publisher_name TEXT NOT NULL,
    feed_publisher_url  TEXT NOT NULL,
    feed_lang           TEXT NOT NULL,
    feed_start_date     TEXT,
    feed_end_date       TEXT,
    feed_version        TEXT,
    default_lang        TEXT,
    feed_contact_email  TEXT,
    feed_contact_url    TEXT
  )`,

  // translations.txt
  `CREATE TABLE IF NOT EXISTS translations (
    table_name      TEXT NOT NULL,
    field_name      TEXT NOT NULL,
    language        TEXT NOT NULL,
    translation     TEXT NOT NULL,
    record_id       TEXT,
    record_sub_id   TEXT,
    record_sequence TEXT,
    field_value     TEXT
  )`,

  // attributions.txt
  `CREATE TABLE IF NOT EXISTS attributions (
    attribution_id    TEXT,
    agency_id         TEXT,
    route_id          TEXT,
    trip_id           TEXT,
    organization_name TEXT NOT NULL,
    is_producer       INTEGER,
    is_operator       INTEGER,
    is_authority      INTEGER,
    is_data_source    INTEGER,
    attribution_url   TEXT,
    attribution_email TEXT,
    attribution_phone TEXT,
    FOREIGN KEY (agency_id) REFERENCES agency(agency_id),
    FOREIGN KEY (route_id) REFERENCES routes(route_id),
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id)
  )`,

  // office_jp.txt (GTFS-JP)
  `CREATE TABLE IF NOT EXISTS office_jp (
    office_id    TEXT PRIMARY KEY,
    office_name  TEXT,
    office_url   TEXT,
    office_phone TEXT
  )`,

  // pathways.txt
  `CREATE TABLE IF NOT EXISTS pathways (
    pathway_id         TEXT PRIMARY KEY,
    from_stop_id       TEXT NOT NULL,
    to_stop_id         TEXT NOT NULL,
    pathway_mode       INTEGER NOT NULL,
    is_bidirectional   INTEGER NOT NULL,
    length             REAL,
    traversal_time     INTEGER,
    stair_count        INTEGER,
    max_slope          REAL,
    min_width          REAL,
    signposted_as      TEXT,
    reverse_signposted_as TEXT,
    FOREIGN KEY (from_stop_id) REFERENCES stops(stop_id),
    FOREIGN KEY (to_stop_id) REFERENCES stops(stop_id)
  )`,

  // frequencies.txt
  // Spec PK: (trip_id, start_time) — omitted (see design decision 1)
  `CREATE TABLE IF NOT EXISTS frequencies (
    trip_id      TEXT NOT NULL,
    start_time   TEXT NOT NULL,
    end_time     TEXT NOT NULL,
    headway_secs INTEGER NOT NULL,
    exact_times  INTEGER,
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id)
  )`,

  // transfers.txt
  `CREATE TABLE IF NOT EXISTS transfers (
    from_stop_id      TEXT,
    to_stop_id        TEXT,
    from_route_id     TEXT,
    to_route_id       TEXT,
    from_trip_id      TEXT,
    to_trip_id        TEXT,
    transfer_type     INTEGER NOT NULL,
    min_transfer_time INTEGER,
    FOREIGN KEY (from_stop_id) REFERENCES stops(stop_id),
    FOREIGN KEY (to_stop_id) REFERENCES stops(stop_id),
    FOREIGN KEY (from_route_id) REFERENCES routes(route_id),
    FOREIGN KEY (to_route_id) REFERENCES routes(route_id),
    FOREIGN KEY (from_trip_id) REFERENCES trips(trip_id),
    FOREIGN KEY (to_trip_id) REFERENCES trips(trip_id)
  )`,

  // pattern_jp.txt (GTFS-JP v3)
  `CREATE TABLE IF NOT EXISTS pattern_jp (
    jp_pattern_id     TEXT PRIMARY KEY,
    route_update_date TEXT,
    origin_stop       TEXT,
    via_stop          TEXT,
    destination_stop  TEXT
  )`,

  // areas.txt
  `CREATE TABLE IF NOT EXISTS areas (
    area_id   TEXT PRIMARY KEY,
    area_name TEXT
  )`,

  // stop_areas.txt
  `CREATE TABLE IF NOT EXISTS stop_areas (
    area_id TEXT NOT NULL,
    stop_id TEXT NOT NULL,
    FOREIGN KEY (area_id) REFERENCES areas(area_id),
    FOREIGN KEY (stop_id) REFERENCES stops(stop_id)
  )`,

  // networks.txt
  `CREATE TABLE IF NOT EXISTS networks (
    network_id   TEXT PRIMARY KEY,
    network_name TEXT
  )`,

  // route_networks.txt
  `CREATE TABLE IF NOT EXISTS route_networks (
    network_id TEXT NOT NULL,
    route_id   TEXT NOT NULL,
    FOREIGN KEY (network_id) REFERENCES networks(network_id),
    FOREIGN KEY (route_id) REFERENCES routes(route_id)
  )`,

  // location_groups.txt
  `CREATE TABLE IF NOT EXISTS location_groups (
    location_group_id   TEXT PRIMARY KEY,
    location_group_name TEXT
  )`,

  // location_group_stops.txt
  `CREATE TABLE IF NOT EXISTS location_group_stops (
    location_group_id TEXT NOT NULL,
    stop_id           TEXT NOT NULL,
    FOREIGN KEY (location_group_id) REFERENCES location_groups(location_group_id),
    FOREIGN KEY (stop_id) REFERENCES stops(stop_id)
  )`,

  // booking_rules.txt
  `CREATE TABLE IF NOT EXISTS booking_rules (
    booking_rule_id            TEXT PRIMARY KEY,
    booking_type               INTEGER NOT NULL,
    prior_notice_duration_min  INTEGER,
    prior_notice_duration_max  INTEGER,
    prior_notice_last_day      INTEGER,
    prior_notice_last_time     TEXT,
    prior_notice_start_day     INTEGER,
    prior_notice_start_time    TEXT,
    prior_notice_service_id    TEXT,
    message                    TEXT,
    pickup_message             TEXT,
    drop_off_message           TEXT,
    phone_number               TEXT,
    info_url                   TEXT,
    booking_url                TEXT
    -- no FK on prior_notice_service_id: GTFS core allows calendar_dates-only service_ids
  )`,

  // =========================================================================
  // GTFS Fares v2
  // =========================================================================

  // timeframes.txt
  `CREATE TABLE IF NOT EXISTS timeframes (
    timeframe_group_id TEXT NOT NULL,
    start_time         TEXT,
    end_time           TEXT,
    service_id         TEXT,
    FOREIGN KEY (service_id) REFERENCES calendar(service_id)
  )`,

  // rider_categories.txt
  `CREATE TABLE IF NOT EXISTS rider_categories (
    rider_category_id          TEXT PRIMARY KEY,
    rider_category_name        TEXT NOT NULL,
    is_default_fare_category   INTEGER,
    eligibility_url            TEXT
  )`,

  // fare_media.txt
  `CREATE TABLE IF NOT EXISTS fare_media (
    fare_media_id   TEXT PRIMARY KEY,
    fare_media_name TEXT NOT NULL,
    fare_media_type INTEGER NOT NULL
  )`,

  // fare_products.txt
  // Spec PK: (fare_product_id, rider_category_id, fare_media_id) — omitted
  // because rider_category_id and fare_media_id are nullable, and SQLite
  // treats NULLs as distinct in UNIQUE checks (see design decision 1).
  `CREATE TABLE IF NOT EXISTS fare_products (
    fare_product_id   TEXT NOT NULL,
    fare_product_name TEXT NOT NULL,
    rider_category_id TEXT,
    fare_media_id     TEXT,
    amount            REAL NOT NULL,
    currency          TEXT NOT NULL,
    FOREIGN KEY (rider_category_id) REFERENCES rider_categories(rider_category_id),
    FOREIGN KEY (fare_media_id) REFERENCES fare_media(fare_media_id)
  )`,

  // fare_leg_rules.txt
  // Spec PK: (leg_group_id, network_id, from_area_id, to_area_id,
  //   from_timeframe_group_id, to_timeframe_group_id) — omitted
  // (see design decision 1)
  `CREATE TABLE IF NOT EXISTS fare_leg_rules (
    leg_group_id             TEXT,
    network_id               TEXT,
    from_area_id             TEXT,
    to_area_id               TEXT,
    from_timeframe_group_id  TEXT,
    to_timeframe_group_id    TEXT,
    fare_product_id          TEXT NOT NULL,
    rule_priority            INTEGER,
    FOREIGN KEY (from_area_id) REFERENCES areas(area_id),
    FOREIGN KEY (to_area_id) REFERENCES areas(area_id)
    -- FK for fare_product_id omitted (see design decision 4)
  )`,

  // fare_leg_join_rules.txt
  // Spec PK: (from_leg_group_id, to_leg_group_id) — omitted
  // (see design decision 1)
  `CREATE TABLE IF NOT EXISTS fare_leg_join_rules (
    from_leg_group_id TEXT,
    to_leg_group_id   TEXT,
    fare_product_id   TEXT,
    rule_priority     INTEGER
  )`,

  // fare_transfer_rules.txt
  // Spec PK: (from_leg_group_id, to_leg_group_id, fare_transfer_type) —
  // omitted (see design decision 1)
  `CREATE TABLE IF NOT EXISTS fare_transfer_rules (
    from_leg_group_id        TEXT,
    to_leg_group_id          TEXT,
    transfer_fare_product_id TEXT,
    duration_limit           INTEGER,
    duration_limit_type      INTEGER,
    fare_transfer_type       INTEGER
  )`,
];

// ---------------------------------------------------------------------------
// Indexes for query performance
// ---------------------------------------------------------------------------

export const INDEXES: string[] = [
  'CREATE INDEX idx_stops_lat           ON stops (stop_lat)',
  'CREATE INDEX idx_stops_lon           ON stops (stop_lon)',
  'CREATE INDEX idx_stop_times_stop_dep ON stop_times (stop_id, departure_time)',
  'CREATE INDEX idx_trips_route         ON trips (route_id)',
  'CREATE INDEX idx_cal_dates_date      ON calendar_dates (date)',
  'CREATE INDEX idx_translations_table  ON translations (table_name, field_name)',
];
