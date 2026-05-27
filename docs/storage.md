# Storage Repositories

Web Storage を背景に持つ各 repository の挙動仕様。 ブラウザ Web Storage API 自体の取り扱いは [web-storage.md](./web-storage.md) を参照。

## AnchorRepository

Anchor (お気に入り Stop) を扱う repository インターフェース。 具体的な永続化先 (`localStorage` / Web API / mock 等) には依存しない。

- Read 系 (`getAnchors`) と Write 系 (`addAnchor` / `removeAnchor` / `updateAnchor` / `batchUpdateAnchors`) のすべてが `Promise<Result<T>>` を返す
- 操作失敗時は `Result.failure` を返す (例外を投げない)

### LocalStorageAnchorRepository

`AnchorRepository` の `localStorage` 実装。

| 状況                                                               | Read 系                                                               | Write 系                                               |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------ |
| `localStorage` が使える                                            | 通常通り読み出し                                                      | 通常通り永続化                                         |
| `localStorage` が使えない (例: getter が `SecurityError` を投げる) | 空配列を success で返す (= 「未登録」 と区別できない silent fallback) | `Result.failure` を返す。 in-memory 状態も更新されない |

#### Anchor の既知の問題

- Read 系の silent fallback により、 「データなし」と「読み込み失敗」が呼び出し側で区別できない
- Write 系の失敗時に in-memory 状態が更新されないため、 UI 上もアンカーが追加 / 変更されない

## StopSelectionRepository

Stop 選択履歴を扱う repository インターフェース。 具体的な永続化先には依存しない。

- Read (`getHistory`) と Write (`saveHistory` / `clearHistory`) のすべてが `Promise<Result<T>>` を返す
- 操作失敗時は `Result.failure` を返す (例外を投げない)

### LocalStorageStopSelectionRepository

`StopSelectionRepository` の `localStorage` 実装。

| 状況                                                               | Read (`getHistory`)                                                              | Write (`saveHistory` / `clearHistory`) |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------- |
| `localStorage` が使える                                            | 通常通り読み出し                                                                 | 通常通り永続化                         |
| `localStorage` が使えない (例: getter が `SecurityError` を投げる) | `Result.failure` を返す (呼び出し側に「読み込み失敗」が伝わる、 silent ではない) | `Result.failure` を返す                |

## UserSettings

ユーザー設定 (表示言語、 テーマ、 `tileIndex`、 `infoLevel` 等) の永続化。 DataSourceSelectionStorage と同様、 interface / class 抽象を持たず、 module-level 関数として実装されている。 ストレージキーは `athenai-settings`、 実装は 2 ファイルに分散:

- `src/hooks/use-user-settings.ts`: `loadSettings()` / `saveSettings()` (全フィールド読み書き) + `useUserSettings()` hook
- `src/lib/app-theme.ts`: `loadStoredAppTheme()` (theme のみ抽出、 早期 paint 用)

| 状況                                                               | Read (`loadSettings` / `loadStoredAppTheme`) | Write (`saveSettings`)                   |
| ------------------------------------------------------------------ | -------------------------------------------- | ---------------------------------------- |
| `localStorage` が使える                                            | 通常通り読み出し                             | 通常通り永続化                           |
| `localStorage` が使えない (例: getter が `SecurityError` を投げる) | DEFAULTS / `'light'` を返す (silent)         | silent fail (try/catch + `logger.error`) |

### UserSettings の既知の問題

- Read 失敗を silent fallback (DEFAULTS / `'light'`) で返すため、 「未保存」 と「読み込み失敗」 を呼び出し側で区別できない (DataSourceSelectionStorage と同じ silent 問題)
- 他 storage 系統と異なり interface / class 抽象を持たない。 `localStorage` 固定の暗黙前提

## DataSourceSelectionStorage

データソース選択 (= 有効化されたグループ id の集合) の永続化。 上記 2 系統と異なり、 interface / class 抽象を持たず、 module-level の export 関数として実装されている (`loadEnabledGroupIdsFromStorage` / `saveEnabledGroupIdsToStorage` / `clearStoredEnabledGroupIds`)。 配置も `src/repositories/` ではなく `src/domain/datasource/`。

| 状況                                                               | Read (`loadEnabledGroupIdsFromStorage`)           | Write (`saveEnabledGroupIdsToStorage` / `clearStoredEnabledGroupIds`) |
| ------------------------------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------- |
| `localStorage` が使える                                            | 通常通り読み出し                                  | 通常通り永続化                                                        |
| `localStorage` が使えない (例: getter が `SecurityError` を投げる) | `null` を返す (silent。 「未登録」と区別できない) | silent no-op                                                          |

### DataSourceSelectionStorage の既知の問題

- Read 失敗を silent `null` fallback で返すため、 「未登録」 と「読み込み失敗」 を呼び出し側で区別できない。 過去に保存済みの選択がある状況で storage 不可になると、 ユーザーには **設定がデフォルトに戻ったように見える**
- Write / Remove も silent no-op で、 永続化失敗が呼び出し側に伝わらない
- 他 2 系統と異なり interface / class 抽象を持たない。 `localStorage` 固定の暗黙前提が呼び出し側に染み込む構造
