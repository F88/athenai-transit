# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [CalVer](https://calver.org/).

## [Unreleased]

### Fixed

- i18n: GTFS base values (stop_name, trip_headsign 等) を `feed_lang` キーで translation names に注入し、`lang=ja` で英語 headsign が表示される問題を修正 (#107)。

### Added

- DEVELOPMENT.md: GTFS i18n 仕様 (`feed_lang` / `agency_lang` / `translations.txt`) のリファレンスセクションを追加。

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
