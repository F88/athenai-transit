# スクリーンショット索引

アプリの画面を撮ったものの索引。何の View かはディレクトリが示すので、この索引は画面の状態を記録する。

## 凡例

- **scope**: 画面全体 / 一部。一部の場合はどこを切り出したか
- **screen**: mobile / tablet / pc
- **theme**: light / dark
- **lang**: UI の表示言語。のりば名などが別言語で出ている場合は併記

## ディレクトリ

ディレクトリは、何を写したものかで分ける。

StopTimes の View を写したものは、Athenai Transit の `src/domain/transit/stop-time-views.ts` にある view id をそのまま名前に使う (2026-08-13 時点)。id が変わってもディレクトリ名は追随しないので、ずれたらこの表を直す。

View 以外を写したものは、その呼び名を使う。ダイアログやウィンドウなど、View とは関係のないディレクトリも増えていく。

| ディレクトリ              | 種別       | view id             | icon | ラベル      | 表示単位   |
| ------------------------- | ---------- | ------------------- | ---- | ----------- | ---------- |
| `stop-view/`              | View       | `stop`              | 🕐   | のりば      | のりば     |
| `route-headsign-view/`    | View       | `route-headsign`    | 🚌   | 路線 / 行先 | のりば     |
| `transit-display-2-view/` | View       | `transit-display-2` | 🖥️   | 発着案内    | 複数のりば |
| `route-view/`             | View       | `route`             | 🚏   | 路線        | 複数のりば |
| `transit-display-view/`   | View       | `transit-display`   | 📟   | 発着案内    | 複数のりば |
| `timetable-dialog/`       | ダイアログ | --                  | --   | 時刻表      | --         |
| `trip-inspection-dialog/` | ダイアログ | --                  | --   | 行程        | --         |
| `portal/`                 | その他     | --                  | --   | Anchor 一覧 | --         |

実装済みの View は上記 5 つ。`headsign` 🧭 行先、`frequency` 📊 頻度、`duration` ⏱ 乗車時間、`terminal` 🏬 終点の賑わい は `enabled: false` で、タブはグレーアウト表示になる。

## 命名規則

`<ディレクトリの呼び名>-<screen>-<地点>[-<変種>].png`

- **呼び名** はディレクトリ名から `-view` や `-dialog` といった接尾辞を除いたもの。`stop-view/` なら `stop`、`timetable-dialog/` なら `timetable`、`portal/` なら `portal`
- ディレクトリ名と重複するが、基底名だけで一意になるようにするため入れる。外部へ持ち出すとパスを失うことがある
- **地点** はローマ字。`kinshicho`、`nakano`、`oji`、`kyoto-nishigamo`、`venezia`、`freiburg`、`matsuyama`、`narukosaka-shita`
- **変種** は同じ場面で 1 つだけ変えたもの。集約半径 (`-100m`)、言語 (`-en`)、テーマ (`-dark`) など
- light は既定なので付けない。付いていなければ light
- 連番は使わない。何が違うのかが読み取れないため

## 置き場所の見分け方

`stop` と `route-headsign` は画面がよく似ている。並び方で判別する。

- **`stop` のりば** -- 1 のりばの便を時系列で並べる。1 行に 1 便で、系統が入り混じり、同じ系統が何度も出てくる
- **`route-headsign` 路線 / 行先** -- 系統と行先でグループ化する。1 グループに直近数便が入るので、1 行に複数の時刻が並ぶ

発着案内も 2 つある。`transit-display-2` 🖥️ がアプリ自身のデザイン、`transit-display` 📟 が発車標に似せた古典的な見た目。

## 一覧

