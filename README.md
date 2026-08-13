# あてのない乗換案内 Athenai Transit

| Job                     | Status                                                                                                                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Update Transit Data     | [![Update Transit Data (Vercel Blob)](https://github.com/F88/athenai-transit/actions/workflows/upload-transit-data-to-vercel-blob.yml/badge.svg)](https://github.com/F88/athenai-transit/actions/workflows/upload-transit-data-to-vercel-blob.yml) |
| Check Transit Resources | [![Check Transit Resources](https://github.com/F88/athenai-transit/actions/workflows/check-transit-resources.yml/badge.svg)](https://github.com/F88/athenai-transit/actions/workflows/check-transit-resources.yml)                                 |

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/F88/athenai-transit)
[![View Code Wiki](https://www.gstatic.com/_/boq-sdlc-agents-ui/_/r/YUi5dj2UWvE.svg)](https://codewiki.google/github.com/f88/athenai-transit)

Transit explorer without destination — discover where you can go from here

目的地を入力しない、お散歩支援型の乗換案内Webアプリ。「今、ここからどこへ行けるか」という偶然の発見と街歩きの楽しさを提供します。

## Key Features

- 📍 Display nearby bus stops and stations on the map
- 👈 Edge markers indicating the direction of off-screen stops
- 🕐 Departure and arrival information for nearby stops
- 🖥️ Consolidated transit display grouping multiple stops
- 📅 Check future timetables by specifying any date and time
- 🗺️ View route maps and highlight specific routes
- 🚏 Save your favorite stops and stations
- 🌐 Multilingual support and language switching
- 📦 Select and use custom datasets
- ⌨️ Keyboard shortcuts (help:?)

## 主な機能

- 📍 現在地周辺のバス停や駅を地図上に表示
- 👈 画面外のバス停の方向を示すエッジマーカー
- 🕐 近くののりばの発着情報
- 🖥️ 複数ののりばをまとめた総合発着案内
- 📅 任意の日時を指定、未来の時刻表確認
- 🗺️ 路線図の表示と路線のハイライト
- 🚏 お気に入りのバス停や駅の保存
- 🌐 多言語表示と言語切替
- 📦 任意のデータを選択して利用
- ⌨️ キーボードショートカット (help:?)

## 今後の開発予定

- デスクトップ向けのUI改善
- 運行頻度などの統計情報の活用
- 新たなViewの追加

## Documentation

- [PRD.md](./PRD.md) -- プロダクト要件、ユーザー体験、機能要件
- [DEVELOPMENT.md](./DEVELOPMENT.md) -- 開発者向け入口、品質基準、配置ルール
- [docs/README.md](./docs/README.md) -- 詳細ドキュメント索引
- [pipeline/README.md](./pipeline/README.md) -- 独立したデータパイプライン
