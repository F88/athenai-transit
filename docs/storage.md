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
