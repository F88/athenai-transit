# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [CalVer](https://calver.org/).

## [Unreleased]

### Added

- Build DB スキーマを GTFS 公式仕様 + GTFS-JP v3 の全34テーブルに拡張。
  どんな GTFS フィードが来ても CSV ファイルが SKIP されなくなる。
- パイプラインに agency.json, feed-info.json, translations.json の出力を追加 (5 → 8ファイル/ソース)。
- Route 型に `route_names` (多言語名) と `agency_id` を追加。
- Agency, FeedInfo 型を新規追加。
- DataSource にオプショナルな agencies, feedInfo, translations を追加。
  `fetchOptional` ヘルパーで 404 を graceful に処理。
- `translateRouteName` で `route_names` による翻訳ルックアップを有効化。

### Changed

- `build-gtfs-db.ts` を単一ソース CLI に再設計。
  一括処理は `--targets` で子プロセス実行。
  安全なビルド (一時ファイル → リネーム) を実装。
- `pipeline-utils.ts` を `download-utils.ts` から分離。
  汎用 CLI ユーティリティ (formatBytes, parseCliArg, runBatch 等) を独立モジュール化。
- DB ファイル名を `{prefix}.db` から `{outDir}.db` に変更 (入出力パスの対応を明確化)。
- `build-db` 用の独立したターゲットファイル (`pipeline/targets/build-db.ts`) を追加。

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
