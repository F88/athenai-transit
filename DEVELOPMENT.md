# Development Guide

> [!IMPORTANT]
> **データ量・ファイルサイズ・件数等の数値を本ドキュメントに記載する場合は、必ず計測日時 (YYYY-MM-DD) を併記すること。**
>
> **本ドキュメントに記載された数値情報を、無条件に「最新」「現状」として信じてはならない。** 数値はリポジトリの成長・データソース追加・パイプライン改修等によって急速に陳腐化する。判断・設計・見積もりに数値を使う前に、**必ず注記された日付を確認し、必要に応じて自分で再計測すること。**
>
> 日付の無い数値は、過去のある時点のスナップショットに過ぎず、現状を表していない可能性がある。発見した場合は速やかに再計測のうえ日付付きで更新すること。

このファイルは web app 開発の入口です。詳細な実装メモは [docs/README.md](./docs/README.md) から参照してください。

## Documentation Map

| Topic                                              | Document                                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| プロジェクト概要                                   | [README.md](./README.md)                                                                             |
| プロダクト要件                                     | [PRD.md](./PRD.md)                                                                                   |
| 詳細ドキュメント索引                               | [docs/README.md](./docs/README.md)                                                                   |
| Map / Leaflet / z-index / gesture                  | [docs/development/map-architecture.md](./docs/development/map-architecture.md)                       |
| Logger / runtime mode / query params / diagnostics | [docs/development/runtime-configuration.md](./docs/development/runtime-configuration.md)             |
| PWA / platform / iOS safe-area                     | [docs/development/platform-pwa.md](./docs/development/platform-pwa.md)                               |
| Styling / Tailwind / shadcn/ui                     | [docs/development/frontend-styling.md](./docs/development/frontend-styling.md)                       |
| Transit data / repository contracts                | [docs/development/transit-data-and-repository.md](./docs/development/transit-data-and-repository.md) |
| Dependency update notes                            | [docs/development/dependency-notes.md](./docs/development/dependency-notes.md)                       |
| Pipeline                                           | [pipeline/README.md](./pipeline/README.md)                                                           |

## Code Quality

### テスト

- 全ての `src/utils/`、`src/domain/` 関数にはテストコード必須
- `pipeline/src/lib/`、`pipeline/scripts/` の関数にもテスト必須
- エッジケースを含め品質を保証するテストとすること
- テストはタイムゾーンに依存しないこと (相対比較やエポックミリ秒を使用)
- Vitest の設定は `vitest.config.ts` に置き、`vite.config.ts` は app/build 設定に専念させる

### Lint / Format

コミット前に以下を実行:

```bash
npm run typecheck && npm run format && npm run lint:fix && npm run test && npm run build
```

### コーディング規約

- **TSDoc**: エクスポートする全ての関数と型定義には TSDoc (`@param`, `@returns`) を付与
- **命名**: 変数名/関数名は自明で的確にする。曖昧な命名を避ける
- **ブレース**: if 文は単行でも必ずブレースを付ける
- **意図コメント**: 実装が意図と異なって見える箇所には、選択理由を説明するコメントを付与

## File Placement

以下の配置ルールは web app の `src/` 配下に適用する。`pipeline/` は独立した data-build subsystem であり、root web app の配置ルールをそのまま適用しない。pipeline の実装詳細は [pipeline/README.md](./pipeline/README.md) と [pipeline/docs/](./pipeline/docs/) を参照する。

| ディレクトリ         | 配置基準                                                                     |
| -------------------- | ---------------------------------------------------------------------------- |
| `src/domain/`        | ドメイン固有の純粋関数 (例: transit ロジック、i18n)                          |
| `src/utils/`         | 汎用の純粋関数 (外部ライブラリ依存なし)                                      |
| `src/lib/`           | 外部ライブラリ依存ヘルパー (例: Leaflet)                                     |
| `src/hooks/`         | カスタム React Hooks (状態 + 副作用のオーケストレーション)                   |
| `src/components/`    | React コンポーネント (ロジックは import して使用)                            |
| `src/components/ui/` | shadcn/ui コンポーネント (CLI 管理)                                          |
| `src/repositories/`  | データアクセス層 (`TransitRepository` インターフェース)                      |
| `src/types/`         | 型定義                                                                       |
| `src/config/`        | 設定値                                                                       |
| `pipeline/`          | 独立したデータパイプライン ([pipeline/README.md](./pipeline/README.md) 参照) |

