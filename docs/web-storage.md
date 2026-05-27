# Web Storage

ブラウザの `localStorage` (および将来的に `sessionStorage`) を安全に扱うための実装ガイド。 要件定義は [PRD 3.H](../PRD.md) を参照。

## 概要

設定 / Stop 選択履歴 / Anchor / 有効化データソースは `localStorage` に永続化する。ブラウザ設定 (Chrome の「全 Cookie とサイトデータをブロック」等) やプライベートモードでは `globalThis.localStorage` の getter 自体が `SecurityError` を投げる場合があり、 default parameter での評価で起動 crash する不具合があった (Issue #237)。

現在の実装は以下のレイヤーで Web Storage の不可状態に対応する。

| レイヤー     | 役割                                                               | ファイル                                    |
| ------------ | ------------------------------------------------------------------ | ------------------------------------------- |
| Resolver     | `globalThis.localStorage` の安全取得 (throw を `undefined` に変換) | `src/lib/web-storage-resolver.ts`           |
| Hook         | resolver の結果を React tree から参照する手段                      | `src/hooks/use-web-storage-availability.ts` |
| Item wrapper | 1 key に対する read/write/remove の result 化                      | `src/lib/web-storage-item.ts`               |
| Repository   | 各機能 (Anchor / Stop history) の永続化 API                        | `src/repositories/...`                      |
| App / UI     | ユーザー通知、 UI 制限の発火点                                     | `src/app.tsx`                               |

## API

### `resolveWebStorage(kind: WebStorageKind): Storage | undefined`

`globalThis.localStorage` / `globalThis.sessionStorage` を try/catch で安全に評価する。 getter が throw した場合は `undefined` を返す。

```ts
import { resolveWebStorage } from '@/lib/web-storage-resolver';

const storage = resolveWebStorage('local');
if (storage) {
    storage.setItem('key', 'value');
}
```

repo / 非 React コード (class constructor 等) から使う。

### `isWebStorageAvailable(kind: WebStorageKind): boolean`

`resolveWebStorage` の boolean 形。 「使えるか否か」だけ知りたい場面で使う。

```ts
import { isWebStorageAvailable } from '@/lib/web-storage-resolver';

if (!isWebStorageAvailable('local')) {
    // graceful degradation
}
```

### `useWebStorageAvailability(kind: WebStorageKind): boolean`

React hook。 初回 mount 時に `isWebStorageAvailable` をキャプチャして `useState` に保持する。 戻り値は component の lifetime を通じて安定。

```ts
import { useWebStorageAvailability } from '@/hooks/use-web-storage-availability';

function Anchor() {
  const isWebStorageReady = useWebStorageAvailability('local');
  if (!isWebStorageReady) {
    return null; // hide UI when storage cannot persist
  }
  return <AnchorButton />;
}
```

App では `isWebStorageReady` という名前で取得し、 起動時通知 toast の発火条件として使っている (`src/app.tsx`)。

## SSOT semantics

`useWebStorageAvailability` は **弱い SSOT** として実装されている。

- 各 caller (component / custom hook) は自分専用の `useState` スロットを持つ
- 同じ session 内では `isWebStorageAvailable` が同じ値を返すため、 全 caller で値が一致する
- 「同じメモリ位置を参照している」のではなく「独立に同じ事実をコピーしている」

### なぜ弱い SSOT で十分か

`localStorage` の availability は session 内で変化しない前提があるため、 各 caller が独立に resolver を呼んでも結果が一致する。 厳密 SSOT (= caller 間で同一スロットを共有) のメリットはほぼゼロ。

### 厳密 SSOT が必要になったら

resolver の結果が動的に変わる要件が出た場合、 以下のいずれかで格上げ可能 (call site は変えずに済む):

- **案 a**: `web-storage-resolver.ts` に lazy freeze cache を追加し、 hook はそれを `useState` 初期値として読む
- **案 b**: `WebStorageAvailabilityProvider` (React Context) を導入し、 hook は `useContext` で読む

現状は案 a / b いずれも未導入。 必要になった時点で議論する。

## 使い分け

| 呼び出し元                            | 使う API                                           | 理由                                 |
| ------------------------------------- | -------------------------------------------------- | ------------------------------------ |
| React component / custom hook         | `useWebStorageAvailability`                        | mount 時 1 回キャプチャ + 値の安定性 |
| Repository constructor / 非 React lib | `resolveWebStorage` / `isWebStorageAvailable`      | hook は React 内でしか呼べない       |
| 1 key のラップ                        | `WebStorageItem` (`storage: Storage \| undefined`) | acquisition は呼び出し側が担う       |

`WebStorageItem` は default parameter (`= globalThis.localStorage`) を持たない。 acquisition (= どの Storage を渡すか) は呼び出し側の責務、 という境界。 詳細は同ファイルの TSDoc を参照。

## 現状の実装範囲

| 要件 (PRD 3.H)                         | 状態                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 起動 crash 回避                        | 対応済み (Issue #237)                                                                                               |
| 起動時 1 回のユーザー通知              | 対応済み (`storage.unavailable` toast、 `duration: Infinity`、 close button あり)                                   |
| 永続化機能の in-memory 動作            | **未対応**。 anchor / stop-history は load 失敗で空配列にフォールバックするが、 session 内追加 / 変更は反映されない |
| 個別の save 失敗 toast 抑制            | **未対応**。 anchor / stop-history の save 失敗で error toast が出る                                                |
| UI 制限                                | **未対応**。 anchor ボタン等が unavailable 時にも表示される                                                         |
| transient な保存失敗 (Quota 等) の通知 | 既存の repo / hook で処理されている                                                                                 |

未対応項目は別 issue / PR で段階的に対応する。

## テスト

`globalThis.localStorage` の getter が throw する状態を再現するには `Object.defineProperty` で descriptor を差し替える。

```ts
const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
        throw new DOMException('Access denied', 'SecurityError');
    },
});

try {
    // exercise the code path
} finally {
    if (originalDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
    }
}
```

実例:

- `src/lib/__tests__/web-storage-resolver.test.ts` — resolver / availability の直接テスト
- `src/hooks/__tests__/use-web-storage-availability.test.tsx` — hook テスト
- `src/repositories/stop-selection/__tests__/local-storage-stop-selection-repository.test.ts` — repo constructor の crash 回避テスト
- `src/__tests__/app.test.tsx` — 起動 crash 回避 + 起動時 toast 発火テスト

## 手動再現

Chrome の場合: 設定 → プライバシーとセキュリティ → サイトの設定 → Cookie とサイトデータ → 「すべての Cookie をブロック」または該当 origin を block 一覧に追加。 リロードすると `localStorage` getter が `SecurityError` を投げる状態になる。

開発時はこの状態で `npm run dev` を起動し、 `App` がエラーバウンダリに落ちず、 「ストレージが利用できません」 toast が表示されることを確認する。