| パス                                                                 | scope                 | screen | theme | lang                    | 地点                | 日時               | 内容                                                                                |
| -------------------------------------------------------------------- | --------------------- | ------ | ----- | ----------------------- | ------------------- | ------------------ | ----------------------------------------------------------------------------------- |
| `stop-view/stop-mobile-kinshicho.png`                                | 全体                  | mobile | light | ja                      | 錦糸町              | 6月1日 (月) 10:52  | 67 カ所 / 1km 圏内。錦糸公園前を選択中。各便に行程内の現在位置のドット              |
| `stop-view/stop-tablet-venezia.png`                                  | 全体                  | tablet | light | en                      | ヴェネツィア        | Jun 1 (Mon) 10:59  | 26 カ所 / 1km 圏内。水上バス。距離リングと選択時のツールチップ                      |
| `stop-view/stop-pc-oji.png`                                          | 全体                  | pc     | light | ja                      | 王子                | 6月1日 (月) 10:44  | 25 カ所 / 500m 圏内。都バス・都電荒川線・東京メトロが同じ一覧に並ぶ                 |
| `route-headsign-view/route-headsign-mobile-kinshicho.png`            | 全体                  | mobile | light | ja                      | 錦糸町              | 6月1日 (月) 10:51  | 72 カ所 / 1km 圏内。エッジマーカーと距離リング。面の密度がそのまま出ている          |
| `route-headsign-view/route-headsign-tablet-freiburg.png`             | 全体                  | tablet | light | en (地名は独語)         | フライブルク        | 1. Juni (Mo) 10:56 | 16 カ所 / 1km 圏内。海外データソース (VAG)                                          |
| `route-headsign-view/route-headsign-pc-kyoto-nishigamo.png`          | 全体                  | pc     | light | ja (英語・韓国語を併記) | 西賀茂車庫前 (京都) | 6月1日 (月) 10:31  | 41 カ所 / 1km 圏内。地形の見えるベースマップと路線網                                |
| `route-view/route-mobile-matsuyama.png`                              | 一部 (StopBrowser)    | mobile | light | ja                      | 松山                | 11 時台            | 71 カ所 / 1km 圏内。高速バスの到着便。路線ごとにボードが分かれる                    |
| `route-view/route-mobile-matsuyama-en-dark.png`                      | 一部 (StopBrowser)    | mobile | dark  | en                      | 松山                | 11 時台            | 上と同じ場面の英語・ダーク版                                                        |
| `transit-display-2-view/transit-display-2-mobile-kinshicho-100m.png` | 全体                  | mobile | light | ja                      | 錦糸町              | 6月19日 (金) 15:00 | 集約半径 100m。ボードの指標は 270 便                                                |
| `transit-display-2-view/transit-display-2-mobile-kinshicho-150m.png` | 全体                  | mobile | light | ja                      | 錦糸町              | 6月19日 (金) 15:00 | 集約半径 150m。ボードの指標は 433 便                                                |
| `transit-display-2-view/transit-display-2-mobile-nakano-200m.png`    | 全体                  | mobile | light | ja                      | 中野                | 6月19日 (金) 15:00 | 集約半径 200m。関東バスと京王バスが同じボードに並ぶ                                 |
| `transit-display-2-view/transit-display-2-mobile-kyoto-en.png`       | 全体                  | mobile | light | en (のりば名は韓国語)   | 京都駅前            | 6月10日 (水) 17:20 | 116 カ所 / 1km 圏内。翻訳名の表示                                                   |
| `transit-display-2-view/transit-display-2-mobile-kyoto-en-dark.png`  | 全体                  | mobile | dark  | en (のりば名は韓国語)   | 京都駅前            | 6月10日 (水) 17:20 | 上と同じ場面のダーク版                                                              |
| `transit-display-view/transit-display-pc-kinshicho.png`              | 一部 (ボードのみ)     | pc     | dark  | ja                      | 錦糸町              | 16:36 以降         | 黒地に琥珀色の等幅。時刻は絶対時刻のみで相対時間なし                                |
| `timetable-dialog/timetable-mobile-narukosaka-shita.png`             | 全体 (ダイアログ)     | mobile | light | ja                      | 成子坂下 (新宿)     | 2026/06/01 11:01   | 一日分 80 本、06:33 から 22:32、平均 12 分間隔。行先で絞り込める                    |
| `trip-inspection-dialog/trip-mobile-narukosaka-shita.png`            | 全体 (ダイアログ)     | mobile | light | ja                      | 成子坂下 (新宿)     | 6月1日 (月) 11:01  | 新宿駅西口 10:58 から王子駅前 12:12。進捗 3/47                                      |
| `portal/portal-mobile-anchors.png`                                   | 全体 (ドロップダウン) | mobile | light | ja                      | 中野から新宿        | 6月1日 (月) 11:02  | Anchor 一覧。国内外と事業者が混在 (VAG、三和商船、西東京バス、はむらん、りんかい線) |

## 補足

**対で使える組が 3 つある。**

- `transit-display-100m` と `-150m` -- 同じ地点・同じ日時で集約半径だけが違う
- `transit-display-light` と `-dark` -- 同じ場面のテーマ違い
- `pick-up-arrival-1` と `-2` -- 同じ場面の言語とテーマ違い

**`transit-display-200m.png` は地点が違う。** 中野で撮ったもので、100m と 150m の錦糸町とは比較にならない。半径の比較に 3 枚並べないこと。

**到着表示は View ではない。** `route-view/` の 2 枚が到着になっているのは、松山市駅がそれらの高速バスの終点だから。のりばの位置によって出発と到着が切り替わる。

**錦糸町の 2 枚は古いビルドの可能性がある。** `route-headsign-mobile-kinshicho.png` と `stop-mobile-kinshicho.png` は、タブ列に発着案内の 2 つ (🖥️ 📟) が見当たらず、撮影日も 6月1日で transit-display 系の 6月19日より前。断定はできない。

## 記録されていない属性

画面から判別できなかったもの。必要になったら撮影者が補う。

- 情報レベル (InfoLevel)
- 動作モード (PerfMode)
- 描画モード (RenderMode)
- 有効化していたデータソースの正確な一覧
- 撮影に使ったブラウザと端末