### 配置判断

ファイルの配置は「そのコードが何を知っているか」で判断する。

- `src/domain/`: アプリ固有の意味やルールを持つコード。何を表示するべきか、どう扱うべきかという判断を持つもの。
- `src/lib/`: 外部ライブラリやブラウザ API に依存する技術的な helper。Leaflet 操作、DOM 操作、adapter 的な処理。
- `src/utils/`: 依存が薄く、ドメイン知識をほとんど持たない純粋関数。`domain` と `lib` の代替置き場にしない。

### 依存方向

- `domain` と `lib` は直接依存させない
- `lib` から `domain` を import しない
- `domain` から `lib` を import しない
- domain と lib の両方から使いたい純粋関数は `src/utils/` に置く
- `hooks` / `components` は `domain`、`utils`、`lib` を組み合わせてよいが、非 UI ロジックを TSX に戻さない

### `src/domain/` の分割方針

- `src/domain/transit/`: GTFS、時刻表、route/stop、service day など transit 自体のルール
- `src/domain/map/`: 地図画面における選択、route shape 表示、layer 構築、map 向け filter など地図上の見せ方に関わるルール
- 新しいサブディレクトリは、既存の `transit` / `map` / `utils` / `lib` に自然に収まらないまとまりが継続的に増えた場合に限る

### mixed-purpose file

- 配置は補助的に何を使うかではなく、主たる責務で決める
- 技術的 helper とアプリ固有の判断が同居し、主たる責務が明確ならその責務側に置く
- 主たる責務が `lib` と `domain` / `utils` に割れる場合は分割を優先する
- `utils` は移動先が決めにくいファイルの避難先ではない

## App-level Orchestration

`src/app.tsx` のような app root では、単純な行数削減よりも state owner と side effect 境界の整理を優先する。

### App に残すもの

- 複数 subtree が同じ値を必要とし、`App` が minimum common ancestor になる state
- `MapView` と overlay / sheet の bridge になる state や callback
- hook 間の循環依存を切るための bridge ref

### App から外しやすいもの

- pure UI state (`Dialog` の open state など)
- one-shot startup effect
- pure selector / helper に切り出せる派生判断
- action outcome から UI message への変換

### helper と hook の分担

- business rule や fallback 契約は `src/domain/` / `src/utils/` の pure function に寄せる
- custom hook は state、effect、callback wiring に集中させる
- props bundle を返すだけの抽象化は避け、state owner / request lifecycle / side effect boundary のどれが移るのかを明確にする

### bridge ref の扱い

`ref` は常に悪ではない。hook 間 contract を切るための bridge ref が最小コストな場合は、安易に消さず意図をコメントで残す。

## Stop ID Lookup

`stop_id` から `StopWithMeta` を取得する方法は 2 系統ある。出所によって正しい lookup を選ぶこと。詳細は [docs/development/transit-data-and-repository.md](./docs/development/transit-data-and-repository.md) を参照。

| stop_id の出所                                                     | 使う lookup                                |
| ------------------------------------------------------------------ | ------------------------------------------ |
| 今クリックした map marker / viewport 内の即時 selection            | `findStopWithMeta(stopId)`                 |
| localStorage / URL / 設定 / 選択 route / 検索結果 / 過去セッション | `repo.getStopMetaByIds(new Set([stopId]))` |

迷ったら `repo.getStopMetaByIds` を使う。永続 ID に viewport-only lookup を使うと、ビューポート外で snapshot fallback になり、翻訳や最新 metadata が消える。

Stop selection 系は `live metadata` 優先、取得できない場合のみ `persisted snapshot fallback` を使う契約を helper と test で固定する。

## Setup

### Agent skills

外部 skill は手動でインストールが必要。clone 後に以下を確認する。

#### shadcn/ui

- [Skills - shadcn/ui](https://ui.shadcn.com/docs/skills)

## Pipeline Independence

`pipeline/` は web app へ静的データを供給する独立 subsystem。root docs は web app が生成物をどう利用するかを説明してよいが、pipeline 内部の source of truth にはしない。

pipeline 側を変更するときは [pipeline/README.md](./pipeline/README.md) と [pipeline/docs/](./pipeline/docs/) を優先して参照する。
