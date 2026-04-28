# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [CalVer](https://calver.org/).

## [Unreleased]

### Added

- `TripInspectionDialog` (`src/components/dialog/trip-inspection-dialog.tsx`) を追加。trip の全停車駅を時刻・停車位置付きで一覧表示する modal。選択行 auto-scroll / 情報レベル連動表示に対応 (Refs: #147)。
- `useTripInspection` hook (`src/hooks/use-trip-inspection.ts`) を追加。app 層から trip inspection dialog の open/close を扱う。
- `TripInspectionTarget` 型を追加 (`src/types/app/transit-composed.ts`)。trip inspection の入口を stop-time entry 由来に限定せず一般化。
- `StopTimeDetailInfo` / `StopTimeTimeInfo` / `AbsoluteStopTime` コンポーネントを追加。`StopTimeItem` から building block を分離し、TripInspectionDialog の row layout と共有。
- `TimetableGridEntry` / `TimetableModal` から trip inspection を起動する動線を追加。
- `TripInspectionDialog` に「前 / 次の trip」ナビゲーションを追加。同一停留所の隣接 trip を巡回でき、`tripInspectionTargets` / `currentTripInspectionTargetIndex` / `onOpenPreviousTrip` / `onOpenNextTrip` props で外部から候補リストと現在位置を渡す。
- `TransitRepository.getTripInspectionTargets(query)` を追加。同一停留所・同一 service day に存在する候補 trip を `TripInspectionTarget[]` で返す lightweight API (trip navigation の候補生成に使用)。
- Display size primitive を共通化する alias を追加 (`src/components/shared/display-size.ts`)。
- `time-style.ts` に explicit time band 定義を追加 (morning / daytime / evening / night band を明示)。
- Pipeline: りんかい線 (東京臨海高速鉄道株式会社) の GTFS データソースを追加 (prefix `twrr`, route_type 2 rail)。8 駅 / 1 路線。`shapes.txt` は含まれないが MLIT 国土数値情報 (臨海副都心線) 経由で路線図に対応。`data-source-settings` の `routeTypes` は `[1, 2]` (subway + rail) — 実態として地下鉄区間を含むため将来の Source 選択 UI 用に両方を宣言。
- About: りんかい線のクレジット・データ情報を追加。

### Changed

- `StopTimeItem` を building block (`StopTimeDetailInfo` / `StopTimeTimeInfo`) に分離し、`TripInspectionDialog` と共通化 (260 行 → 約 100 行 + 子コンポーネント)。
- `StopTimeItem` の絶対/相対時刻受け渡しを explicit な time props に変更し、caller 側で表示ポリシーを制御可能に。
- `StopSummary` に display flag 群 (agency / trip count / connectivity 等) を追加し、nearby-stop / marker context で切替可能に。
- `dataLang` prop を `TripInfo` / `StopInfo` / `StopSummary` / `StopTimeItem` 等に rename/統一 (reader locale fallback chain を明示)。
- `JourneyTimeBar` Storybook の args を実サイズ値に近づけて調整。
- `VerboseTimetableEntries` / `VerboseTimetableGridEntry` / `VerboseContextualTimetableEntry` / `VerboseHeadsign` の構成を整理し、timetable entry の verbose 表示を共通の building block で組み立てるよう refactor。
- verbose/debug 用 `<summary>` (stop-summary / timetable-grid / verbose-\* 全般) に `tabIndex={-1}` を付与し、キーボード tab 移動の焦点対象から除外。
- `TransitRepository` interface の TSDoc を整理。`referenceDateTime` (任意日時、内部正規化) と `serviceDate` (pre-normalized service day) の 2 契約を method classification 表で明示。エラー文字列の parse 非推奨ポリシー、`getTripInspectionTargets` の sort 契約 (`sortTimetableEntriesByDepartureTime` 同等) を明記。
- `getUpcomingTimetableEntries` の引数 `now` を `referenceDateTime` にリネーム (両 repo 実装と test を追従)。`?time=` 等の custom time を含む任意の日時を受け取る契約を引数名でも明示。
- `resolveStopStats` / `resolveRouteFreq` / `getTripSnapshot` / `getTripInspectionTargets` を pre-normalized serviceDate 前提に統一。caller 側で `getServiceDay()` 正規化する責務を契約として固定し、impl 内の重複正規化を削除。
- `AthenaiRepositoryV2.timetableByPattern` の型を `Map<string, PatternTimetableEntry[]>` に更新し、pattern→stop 列挙の型情報を強化。
- `TripInspectionDialog` の stop 行レンダリングを 2-stage progressive render に変更。初回フレームは選択行 ±5 のみ描画し、次の `requestAnimationFrame` で全件に展開することで長い trip の first paint を高速化。
- `TripInspectionDialog` の trip stop row レイアウトを normalize し、不要な fragment 等を整理。
- Pipeline: ODPT trip-identity inference の Yurikamome-tuned heuristic core を `infer-odpt-trips-heuristic.ts` に切り出し、`build-timetable.ts` を facade (canonical fast path / heuristic / legacy fallback の dispatch、pattern aggregation、stopTimetable enrollment) に整理 (#158, Refs: #153)。
- Pipeline: `pipeline/src/lib/pipeline/app-data-v2/odpt/` を `odpt-train/` に rename し、TRAIN 型に依存しない builder (`build-agency.ts`、`build-feed-info.ts`) を `odpt-common/` に分離 (#159)。ODPT API spec v4.15 の class 種別 (共通 / 鉄道 / バス / 航空機) と repo-wide の `odpt-train` scope 命名規約に整合。

### Fixed

- `verbose-timetable-entries` で headsign が未設定の場合の表示を専用ラベル (`— headsign なし` 等) に切替え、空文字レンダリングを解消。
- `PillButton` の `cursor: pointer` が欠落していた問題を修正。
- `TripInspectionDialog` を開いた直後の scroll 位置が安定しない問題を修正 (選択行 auto-scroll のタイミング調整)。
- `TripInspectionDialog` summary の emoji / position label 表示を現在の info level 設定に揃え、情報レベル切替で冗長な indicator が残る問題を修正 (Refs: #147)。
- `MockRepository` の再構成 trip で停車時刻が進行しない問題を修正 (pattern stops の travel offset を upcoming / full-day / trip snapshot の各経路で適用)。併せて `r6-*` モック停留所の配置を東側に移動。`bus_yukkuri01` trip の timing 回帰テストを追加。
- `MockRepository` の日本語 headsign 定義が欠落していた問題を修正。
- `StopTimeTimeInfo` / `StopTimesItem` の trip inspect トリガーボタンに `focus-visible` ring を追加し、キーボード操作時のフォーカス可視性を確保 (a11y)。
- `TripInspectionDialog` で sparse な trip stop rows (一部停留所の `stopMeta` が欠落するケース) を含む trip でも row レイアウトが崩れないよう修正。
- Pipeline: ODPT pipeline で mid-pattern origin を持つ trip (例: ゆりかもめ 有明始発便) が full-route trip と同 `TripPattern` に merged され、cross-stop `d_len` 不整合 / `TripInspectionDialog` 上の phantom 時刻が発生する問題を修正 (#158, Refs: #153)。pattern key に origin を追加し `(routeId, direction, origin, destinationStation)` で集約。canonical fast path (`odpt:originStation`) → count-delta + time-matching heuristic → legacy fallback の 3 段で trip 帰属を決定する 2 層推論を導入。

## [2026.04.23]

### Added

- `BaseBadge` を追加 (`src/components/badge/base-badge.tsx`)。chip / border / verbose layout を持つ domain-agnostic primitive。Storybook 19 stories。
- Pipeline: 多摩モノレール の GTFS データソースを追加 (prefix `tmm`, route_type 12 monorail)。19 駅 / 1 路線。`shapes.txt` は含まれないが MLIT 国土数値情報経由で路線図に対応。
- About: 多摩モノレールのクレジット・データ情報を追加。
- Repository に trip snapshot lookup を追加 (`getTripSnapshot`)。timetable entry から trip を再構成し、selected-trip の debug 表示に活用。

### Changed

- `RouteBadge` / `RouteCountBadge` の context-cascade border color を `resolveContextBorderColor` に集約。theme contrast に応じて `route_color` → `route_text_color` の順で解決。
- `HeadsignLabel` を `HeadsignBadge` にリネーム + `src/components/badge/` へ移動。
- `RouteBadge` / `AgencyBadge` / `HeadsignBadge` を `BaseBadge` 経由のレンダリングに統合。
- Badge の verbose 制御 prop を `disableVerbose` → `enableVerboseExtras` (semantic 反転) に変更。
- `AgencyBadge` の size vocabulary を `BaseLabel` 互換 (`md | sm | xs`) に統一し、legacy `default` (12px) を削除。
- `AgencyBadge` / `HeadsignBadge` に theme 連動の outline を追加。
- `AgencyBadge` の TSDoc を実装挙動 (`useThemeContrastBackgroundColor` + `resolveContextBorderColor`) に合わせて更新。
- nearby-stops に scroll fade edge を追加。BottomSheet header の verbose view hint を非表示化。viewport 高さに応じて map / sheet 比率 (`60:40` / `50:50` / `40:60`) を切替。
- `getTripSnapshot` の lookup を `mergeSourcesV2` 中の pattern-based timetable index で高速化。

### Fixed

- `BaseBadge` の inline `fgColor` / `borderColor` を `bgColor` 非依存で適用可能に修正。
- `MapView` に `heightClassName` 変更時の `invalidateSize()` を追加し、bottom sheet 展開後の Leaflet サイズずれを解消。
- `BottomSheet` の nearby-stops scroll fade を iOS/WebKit で安定表示するよう修正。`useScrollFades` / `ScrollFadeEdge` を共通化。
- Pipeline: `kyoto-city-bus` の adopted URL が ODPT 側差し替えで HTTP 404 になっていた問題を修正 (新リソース `?date=20260423`、有効期間 2027-03-31)。
- Pipeline: `tama-monorail` を `build-global-insights` targets に追加 (per-source 側には登録済だったが global 側の追加漏れを補正)。
- `StopTimeItem` の inspect ボタンクリックが親要素まで伝播していた問題を修正。

## [2026.04.21]

### Added

- `getContrastAwareAlphaSuffixes` (`src/utils/color/contrast-alpha-suffixes.ts`) 純粋関数を追加。contrast ratio から subtle / emphasis alpha suffix を返す。
- pipeline dev tool `analyze-gtfs-routes.ts` を追加。GTFS `routes.txt` の current-state 解析 (identity / route-types / color / cEMV / continuous-service / optional-fields)。
- `bottom-sheet-header.stories.tsx` を追加 (22 stories: Basic / Loading / Route type filters / Agency filters / View selection / LangComparison / InfoLevel / KitchenSink)。
- `src/stories/fixtures.ts` 全 13 agencies の i18n data を拡充 (`agency_names` / `agency_short_names` / `agency_long_names` × `ja-Hrkt` / `de` / `es` / `fr`)。
- `MockRepository` の i18n data を 9 言語に拡充 (HEADSIGN / STOP_NAME / agency long_names)。stop_headsign バリエーション 3 種を追加。
- `MockRepository` に新規 agency `AGENCY_DRI` (English-primary, purple `#6A1B9A`) を追加。Issue #47 の duplicate-stop-in-pattern fixture routes 6 件を `mock:aoba` から DRI に移譲し責務分離。

### Changed

- `JourneyTimeBar` の bar color props を `fillColor` / `unfilledColor` に明確化。`StopTimeItem` で route color の contrast 評価から subtle / emphasis accent color を導出し、`TripPositionIndicator` / `JourneyTimeBar` で共有。
- `BottomSheet` の高さクラス (`COLLAPSED_HEIGHT_CLASS` / `EXPANDED_HEIGHT_CLASS`) を定数化 (collapsed `40dvh` / expanded `70dvh`)。
- pipeline dev analyzers の CLI を共通化 (共通 parser、`--list-sources` / `--list-sections` / `--section <name>`)。`analyze-gtfs-stop-times` / `analyze-odpt-station-timetable` / `analyze-v2-insights` / `analyze-v2-global-insights` を統一体系へ移行。
- `analyze-odpt-station-timetable.ts` / `analyze-v2-insights.ts` を source+section analyzer に拡張。
- Departure → StopTime naming refactor (PR #135): GTFS stop_times.txt が arrival/departure 対なので "Departure" 呼称を廃止。webapp + pipeline 全体の型名・ファイル名・i18n namespace を整理。
- `resolveRouteFreq` の意味を「number of trips in a service day」と明確化。
- `StopStats` / `TripPatternStats` / `StopGeo` の `freq` 意味を TSDoc で区別 (stop time count / trip count / operational density)。
- `bottom-sheet.tsx` の filter 処理を 2 段に分割 (filteredStopTimes / trimmedStopTimes)。stage 順序は load-bearing と明記。
- i18n UI wording 更新: "departures" → "All" / "services" / "service"。
- `pipeline/docs/V2_APP_DATA.md` を高レベル reference にスリム化、型仕様は TSDoc を正本に。
- Pipeline: 伊予鉄バス (`iyotetsu-bus`) の ODPT CKAN リソースを 20260415 版に更新。
- `formatDistance` / `formatDistanceCompact` に `lang` 引数を追加し locale 対応化 (de は `1,5km`、ja は `1,000m` 等)。
- 全 caller を `i18n.language` 渡しに更新。`edge-markers-canvas` では `useEffect` deps に `i18n.language` を追加。
- `BottomSheetHeaderProps` に `dataLang: readonly string[]` prop を追加。
- `CONNECTIVITY_RADIUS_M = 300` を `src/config/transit-defaults.ts` に追加 (pipeline `build-stop-geo.ts` を SSOT として mirror)。

### Fixed

- pipeline dev analyzer formatter 群で、`sections=[]` が「全 section」ではなく「0 件指定」と解釈され本文が欠落していた不具合を修正。
- pipeline の `route_color` fallback 処理で `route_text_color` を強制 `FFFFFF` で補っていた挙動を修正、raw GTFS 値を保持。fallback 判定は `route-colors.ts` に分離。
- `extract-timetable.ts` の出力順序を完全 deterministic 化 (stopTimetable / patternMap / serviceMap を ID で sort)。
- `bottom-sheet.tsx` の `filteredStoptimes` typo を `filteredStopTimes` に修正。
- `BottomSheetHeader` Agency filter PillButton が UI 言語切替に追従しない i18n 漏れを修正 (`getAgencyDisplayNames` 経由で `dataLang` chain を解決)。
- `StopMetrics` の connectivity 表示 (`X路線 Y便 Zのりば (300m)`) のハードコード日本語を i18n 対応化 (`stop.metrics.connectivity` key、locale-aware 数値整形)。
- `TimetableGridEntry` の terminal marker `着` のハードコードを `timetable.entry.arriving` i18n key に置換。
- `FlatDepartureItem` absolute time 直後の terminal marker `着` を `departure.arrivingAbsolute` i18n key に置換。

## [2026.04.15]

### Added

- `computeJourneyTime` 純粋関数 (`src/domain/transit/journey-time.ts`) を追加。trip の remaining / total minutes から bar 描画値を計算 (Result-type API、エッジケース 40 tests)。
- `JourneyTimeBar` コンポーネントを追加。trip の remaining / total を視覚化する progress bar (size / color / border / fillDirection / minsPosition / labels / maxMinutes / showEmoji)。
- `FlatDepartureItem` の `infoLevel >= detailed` で `JourneyTimeBar` を表示。verbose 時は分数ラベル併記、route bgColor を bar fill に引き継ぎ。
- `TripInfo` に `showAgency?: boolean` prop (default `false`) を追加。`nearby-stop.tsx` で multi-operator stop のみ表示するよう制御 (single-operator では agency badge を冗長 noise として非表示)。
- `TripPositionIndicator` の verbose 時に 🚏 emoji prefix を追加。
- 論理的 (place-name-independent) な long/short fixtures を `src/stories/fixtures.ts` に追加 (Alpha Park / Bravo Station 等の 9 言語翻訳付き abstract placeholder)。
- `LogicalLongInfoLevelComparison` story を全主要コンポーネント (DepartureItem / FlatDepartureItem / TripInfo / HeadsignBadge / RouteBadge / StopSummary / StopMarkersDom) に標準化追加。
- `StopMarkersDom.LangComparison` (9 言語) と `TripInfo.MultiAgenciesStop` story を追加。
- pipeline dev tools 2 件を追加: `analyze-v2-insights.ts` (per-source InsightsBundle 解析)、`analyze-v2-global-insights.ts` (GlobalInsightsBundle stopGeo 解析: nr / wp / cn 分布、isolation buckets、hub counts、Top-N leaderboards)。

### Changed

- `DepartureItem` の絶対時刻 row を `flex-wrap` 対応に変更し、狭幅 overflow を解消。
- `DepartureItem` の各時刻 span を `items-baseline` → `items-center` に変更 (attribute label pill の縦中央揃え)。
- `TimetableEntryAttributesLabels` の表示順を origin → terminal の自然な順序に変更。
- `JourneyTimeBar` 内部の horizontal / vertical layout 分岐を `isHorizontal` フラグで統一。

### Fixed

- `FlatDepartureItem` verbose stop 位置ラベル (`stopIndex / totalStops`) を `TripPositionIndicator` 右隣に inline 配置 (専用 row を廃止)。

## [2026.04.14]

### Added

- `validate-data.ts` に `si` 整合性検証を追加 (非負整数 / `si < pattern.stops.length` / `pattern.stops[si].id === stopId` / `(stop_id, tp, si)` 三つ組ユニーク性)。
- `verbose-timetable-entries.tsx` の verbose dump に `si=N` 表示を追加。
- `TripPositionIndicator` コンポーネントを追加 (`src/components/label/trip-position-indicator.tsx`)。trip pattern 内の現在位置を slider 風の dot + track で視覚化。`FlatDepartureItem` の verbose 表示で活用。Storybook 12+ stories。
- データソース読込失敗時の error toast 表示 (#128, Phase 1)。bundle_version mismatch 等で起動時に sonner toast でユーザーに通知。

### Changed

- BREAKING: `bundle_version` を 2 → 3 に bump (全 v2 bundle)。理由: `TimetableGroupV2Json` に required `si: number` field を追加。旧 v2 データは fail fast で reject。
- `TimetableGroupV2Json` に `si: number` (0-based stop index within `pattern.stops`) を required で追加 (#47)。同一 stop_id がパターン内の複数位置に現れる 6字形/循環ルートで、各位置を別 group として表現可能 (例: 都営大江戸線 都庁前 in `toaran:p72` は `si=0` と `si=28` の 2 group)。
- `DepartureItem`: per-departure attribute 描画に移行 (Alt F)。group header の `TripInfo.attributes` prop 渡しを廃止。

### Removed

- `pickupType` ベースの circular workaround を撤去 (`athenai-repository-v2.ts` 計 7 箇所)。`group.si` から直接 `stopIndex` を取得。
- `build-trip-pattern-stats.ts` の `isCircularPattern` ヘルパーを削除 (`si` 分離後は不要)。

### Fixed

- `tripPatternStats.freq` の duplicate stop double-count 問題を解消 (#47)。例: `toaran:p72` 都庁前 freq が 380 → 190。
- 6字形/循環パターンで `stop_headsign` が最初の出現位置の値で表示されていた問題を修正 (kobus / kcbus / sbbus / minkuru / edobus 計 122 stop instances)。
- `DepartureItem` の group-level attribute 表示が unstable だった既存バグを Alt F で根治 (循環ルートで `[ORIG]` / `[TERM]` ラベルがちらつく問題)。
- `sortTimetableEntriesChronologically` の DST correctness 問題を修正 (Europe/Berlin / Europe/Rome 等の DST transition 日で 1 時間ずれる)。
- `TripPositionIndicator` に `route_color` が空文字列の route で `#20` / `#50` / `#` といった不正な CSS color を渡していた問題を修正 (29 routes)。
- `TripPositionIndicator` を hardening: `totalStops <= 1` で null return、`> 300` は 300 に clamp (Infinity 無限ループ防止)。
- `FlatDepartureItem` verbose 行で `entry.insights` が未解決のとき `/` のみ表示されていた問題を修正 (`?? '-'` で fallback、`- / -` と表示)。

## [2026.04.13]

### Added

- `RouteCountBadge` を追加 (`src/components/badge/route-count-badge.tsx`)。route の display name と `route_color` を `LabelCountBadge` に橋渡しする domain adapter。`TimetableMetadata` の route 内訳表示を PillButton から置き換え。
- `BaseLabel` に `style` prop を追加 (GTFS `route_color` 等のランタイム hex 値を inline style で渡せる)。
- `DEVELOPMENT.md` に「Stop ID lookup の選び方」セクションを追加。永続 / 長寿命の `stop_id` (anchor / route stops / `?stop=` 等) は `repo.getStopMetaByIds`、viewport 制限のある `findStopWithMeta` との使い分けルールを記述。
- MockRepository の `sta_central` に `de` / `es` / `fr` 翻訳を追加し、`SUPPORTED_LANGS` 全 9 言語をカバー。

### Changed

- `MapToggleButton` (地図上の全コントロールボタン) を text-select 不可に (`user-select: none` + `-webkit-touch-callout: none`)。iPhone 等での選択状態を抑止。
- `PillButton` (BottomSheet フィルタ群、route 内訳表示) も同様に text-select 不可に。
- `TransitRepository.getStopMetaByIds` / `getStopMetaById` の TSDoc を強化 (`findStopWithMeta` との使い分けと regression 経緯を明記)。`use-route-stops.ts` と `app.tsx` にも対応コメント追加。
- `TranslationsJson` スキーマをリネーム + 拡張 (#103): `route_names` → `route_long_names`、新フィールド `route_short_names` を追加 (`route_short_name` / `route_long_name` を first-class 対等に)、`headsigns` → `trip_headsigns` (`stop_headsigns` と対称)。pipeline ドキュメントのフィールド名参照も新スキーマに追随 (`public/data-v2/*/data.json` 再生成は別途データ更新フロー)。

### Fixed

- StopHistory ドロップダウンが `stopWithMeta.stop.stop_name` (feed_lang 由来) を直接表示していた問題を修正 (`getStopDisplayNames` で表示言語に解決)。
- Portal (アンカー) ドロップダウンが常に保存時の `stopName` snapshot を使っていた問題を修正 (`repo.getStopMetaByIds` で fresh な `StopWithMeta` を取得し表示言語で解決)。viewport 外のアンカーも翻訳に追従し、追加された GTFS 翻訳にも自動追従する。
- アンカー追加/削除時の toast (`anchor.added` / `anchor.removed`) も翻訳解決に切り替え。
- pipeline (v2) が GTFS の `routes.route_short_name` 翻訳を抽出していなかった問題を修正 (#103)。`extract-translations.ts` に GTFS-JP `record_id` 経由と標準 GTFS `field_value` 経由の両抽出を追加。kyoto-city-bus (139 件) / keio-bus (31 件) 等の短縮名翻訳が `data.json` まで届き、`getRouteDisplayNames` が言語切替に追従。

## [2026.04.12]

### Added

- DEVELOPMENT.md: GTFS i18n 仕様 (`feed_lang` / `agency_lang` / `translations.txt`) のリファレンスセクションを追加。
- `AgencyV2Json` 型 (agency section v2) を追加。pipeline は data-source 由来フィールドのみ出力。
- `src/config/agency-attributes.ts` を新設し、per-agency display name (long/short multilingual) と brand colors を一元管理。multi-agency (`sbbus:3013301006265` / `sbbus:6013301006270`、`vagfr:1` / `vagfr:3` 等) を区別。
- GTFS schema に `cemv_support` カラムを追加 (GTFS-JP v4)。`extractAgenciesV2` が `agency_phone` / `agency_email` / `agency_fare_url` も読み取るよう拡張。
- `Agency` app 型に `agency_long_name` / `agency_long_names` フィールドを追加。
- `FilteredTimetableEntriesState` 型と `getFilteredTimetableEntriesState` pure function を `timetable-utils.ts` に追加 (full-day / pre-filter upcoming / post-filter の 3 state から UI display state を派生)。
- `filterByAgency` / `filterByRouteType` を departure-level filter として `timetable-filter.ts` に追加。
- `collectPresentAgencies` / `collectPresentRouteTypes` domain helper を独立ファイルとテストに抽出。
- i18n key `stop.timetable.allFilteredOut` / `stop.timetable.filteredCount` を追加 (UI 層を data 層の `stop.serviceState.*` から namespace 分離)。

### Changed

- Agency / route type フィルターを stop-level から departure-level へ移行。複数 route_type / 複数 agency を持つ stop で 1 種類を off にしても stop は表示されたまま該当 departures のみ非表示。
- Filter pill を常時表示に変更 (1 種類しか present していないソースでも何を絞り込めるか常に把握できる)。
- `showOperatingStopsOnly` (旧 `activeOnly`) を departure-level filter より前に実行し、stop visibility と user filter の conflation を解消。
- `activeOnly` → `showOperatingStopsOnly` rename (i18n key / pill label も統一)。
- i18n: `stop.serviceState.filterHidden` → `stop.timetable.allFilteredOut` に移行 (UI 層と data 層の namespace 分離)。
- Pipeline: GTFS / ODPT の agency / translation builder から `provider` 依存を除去。display name injection を停止し、app 側は `agency-attributes.ts` を overlay する責務に分離。
- `getAgencyDisplayNames` に `'original'` source を追加 (canonical `agency_name` → `agency_id` の fallback)。
- `AgencyBadge`: hardcoded Seibu workaround を削除し、per-agency display name を `agency-attributes.ts` に集約。
- `TranslationsJson.agency_short_names` を削除 (App 側 `agency-attributes.ts` で管理)。

### Fixed

- i18n: GTFS base values (stop_name / trip_headsign 等) を `feed_lang` キーで translation names に注入し、`lang=ja` で英語 headsign が表示される問題を修正 (#107)。
- Multi-agency GTFS フィード (西武バス 2 社、VAG Freiburg 2 社) で全 agency に同一の provider 由来 display name が適用されていた問題を修正 (#105)。
- departure-level filter で全 departures が非表示になった stop が「本日の運行は終了しました」と誤表示される regression を修正 (`FilteredTimetableEntriesState` で 3 状態から正しい fallback メッセージを導出)。
- ODPT `buildAgencyV2.agency_id` と `buildRoutesV2.ai` で異なる provider name (short / long) を使用しており referential integrity が崩れる latent bug を修正 (両者を `en.long` に統一)。
- GTFS `extractAgenciesV2` で `cemv_support` が空文字列のとき `Number('')` で `0` に変換され誤出力されていた問題を修正 (`parseInt` で `NaN` 化し range filter で除外)。
- `bottom-sheet.tsx` の `showOperatingStopsOnly` 判定を departure-level filter の前に実行する順序に変更。
- TSDoc の不一致を修正 (`get-agency-display-name.ts` の `'long'` source 説明、`transit-v2-json.ts` の ODPT `n` 説明)。
- `verbose-agency.tsx` の JSX whitespace 扱いを明示的な `{' '}` セパレータに書き換え。

## [2026.04.11]

### Added

- アンカーの追加/削除操作に toast 通知を追加 (#79)。追加は成功 (緑)、削除は警告 (オレンジ) で表示。
- `?lang=<code>` URL パラメータを追加。表示言語を URL から指定可能 (localStorage より優先、一時的な override)。`normalizeLang` で正規化。
- `?tileIdx=<number>` URL パラメータを追加。タイルソースを URL から指定可能 (localStorage より優先、一時的な override)。
- キーボードショートカットを追加。`/` で停留所検索ダイアログを開き、`?` でショートカット一覧モーダルを表示。
- `ShortcutHelpDialog` コンポーネントを追加し、利用可能なキーボードショートカットを一覧表示。
- 停留所検索 (StopSearchModal) で `↑` / `↓` による結果ハイライト移動と `Enter` による選択確定に対応。検索文字を打ち変えるとハイライトを先頭にリセット。
- `useKeyboardShortcuts` Hook と `shouldHandleShortcut` 純粋関数を新設。IME 変換中・修飾キー併用時・テキスト入力フォーカス時はショートカットを発火させない。
- About: キーボードショートカットの簡潔な紹介を追加。
- `BaseLabel` コンポーネントを追加。サイズ (xs/sm/md)、文字数制限 (maxLength/ellipsis)、className による色指定をサポートするテキストラベルプリミティブ。
- `StopServiceStateLabel` コンポーネントを追加。停留所サービス状態 (降車専用/運行なし) を BaseLabel ベースで表示。
- `TimetableEntryLabels` コンポーネントを `src/components/label/` に移動し、BaseLabel ベースにリファクタ。
- MockRepository: `bus_central_closed` (運行便なし/no-service) 停留所を追加。
- `TimetableEntriesState` 型を追加。任意の TimetableEntry 集合の状態を表す基本型。`StopServiceState` を型エイリアスとして再定義。
- `getTimetableEntriesState(entries)` resolver を追加。entries を直接受け取ってサービス状態を判定。
- Storybook: BaseLabel, StopServiceStateLabel, TimetableEntryLabels の stories を追加。

### Changed

- Toast 表示位置を `top-center` から `bottom-center` に変更。展開表示 (expand) を有効化し、同時表示数の上限を10に拡大。
- About: 地図優先の開発を示す古い WIP 注記を削除。
- `isDropOffOnly` prop を UI 層から廃止し、`stopServiceState: StopServiceState` に統一 (#64)。StopSummary, StopInfo, NearbyStop, TimetableHeader, VerboseStop 等を更新。
- `isBoardableOnServiceDay` を `StopWithContext` / `TimetableData` から削除。`stopServiceState` から導出可能なため。
- `TimetableQueryMeta` から冗長な `serviceState` フィールドを削除。`getStopServiceState(meta)` で導出する設計に変更。
- repo の `getFullDayTimetableEntries` で `getTimetableEntriesState` を使用。
- SearchDialog から History への routeTypes 受け渡しを修正 (UFO emoji 問題)。

## [2026.04.09]

### Added

- Pipeline: VAG Freiburg (ドイツ・フライブルク市営交通) の GTFS データソースを追加 (#110)。
- Pipeline: ACTV Navigazione (イタリア・ヴェネツィア水上交通) の GTFS データソースを追加。
- About: ACTV Navigazione のクレジット・データ情報を追加。
- 地図タイルに Stadia Maps ソースを追加。タイルごとの `maxZoom` 設定をサポート。
- 停留所の stopped 表示に「降車専用」「サービスなし」の視覚的区別を追加 (#112)。
- `getStopServiceState` ドメイン関数を追加し、停留所のサービス状態 (通常/降車専用/サービスなし) を判定。
- Storybook: 停留所マーカー story を追加。

### Changed

- Pipeline: SQLite スキーマから `service_id` 外部キー制約を削除し、柔軟な GTFS データに対応。
- `TimetableQueryMeta` に `serviceState` フィールドを追加し、Repository 層でサービス状態を公開。
- Route type 値の型名を `RouteType` から `AppRouteTypeValue` に改名。
- Route type フィルタに Unknown タイプの動作を統合。
- `resolveStopRouteTypes` ドメイン関数でルートタイプ解決を一元化し、`unknownPolicy` による明示的な Unknown 扱いを導入。
- データソースグループのメタデータを拡充。Freiburg・Venice のホーム位置情報を追加。

### Fixed

- Pipeline: サービスグループの active-day ギャップを修正。
- 履歴・アンカー再選択時に route type が失われる問題を修正。
- Route type 解決で未解決の場合に Unknown タイプへ適切にフォールバックするよう修正。
- 無効な `tileIndex` を `null` にフォールバックするよう修正。
- 地図タイル切替時に active tile source の `maxZoom` が Leaflet map 本体にも反映されるよう修正。
- About: 地図機能説明と地図クレジットを、現行の GSI / Stadia Maps タイル構成に合わせて更新。

## [2026.04.08]

### Added

- i18n: react-i18next を導入。UI テキストの多言語対応基盤を構築。
- i18n: 言語切替ボタンを RenderingPanel に追加 (9言語対応: ja, ja-Hrkt, en, de, es, fr, ko, zh-Hans, zh-Hant)。
- i18n: `SUPPORTED_LANGS` 設定に fallback chain を定義 (e.g. zh-Hant → zh-Hans → en)。
- i18n: `resolveLangChain` で言語フォールバックチェーンを解決。
- i18n: `normalizeLang` で BCP 47 prefix マッチ対応 (e.g. en-US → en)。
- i18n: `navigator.language` をデフォルト表示言語として使用。
- i18n: `DEFAULT_TIMEZONE` を追加 (暫定 Asia/Tokyo、Issue #65 参照)。
- Storybook: `LANG_COMPARISON_CASES` と shared fixture を追加し、多言語比較 stories を共通化。
- Storybook: `AgencyBadge` に `LangComparison` story を追加し、agency 名の言語解決差分を確認しやすくした。

### Changed

- `lang: string` prop を `dataLang: readonly string[]` にリネーム。GTFS/ODPT データ翻訳用の言語フォールバックチェーンを伝搬。
- 日付フォーマットを `Intl.DateTimeFormat` ベースに移行。locale に応じた自然な日付・曜日表示。
- `formatDateTimeParts` と `formatDateWithDay` を `formatDateParts` に統合。`timeZone` 必須パラメータを追加。
- `getDayColorCategory` の曜日判定を timezone-aware に修正。
- `resolveTranslatableText` を配列 (fallback chain) 対応に拡張。
- `sortLangKeysByPriority` を BCP 47 case-insensitive に修正。
- `sortLangKeysByPriority` の優先順ルールを整理し、exact preferred match は `preferred` 配列順を尊重するように統一。
- i18next `fallbackLng` を `ja` → `en` に変更。ja-\* 以外は英語にフォールバック。
- `DepartureViewMeta` の label/title/description を i18n キーに変更。
- UI テキスト i18n 化: relative-time, trip-info, entry-labels, timetable-modal, nearby-stop, bottom-sheet-header, time-setting-dialog, stop-search-modal, info-dialog, 全 panel aria-label, anchor, toast。
- locale ファイルをネスト構造に整理 (common, nearbyStops, nearbyStop, departure, timetable, view, panel, anchor, search, time, info)。
- `getStopDisplayNames` を presentation-free な reference implementation に整理し、`getHeadsignDisplayNames` の引数順も整合させた。
- `Route` の翻訳フィールドを `route_names` から `route_short_names` / `route_long_names` に分離。
- `getRouteDisplayNames` を short/long 個別解決ベースに再設計し、`resolved` / `resolvedSource` / source ごとの `subNames` を返すよう変更。
- `RouteBadge`, `SelectionIndicator`, `StopSummary`, `TripInfo`, verbose route dump を新しい route display names API と `dataLang` / `agencyLangs` 伝搬に追従。
- `Agency` の表示名解決を route と同じ short/long source ベース API に再設計し、`resolved` / `resolvedSource` / short / long を返すよう変更。
- `AgencyBadge`, `TripInfo`, `StopSummary`, verbose agency dump を新しい agency display names API と `dataLang` / `agencyLangs` 伝搬に追従。

### Fixed

- 停留所 summary の車椅子アイコンに `aria-label` と tooltip を追加し、状態が支援技術と hover の両方で伝わるように修正。
- 時刻表モーダルのヘッダで、日付と時刻が異なるタイムゾーン基準で表示される問題を修正。両方とも `DEFAULT_TIMEZONE` 基準に統一。
- `useUserSettings` テストを強化し、`navigator.language` 初期化と `lang` 正規化のケースを deterministic に検証するよう改善。
- 時刻表モーダルの説明文で、選択中の raw headsign に対応する表示言語解決済み headsign が使われるよう修正 (#99)。
- `AgencyBadge` で翻訳済み short label が複数 agency で衝突するケースでも、source ごとの優先順位と raw name fallback により識別できるよう修正。

## [2026.04.06]

### Added

- Pipeline: GTFS `stop_times.stop_headsign` を `TripPatternJson.stops[].sh` として出力 (#92)。
- Pipeline: pattern grouping key に stop_headsign を含め、同一 stop sequence でも stop_headsign が異なる trip を別パターンに分離。
- WebApp: `TripPattern` アプリ内部型を導入し、JSON schema の変更を Repository 層で吸収。
- WebApp: stop_headsign 表示対応 (#92)。GTFS 仕様に準拠し stop_headsign が trip_headsign を上書き。
- i18n: `resolveTranslatableText`, `sortLangKeysByPriority`, `resolveDisplayNamesWithTranslatableText` ユーティリティ追加。
- i18n: `lang` ユーザー設定を追加。停留所名、ヘッドサイン、サブネームの表示言語を切替可能に。
- `HeadsignSource` 型と `resolvedSource` フィールドで effective headsign のソース種別を追跡。
- `getEffectiveHeadsign`: GTFS 仕様に準拠した stop_headsign ?? trip_headsign 解決。
- `hasDisplayContent`, `resolveAgencyLang` ユーティリティ追加。
- `headsignSourceEmoji`: verbose モードで trip (🪧) / stop (📍) のソース種別を視覚表示。
- `VITE_TRANSIT_DATA_PATH` / `PIPELINE_TRANSIT_DATA_DIR` 環境変数を追加。
- PRD.md: InfoLevel の4段階設計原則を section 3.A に追加。

### Changed

- `RouteDirection` を再構造化: `headsign`/`headsign_names` を `tripHeadsign`/`stopHeadsign` (`TranslatableText`) に分離。
- `TripPatternJson.stops` を `string[]` から `{id, sh?, sd?}[]` に変更。
- `getHeadsignDisplayNames` を prefer 戦略ベースに書き換え。trip/stop を個別に解決し `resolved` + `tripName` + `stopName` を返却。
- `TripInfo`: `HeadsignInfo` 内部コンポーネント抽出。verbose で trip/stop 両方を emoji 付きで表示。simple レベルで subNames を非表示に。
- `lang` prop を全 UI チェーンに伝搬 (app → MapView → StopMarkers → StopSummary → TripInfo 等)。
- `showTimetable` にハンドラを統合。時刻表モーダル `DialogDescription` を可視テキストに変更。

### Removed

- `translateHeadsign`: `resolveDisplayNamesWithTranslatableText` に置き換えられた dead code を削除。

## [2026.04.02]

### Added

- 地図にズームコントロール (+/-) ボタンを追加。ナビゲーションパネル横に配置。
- DepartureItem / FlatDepartureItem に headsign の subNames (翻訳名) を表示。
- `RouteDirection` 型を `transit-composed.ts` に抽出 (#82)。
- `HeadsignBadge` に resolver パターンを統合: `routeDirection` を受け取り、内部で `getHeadsignDisplayNames` を呼ぶ。
- `translateHeadsign` を実装: `headsign_names` から言語別翻訳を取得。
- `VerboseHeadsignDisplayNames` コンポーネントを追加。
- `RelativeTime` コンポーネント: 時間帯に応じた色と opacity で相対時刻を表示。
    - size variants (sm / default / lg)、`hidePrefix` (「あと」省略)、`isTerminal` (「着」付加)。
- `time-style.ts`: 5段階の時間帯カラーバンド (3分 orange, 10分 green, 15分 blue, 30分/60分 gray)。
- `TripInfo` に `size` variant (sm / default) と `ellipsisHeadsign` prop を追加。
- `StopSummary` に TripInfo + RelativeTime を統合。終点/乗車不可ラベルも表示。
- Pipeline: `Resource` / `LocalResource` / `RemoteResource` クラスを追加 (check tool のリファクタ)。
- Pipeline: REMOTE warning に `start_at` 情報を追加。
- Pipeline: check-odpt-resources のユニットテストを追加。

### Changed

- MapNavigationPanel / MapControlPanel をカスタムフック + ドメインモジュールに分離。
- 地図ドメインロジックを `src/domain/map/` に分離 (stop フィルタ含む)。
- `getHeadsignDisplayNames` のシグネチャを `(routeDirection, infoLevel, lang?)` に変更。
- `HeadsignBadge` の props を `headsign` + `route` から `routeDirection: RouteDirection` に変更。
- `VerboseHeadsign` に `headsign_names`、`direction`、`HeadsignDisplayNames` dump を追加。
- `DepartureItem` / `FlatDepartureItem` の相対時刻表示を `RelativeTime` コンポーネントに置換。
- `FlatDepartureItem` のレイアウト調整: 時間カラムに `min-h-8` + `flex-col justify-center`。
- 相対時刻の表示範囲を60分以内に拡大。90分超は「あと」を省略。
- `StopSummary` の stop subNames に ellipsis を適用。
- インライン `displayMinutes` 計算を `getDisplayMinutes` util に統一。
- Pipeline: `detectWarnings` を Resource クラスベースにリファクタ。warning type を `LOCAL_` / `ADOPTED_` / `REMOTE_` prefix に統一。
- Pipeline: chiyoda-bus resource を `date=20260401` に更新。

### Fixed

- 時刻表モーダルでヘッダが長い場合でも、ヘッダを内部スクロールにして本文グリッドが初期表示で見えるように修正。
- サイコロボタン押下時に、ランダム移動の前に stop 選択状態を解除するよう修正。
- 現在地ボタン押下時に、地図中心が現在地に近い場合は不要な pan を避けつつ段階的に zoom in するよう修正。
- ズームボタンが min/max ズーム時に disabled 状態になるよう修正 (a11y)。
- Pipeline: resource check の URL マッチングと feed status 検出を改善 (#94)。
- Pipeline: 不正な URL のリダクションと `SENSITIVE_PARAMS` の統一 (#94)。

## [2026.03.31]

### Fixed

- insights の service group 選択を `data[0]` 固定から日付ベースの動的解決に修正 (#87)。
    - `resolveStopStats(stopId, serviceDate)` / `resolveRouteFreq(routeId, serviceDate)` を追加。
    - NearbyStop の stats (freq 等) が曜日に応じて正しい値を表示。
    - route shapes の線の太さも dateTime に応じて動的に変化。
    - shapes 再描画を serviceDayKey で安定化し、15秒ティックでの不要な再計算を防止。
- GTFS download URL を新ダイヤ対応に更新 (関東バス、京王バス、伊予鉄バス) (#89)。

### Added

- 日時セレクター機能を PRD.md に追加 (Section E)、README/ABOUT に反映。
- `?time=` / `?stop=` URL パラメータを PRD.md に追記。
- `selectServiceGroup()` 関数: active service IDs と最も overlap が大きいグループを選択。
- repo-benchmark に `resolveStopStats` / `resolveRouteFreq` の計測を追加。
- webapp-benchmark skill を追加。
- `useDateTime` に INFO ログ追加 (Custom time set / from URL / Reset)。
- `NearbyDepartures` ログに serviceDay と totalFreq を追加。
- `getStopsInBounds` / `getStopsNearby` ログに center 座標を追加。
- timetable-modal のコンポーネント抽出:
    - TimetableGridEntry: 時刻表グリッドの1エントリ (minutes + headsign + labels)。
    - EntryLabels: boarding/position labels。
    - TimetableData 型統一: RouteHeadsignTimetable/StopTimetable を単一 interface に統合、routes[] 追加。
- PillButton に count badge 追加 (chip-in-chip スタイル、色反転、em 相対サイズ)。
- StopTimetableFilter に便数表示。
- TimetableMetadata の route breakdown を PillButton count に統一。
- Hour-group verbose を collapsed 表示 ([N時 M件])。
- Verbose パターン統一: 全 verbose コンポーネントが details/summary を内包。呼び出し側は `<VerboseXxx ... />` だけで完結。
    - VerboseAgency, VerboseRoute: DisplayNames を吸収、defaultOpen prop 追加。
    - VerboseHeadsign, VerboseStopMetrics: details/summary 内包。
    - VerboseStop: VerboseStopData から切り出し (再利用可能な building block)。
    - VerboseAgencies, VerboseRoutes: 複数アイテムの collapsed dump。
    - VerboseContextualTimetableEntry: 全フィールド dump、disableVerbose、defaultOpen prop。
    - VerboseNearbyStopSummary: NearbyStop レベルの UI 状態と departures 集計の dump。
    - VerboseTimetableSummary: timetable メタデータ + エントリ集計の統合 dump。
    - VerboseTimetableEntry: TimetableEntry テキスト dump (building block)。
    - VerboseTimetableGridEntry: GridEntry の props + entry dump。

### Changed

- VerboseStopData: details/summary を内包。StopInfo 側の wrapper を不要に。stop_id を dump に追加。
- 未使用の agencyName prop を DepartureItem/FlatDepartureItem から削除。
- PillButton: onClick を optional に (display-only badges 対応)。

## [2026.03.30]

### Added

- 近くののりばに方角を表示するようにした。DistanceBadge に三角形の方角インジケーターを追加。
- StopInfo コンポーネントを NearbyStop から抽出。停留所の識別情報 (名前、路線種別、距離、事業者) を担当。
- Verbose パターン: `<details>/<summary>` による折りたたみ式デバッグダンプ。Badge (Route, Agency, Headsign) と StopInfo に統一的に適用。
    - `src/components/verbose/` に dump コンポーネントを集約。
    - 生データ dump と resolver 結果 dump を分離 (例: VerboseRoute + VerboseRouteDisplayNames)。
    - summary ラベルで識別 (`[Route]`, `[Agency]`, `[Headsign]`, `[StopData]`, `[Metrics]`)。
    - `disableVerbose` prop で非インタラクティブなコンテキスト (tooltip) での verbose 抑制。
- StopInfo に `wheelchair_boarding` 表示 (Accessibility アイコン、1=青, 2=グレーアウト)。
- StopInfo に `platform_code` 表示 (amber バッジ、枠線付き)。
- StopMetrics コンポーネント: stats/geo の指標を info level に応じて表示。
    - normal+: freq (CalendarDays), connectivity (Waypoints)
    - detailed+: nearestRoute (Milestone/teal)
    - verbose: walkablePortal (Milestone/purple) + 全フィールド dump
- RouteBadge で路線表示 (StopInfo の routes plain text を置き換え)。
- `formatRouteLabel` から verbose 固有の `[shortName|longName]` 出力を除去 (VerboseRoute が担当)。
- Badge ルート要素に `font-normal` リセット。親の font 設定に依存しない統一スタイル。
- IdBadge に `font-normal` を追加。配置場所による太さの不一致を解消。
- Storybook: RouteBadge, HeadsignBadge, StopMetrics の stories を追加。AgencyBadge stories を簡素化。
- MockRepository に `wheelchair_boarding`, `platform_code` テストデータを追加。
- Repository: InsightsBundle の stopStats と GlobalInsightsBundle の stopGeo を StopWithMeta にマッピング。`geo` を StopWithContext から StopWithMeta に移動し、初期化時に同期的にロード。

### Performance

- BottomSheet の NearbyStop カードを IntersectionObserver で遅延レンダリング。最初の 6 件のみ即座にマウントし、残りはスクロール時に遅延マウント。

### Fixed

- Canvas mode (lightweight) の選択時 stop tooltip がダークモード未対応だった問題を修正。`L.popup` から `L.tooltip` に統一し、DOM mode とレイアウト・テーマを一致させた。

## [2026.03.28]

### Added

- Portal / Anchor 機能: お気に入り Stop (Anchor) を登録し、Portal ドロップダウンから即座に移動できる機能。
    - Portal ドロップダウン: 画面上部に履歴と並列表示。Lucide `DoorOpen` アイコン (pink)。
    - NearbyStop カードに Anchor トグルボタン (Lucide `Signpost`)。
    - 時刻表ボタンを Lucide `Clock` アイコンに変更。
    - エラー通知: sonner トーストで Anchor 操作エラーを表示。
    - `AnchorEntry` 軽量参照モデル (stopId, stopName, stopLat, stopLon, routeTypes, createdAt, portal?)。
    - `portal?` フィールドで将来的なグループ分類に対応。
    - `UserDataRepository` インターフェース + `LocalStorageUserDataRepository` 実装。async `Result<T>` API で Web API 移行に備えた設計。
    - `useAnchors(repo)` hook: repo 注入パターン。`lastError`/`clearError` によるエラー状態管理。
    - ドメインロジック: `addAnchor`, `removeAnchor`, `updateAnchor`, `isAnchor`, `buildAnchorRefreshUpdates` (純関数)。
    - `batchUpdateAnchors`: 複数 Anchor を1回の永続化で一括更新。

### Changed

- StopHistory / Portal ドロップダウンをテーマ対応 (light: 白背景, dark: 黒背景)。
- StopHistory の未選択時アイコンを Lucide `History` (sky) に変更。
- StopHistory の絶対配置を親 flex コンテナに委譲し、Portal と並列配置可能に。
- StopHistory の最大幅を `max-w-[50dvw]` に調整。
- SelectContent の z-index を `z-1002` に設定 (地図オーバーレイより前面)。
- DEVELOPMENT.md の z-index 階層表を更新。
- import 順序を ES module 規約に準拠 (app.tsx)。

## [2026.03.27]

### Added

- `?stop=` クエリパラメータで初期選択 stop を指定可能。
- Route Stops Layer: 路線選択時に路線上の全停留所を表示。nearby/far layer より描画優先度が高い。路線図データが無い路線でも実際の走行区間を可視化可能。
- `useRouteStops` hook で停留所の路線別フィルタリング。
- `disableDimming` prop で selected stop による dimming を制御。Route Stops Layer では stop 選択時も全停留所が通常表示される。

### Fixed

- StopMarkersCanvas: Tooltip lazy generation で incremental marker update を最適化。map panning 時のマーカー更新を 99.8% 削減 (700-850ms → 2-6ms @941 stops)。

### Changed

- BottomSheet を BottomSheetHeader / BottomSheetStops に分割。
- ボトムシートのヘッダーに nearby 半径を表示 (例: `1km圏内`)。
- 初回データ取得完了前に「近くに乗り場がありません」が一瞬表示される問題を修正。
- `NearbyStopsCounts` (total/active/filtered) を導入し、件数情報を統合。
- `DataConfig` を BottomSheet に props で渡す設計に変更。
- `getUpcomingTimetableEntries` のログレベルを verbose に変更。
- ESLint: `_` プレフィックス付きの未使用変数を許可。

### Optimized

- Repository: `stopsMetaMap` を導入し、stop metadata の O(n) lookup → O(1) lookup に改善。
- Repository: `getStopsForRoutes()` で lazy-initialized reverse map (route_id → Set<stop_id>) を実装。複数ルートの停留所解決が高速化。
- Repository: `getStopsInBounds()` / `getStopsNearby()` で pre-built `stopsMetaMap` を活用し、per-query assembly を廃止。

## [2026.03.26]

### Added

- `ContextualTimetableEntry` 型を導入 (Issue #66):
    - `WithServiceDate`: サービス日の文脈を持つ独立 interface (`readonly serviceDate`)。
    - `ContextualTimetableEntry`: `TimetableEntry` + `WithServiceDate` の合成型。
    - `UpcomingTimetableResult`: `getUpcomingTimetableEntries` 専用の Result 型。
    - overnight 便 (前日サービスの深夜便) の日時表示が1日ずれる問題を修正。
    - repo が `serviceDate` を付与し、Date ベースでソート (時系列順保証)。
    - UI は `entry.serviceDate` で `minutesToDate` を呼出 (serviceDay props 廃止)。
    - verbose 出力に `sd=` (サービス日)、repo ログに `serviceDay=`/`prev=` を追加。
    - `minutesToDate` テスト拡充 (境界値、overnight、月跨ぎ)。
- 時刻表モーダルを `TimetableEntry` ベースに移行:
    - 終点では到着時刻 (`arrivalMinutes`) を `nn着` と表示。
    - 終点/始発/乗車不可/降車不可ラベルを InfoLevel に応じて表示。
    - verbose: 全データダンプ (`VerboseEntryRow`, `VerboseMetadata`)。
    - 降車専用バス停の検出と表示 (`canBoard`, `omitted.terminal`)。
    - 路線フィルタと `TimetableMetadata` の連動。
- simple/normal で終点到着便を非表示 (乗車可能な便のみ表示)。
- 無効クエリパラメータの自動クリーンアップ (`cleanupInvalidQueryParams`)。
- MockRepository: 降車専用バス停、dwell time 路線、停車順序データ追加。
- `InfoLevelFlags.isSimpleEnabled` 追加。
- リソースチェックに `NEWER_AVAILABLE` warning を追加:
    - ローカルより新しい `feed_start_date` のリモートリソースを毎回検知。
    - `NEW_RESOURCE` (初回のみ) と異なり、適用されるまで常に表示。

### Removed

- v1 Repository および関連コード (v2 完全移行):
    - `AthenaiRepository`, v1 DataSource, `flatten-departures`。
    - `DepartureGroup`, `FlatDeparture`, `FullDayStopDeparture` 型。
    - `getFullDayDepartures` (旧 `number[]` API)。
    - `StopTimetableDeparture` 型 (`TimetableEntry` に統合)。
    - `RepoParam` から `'v1'` 削除。
- v1 pipeline を CI / npm scripts / ドキュメントから除去:
    - CI (`update-transit-data.yml`): v1 build / validate / Slack 通知を削除。
    - npm scripts: `pipeline:build:json`, `pipeline:build:odpt-train`, `pipeline:build:shapes:gtfs`, `pipeline:build:shapes:ksj`, `pipeline:validate` を削除。
    - `scripts/copy-pipeline-data.ts`: v1 sync ターゲット削除。
    - `public/data/` (v1 データ 28MB) を削除。
    - v1 ドキュメントを `pipeline/docs/v1-archive/` に移動。
    - v1 スクリプト (`pipeline/scripts/pipeline/app-data-v1/`) は参考用に残存。

### Fixed

- overnight 便 (前日サービスの 24:00+ 出発) の相対時刻・絶対時刻が1日ずれる問題 (#66):
    - NearbyStop、マーカー tooltip の両方で発生。
    - 影響: 伊予鉄バス (iyt2) 等の 27:00+ の便、03:00〜09:03 の時間帯。
- 多路線バス停で時刻表ダイアログ幅が不足しフィルタボタンが見切れる問題。

### Changed

- 時刻表ダイアログ幅: 固定 480px → `90dvw`。

## [2026.03.23]

### Added

- `data:sync` に v2 データ sync を追加 (`_build/data-v2/` → `public/data-v2/`)。
- CatalogOdpt スキーマを拡張 (`organizationUrl`, `datasetUrl`, `resourceUrl`, `resourceId`)。
- Pipeline ベンチマーク記録 (`PIPELINE-BENCHMARKS.md`)。
- SRT名古屋 (Smart Roadway Transit) データソース追加:
    - 名駅-栄間の循環バス路線 (1路線、7停留所、12便/日)。
    - CC BY 4.0、shapes.txt あり、translations 5言語。
    - HOME_LOCATIONS に名古屋、松山を追加。
- v2 GlobalInsightsBundle validator (`pipeline:validate:v2` Step 4):
    - global/insights.json の構造検証 (bundle_version, kind, stopGeo section)。
    - stopGeo エントリの spot-check (nr が number であること)。
    - stopGeo セクション不在時の warning。
- v2 GlobalInsightsBundle builder (`pipeline:build:v2-global-insights`):
    - stopGeo: per-stop 孤立度 (nr)、乗り換えポイント (wp)、connectivity (cn)。
    - connectivity: 300m 圏内のユニークルート数 (rc)、便数合計 (freq)、停留所数 (sc)。
    - 日曜/祝日ダイヤ (ho) 基準。全ソース横断の空間分析。
    - l=0 direct compute, l=1 parent 導出 (nr/wp=min, cn=direct)。
    - single-pass 全探索で 15,798 stops を 9.2秒で処理。
- v2 InsightsBundle builder (`pipeline:build:v2-insights`):
    - DataBundle の calendar セクションから曜日パターンで service groups を導出。
    - 既知パターン (wd/sa/su/wk/all) は短縮キー、未知パターンはビット列キーを生成。
    - 優先度順ソート (平日 → 土曜 → 日曜 → 週末 → 毎日 → その他)。
    - tripPatternGeo: パターンの地理的メトリクス (直線距離、経路距離、循環判定)。Haversine 距離で計算。
    - tripPatternStats: パターンの運行統計 (service group 別の頻度、各停留所からの残り所要時間)。
    - stopStats: 停留所の運行統計 (service group 別の頻度、路線数、route type 数、最早/最終出発時刻)。
- v2 ShapesBundle builders for GTFS and KSJ railway:
    - `pipeline/scripts/pipeline/app-data-v2/` に v2 shapes パイプラインを新規実装。
    - GTFS shapes.txt と国土数値情報 (KSJ) 鉄道路線の両データソースに対応。
    - `ShapesBundle` (`bundle_version: 2, kind: 'shapes'`) でラッパー付き出力。
    - `shape_dist_traveled` 対応 (v2 のみ。v1 は `stripShapeDistance` で除去)。
    - 抽出ロジックを `src/lib/pipeline/` に共有関数として集約。v1/v2 両方から利用。
- v2 DataBundle builders for GTFS and ODPT Train (#31):
    - `pipeline/scripts/pipeline/app-data-v2/` に v2 フォーマットの JSON バンドル生成パイプラインを新規実装。
    - GTFS (SQLite) と ODPT Train (JSON) の両データソースに対応。
    - `DataBundle` (stops, routes, timetable, tripPatterns, lookup, calendar, agency, feedInfo, translations) を1ファイルに統合出力。
    - 166 テストで品質担保。

### Fixed

- ODPT v1 builder が `odpt:destinationStation` を無視し、短距離折返し便 (有明行き等) が終点行きに混入する問題を修正 (#32)
- ODPT 深夜便の `00:xx` が `24:xx` に変換されず、時刻表で0時台に誤表示される問題を修正 (#34)
- ODPT ソースで平日の祝日に平日ダイヤが表示される問題を修正 (#36):
    - pipeline で日本の祝日 calendar_dates を自動生成。WebApp 変更不要。
    - calendar 有効期間を issued + 1年 → 2年に延長。
- `validate-app-data.ts`: 期限切れサービスを error から warning に変更。CI のデータ更新がブロックされる問題を修正 (#26)
- 京都市バスの CKAN resourceId と downloadUrl を最新版に更新 (date=20260309 → 20260323)。

### Changed

- pipeline/ ディレクトリ再構成 (#39, #40, #41, #42):
    - I/O データを `workspace/` に集約 (data/, state/, \_build/, \_archives/)
    - ソース定義とバッチ対象を `config/` に集約 (resources/, targets/)
    - 内部コード (lib/, types/) を `src/` に集約。entry point (scripts/) は直下に維持
    - `pipeline/src/lib/paths.ts` にパス定数を一元管理
    - `_` prefix で git 管理外ディレクトリを視覚的に分離
    - `scripts/` を `pipeline/` (CI/運用) と `dev/` (開発/調査) に分離
    - v1→v2 逆依存を解消。共有 utils を `src/lib/` に抽出
    - `src/lib/` をサブディレクトリで整理 (`pipeline/`, `download/`, `resources/`)
    - v2 builder lib を `src/lib/pipeline/app-data-v2/` に移動。scripts は thin entry point に
    - `app-data/` → `app-data-v1/` にリネーム (v1/v2 対称化)
    - ファイル名を自明に改名 (csv-utils → gtfs-csv-parser 等)

## [2026.03.18]

### Added

- 8つの新データソースを追加:
    - 🚈 つくばエクスプレス (首都圏新都市鉄道)
    - 🚌 西武バス
    - 🚌 京都市営バス
    - 🚌 伊予鉄バス
    - 🚌 京成バス千葉ウエスト
    - 🚌 大島バス (伊豆大島)
    - 🚌 三宅村営バス (三宅島)
    - 🚌 Kバス (北区コミュニティバス)
- Slack 通知 (composite action):
    - `.github/actions/slack-notify/` で Slack 通知を共通化。success / warning / failure / cancelled の4状態に対応。
    - `update-transit-data.yml`, `check-transit-resources.yml` の両ワークフローに統合。
    - 部分失敗や attention-level 警告を warning として通知。
- `check-odpt-resources.ts` に Result Summary セクションを追加:
    - `[RESULT:WARN]` / `[RESULT:ERROR]` 行でソース名付きの警告を出力。CI の Slack 通知で消費。

## [2026.03.17]

### Added

- ODPT リソース更新チェックツール (`npm run pipeline:check:odpt-resources`):
    - ODPT Members Portal API でリソースの有効期限、新規追加、削除を検知。
    - ダウンロードジョブ結果を `pipeline/state/download-meta/` に記録。
    - チェック結果スナップショットを `pipeline/state/check-result/` に保存 (result, warnings, errors 付き)。差分で新リソースを検知。
    - 警告レベル: EXPIRED/REMOVED/NO_VALID_DATA (exit 1), EXPIRING_SOON/NEW_RESOURCE/NO_DOWNLOAD_REPORT (exit 2)。
    - GitHub Actions `check-transit-resources.yml` で daily 自動実行 (UTC 05:00)。
- ソースメタデータ (`SourceMeta`):
    - `TransitRepository.getAllSourceMeta()` でソースごとの有効期間、バージョン、名前、routeTypes、統計情報を取得可能に。
    - 初期化ログにソースメタデータのサマリーを出力。
- ランダム初期表示位置:
    - 10箇所のプリセットからランダムに初期表示位置を選択 (場所ごとの zoom level 付き)。
    - サイコロボタン (🎲) で別のランダムな場所にジャンプ。
    - HOME ボタンは非表示 (将来の USER HOME 機能用にコード保持)。
- URL query params による初期位置指定:
    - `?lat=35.68&lng=139.77&zm=15` で初期表示位置を URL で指定可能。
    - 優先順位: query params > env variables > ランダム選択。
    - `VITE_INITIAL_ZOOM_LEVEL` env 変数を新規追加。
- query params の一元管理:
    - `src/utils/query-params.ts` に safe parsers を集約 (範囲バリデーション、injection 防止)。
    - `?mock-data`, `?sources` の既存処理もリファクタリング。
- 風ぐるま (千代田区コミュニティバス) のブランドカラー (`#E94185`) を設定。
- `describe-resources --verbose` にブランドカラー、認証情報、カタログ詳細等の全フィールドを出力。

### Fixed

- バス停選択時の路線ハイライトが、本日の運行が全て終了している場合に機能しない問題を修正。
    - `StopWithMeta` に `routes: Route[]` を追加 (timetable データから解決、共有参照)。
    - `extractRouteIdsForStop` が departure groups 空のとき `routes` にフォールバック。
- BottomSheet の事業者フィルター pill のコントラスト不足を修正。ブランドカラーの bg/text をそのまま使用。
- BottomSheet のフィルター行が横スクロール不可だった問題を修正。スクロールバー非表示の横スクロールを追加。
- 本番環境で INFO ログが出力されない問題を修正 (`VITE_LOG_TAGS` を `*` に設定)。
- CI workflow で untracked ファイルが検知されない問題を修正 (`git add` + `--cached`)。
- CI workflow の rerun 時に push が失敗する問題を修正 (`git pull --ff-only` を checkout 直後に追加)。

### Changed

- 型ファイル分割: `transit.ts` を GTFS ドメイン型 (安定) と `transit-composed.ts` アプリ合成型 (可変) に分離。
- PRD.md の URL パラメータ仕様に `lat`, `lng`, `zm` を追加。

## [2026.03.16]

### Added

- 事業者識別 (Agency) + i18n FK 化:
    - `StopJson` / `RouteJson` / `AgencyJson` から翻訳 (`m`) を削除し、`TranslationsJson` に一元化 (FK 化)。
    - `TranslationsJson` に `stop_names`, `route_names`, `agency_names`, `agency_short_names` を追加。
    - `StopJson` / `TimetableGroupJson` に `ai` (agency_id FK) を追加。
    - `AgencyJson` を拡張: `sn` (short_name), `tz` (timezone), `fu` (fare_url), `cs` (brand colors 配列)。
    - `Provider` 型を拡張: `name` (ja/en long/short), `colors` (brand colors)。
    - 全ソース定義にブランドカラーと short name を設定。
    - `Stop` ドメイン型に `agency_id` を追加。
    - `Agency` ドメイン型に `agency_short_name`, `agency_short_names`, `agency_timezone`, `agency_fare_url`, `agency_colors` を追加。
    - `DepartureGroup` / `FullDayStopDeparture` に `headsign_names` を追加。
    - `StopWithContext` に `agencies` を追加。
    - `RouteWithMeta` / `RouteWithContext` 型を新設。
    - `TransitRepository` に `getAgency()` メソッドを追加。
    - `AthenaiRepository.mergeSources` で翻訳 FK 解決、agencyMap 構築を実装。
    - headsign/stop_headsign 翻訳を事業者 (ソース) スコープで管理。異なる事業者の同一行先名 (例: 「練馬駅」) が独立した翻訳を保持。
- 路線形状 (shapes) パイプラインの分離:
    - GTFS shapes 抽出を `build-route-shapes-from-gtfs.ts` に分離。
    - KSJ 鉄道スクリプトを `build-route-shapes-from-ksj-railway.ts` にリネーム。
    - 全 shapes スクリプトを統一 CLI インターフェース (`<name>`, `--targets`, `--list`) に対応。
    - `shapes.json` をアプリ側で optional 化 (ファイルがないソースは `{}` にフォールバック)。
    - npm scripts: `pipeline:build:shapes:gtfs`, `pipeline:build:shapes:ksj`。

- 事業者バッジ表示とフィルタ:
    - `StopWithMeta` に `agencies: Agency[]` を追加。repo が timetable データから全 stop の事業者を解決。
    - `StopWithContext extends StopWithMeta` に変更 (stop, agencies の重複フィールドを排除)。
    - `AgencyBadge` コンポーネントを追加。NearbyStop カード、departure 行、時刻表モーダル、マーカー tooltip に事業者名を表示。
    - BottomSheet に事業者フィルタ PillButton を追加 (2事業者以上で表示)。
    - `filterStopsByAgency()`, `collectPresentAgencies()` domain 関数を追加。
    - `getAgencyDisplayNames` / `resolveAgencyDisplayName` / `translateAgencyName` (i18n 対応)。
    - RouteBadge に verbose IdBadge を追加 (HeadsignBadge, AgencyBadge と統一)。
- 共同運行路線分析ツール:
    - `pipeline/scripts/analysis/find-joint-routes.ts` を追加。ソース間で route_short_name が一致する路線を検出し、停留所名の突き合わせと座標による近接分析を行う。
    - `pipeline/lib/normalize-stop-name.ts` を追加。ソース間の stop_name 表記揺れ (「前」有無、ヶ/ケ、ノ/の) を正規化。
- 開発ツール入口:
    - `pipeline/scripts/dev-tools.ts` を追加。分析/開発ツールを対話的に選択実行。
    - npm script: `pipeline:dev-tools`。
- データ品質ドキュメント:
    - `pipeline/resources/NOTES.md` に共同運行路線の停留所差異パターン、コミュニティバスの運営主体乖離、route_short_name 通称問題を追加。

### Changed

- `describe-resources.ts` を `pipeline/scripts/analysis/` に移動。
- `visibleRouteShapes` のデフォルトを route_type 0-7 全てに拡大。
- パイプラインの出力方式をディレクトリ swap からファイルマージに変更。
  複数スクリプトが同一 outdir に出力しても互いのファイルを上書きしない。
  各スクリプトが MANAGED_FILES リストで管理責務を明示。
- リソース定義ファイルのフィールド順を BaseResource 定義順に統一。
- 重複テストファイル `pipeline/scripts/__tests__/build-app-data-from-gtfs.test.ts` を削除。

## [2026.03.14]

### Added

- データソースの追加:
    - ゆりかもめ (新交通ゆりかもめ) の時刻表・駅情報・路線形状に対応。
      ODPT Train API からアプリ用データを生成するパイプライン (`pipeline:build:odpt-train`) を新設。
    - 関東バス (ktbus) のデータソースを追加。
    - 京王バス (kobus) のデータソースを追加。
    - 杉並区グリーンスローモビリティの表示を有効化。
    - 風ぐるま (kazag) — 千代田区コミュニティバスを追加。6路線、shapes あり。
- 行先表示名リゾルバー (`getHeadsignDisplayNames`) を追加。
  行先の表示名を解決し、出発情報の UI コンポーネントに適用。
- 国土数値情報 (MLIT) からの鉄道路線形状生成を複数ソース対応に拡張。
  `mlitShapeMapping` を持つ全リソース (GTFS + ODPT JSON) を自動検出して処理。
- GTFS データパイプラインの大幅拡張 (Step 2+3)。
    - Build DB スキーマを GTFS 公式仕様 + GTFS-JP v3 の全34テーブルに拡張。
    - JSON 出力を5 → 8ファイル/ソースに拡張 (agency, feed-info, translations を追加)。
    - スキーマ定義を `pipeline/lib/gtfs-schema.ts` に分離し、設計判断をドキュメント化。
- 事業者情報/翻訳/フィードメタデータの型とデータフローを追加。
    - Route 型に `route_names` (多言語名)、`agency_id` を追加。Agency, FeedInfo 型を新規追加。
    - DataSource に optional な agencies, feedInfo, translations を追加。
    - `translateRouteName` で翻訳ルックアップを有効化。
- パイプラインドキュメント (`GTFS_TO_RDB.md`, `APP_DATA_FROM_GTFS.md`) を追加。
- route color の wildcard fallback 対応をパイプラインに追加。
- `buildAuthenticatedUrl` ユーティリティを抽出。
- AthenaiRepository に初期化統計ログ (info) とクエリ結果ログ (debug) を追加。
  fetch/merge の処理時間内訳、ソース別統計、truncation 件数を出力。
- FetchDataSource にファイル別 fetch タイミング/サイズの debug ログを追加。
- 行先が空の route に「行先が表示されない路線があります」注釈を表示。
  停留所カード、全路線時刻表、路線別時刻表の3箇所に対応。
- `?sources=` URL パラメータによるデータソース選択。
  `?sources=minkuru,yurimo` で指定ソースのみ、`?sources=all` で全ソース有効。
- perf profile に `maxResults` を追加 (lite=300, normal=3000, full=10000)。
  マーカー描画数をモードに応じて制限。
- モード切替 (perfMode, renderMode, infoLevel, theme) に info レベルログを追加。
- マーカー描画時間の計測ログ (debug) を StopMarkersCanvas に追加。
- 全4種のマーカーコンポーネントにクリック debug ログを追加。

### Changed

- `GtfsRepository` を `AthenaiRepository` にリネーム。
  `MAX_STOPS_RESULT` を `types/app/repository` から `transit-repository` に移動。
- `AthenaiRepository.create()` から `fetchSources()` / `mergeSources()` を分離。
- データ prefix のリネーム: tobus→minkuru (都営バス)、yrkm→yurimo (ゆりかもめ)。
- `SourceGroup` に `enabled` フィールドを追加 (必須)。デフォルトは enabled のみロード。
- `build-gtfs-db.ts` を単一ソース CLI に再設計。
  一括処理は `--targets` で子プロセス実行。安全なビルド (一時ファイル → リネーム) を実装。
- `pipeline-utils.ts` を `download-utils.ts` から分離し、汎用 CLI ユーティリティを独立モジュール化。
- `data-source-settings.json` を TypeScript (`data-source-settings.ts`) に変換。
- 高頻度マーカー描画ログを verbose レベルに降格。

### Fixed

- Vercel SPA fallback (200+HTML) により optional JSON の取得失敗がアプリ全体のデータ読み込みを阻害していた問題を修正。
- CSV ファイルが0件のソースディレクトリで既存 DB を空 DB で上書きする問題を修正。
- GTFS-JP v3 の `pattern_jp` スキーマ定義を修正。
- `getUpcomingDepartures` の debug ログで未定義変数 `truncated` を参照していた ReferenceError を修正。
- headsign が空文字の場合に React key が重複する問題を修正。
- 全ダイアログに `DialogDescription` を追加 (Radix アクセシビリティ警告の解消)。
- Canvas marker のクリックが動作しない問題を修正 (re-dispatch に座標情報が欠落)。
- ODPT train: 複数 railway のデータが正しく処理されない問題を修正。
- ODPT train: `computeDateRange` のうるう年処理を修正。
- ODPT train: `buildTimetable` / `buildTranslations` のキー衝突を修正。

## [2026.03.12]

初回リリース。atenai-v0 リポジトリからのポーティングと改善。

### Added

- プロジェクト基盤 (Vite, TypeScript, ESLint, Prettier, Vercel) の構築
- GTFS/ODPT データパイプライン (CSV → SQLite → JSON) の移植
- ウェブアプリ本体 (React, Leaflet, shadcn/ui) の移植
- プロジェクトドキュメント (PRD.md, CLAUDE.md, DEVELOPMENT.md, ABOUT.md)

### Fixed

- 当日の全便が終了した停留所の [時刻表] が表示されない不具合を修正。
  `handleShowStopTimetable` が upcoming departures に依存していたため、
  全便終了後は時刻表データが取得されなかった。
  新メソッド `getFullDayDeparturesForStop` を追加し解消。
- ダブルタップ検出時の再ディスパッチで修飾キー (Ctrl, Shift, Alt, Meta) が
  失われる問題を修正。
- `route-shape-polyline` のソート時に React key が不安定になる問題を
  `stableIndex` で修正。
- `use-stop-history` の localStorage 読み込み時に破損データでクラッシュする
  問題を修正。バリデーションを追加。
- `data-source-manager` の localStorage 読み込みに try/catch を追加。
