# Development Docs

web app の設計・実装に関する詳細ドキュメント。
開発者向けの入口は [../../DEVELOPMENT.md](../../DEVELOPMENT.md)、ドキュメント全体の索引は [../README.md](../README.md) を参照。

| File                                                                         | Purpose                                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [system-architecture.md](./system-architecture.md)                           | GitHub Actions、pipeline、Vercel 配信の簡易システム構成。                      |
| [map-architecture.md](./map-architecture.md)                                 | MapView hoist、layout mode、z-index、pan/zoom、click/tap event 制御。          |
| [runtime-configuration.md](./runtime-configuration.md)                       | Logger、mode 定義、URL parameter、MockRepository、diagnostics。                |
| [platform-pwa.md](./platform-pwa.md)                                         | PWA cache、platform behavior、iOS standalone / safe-area。                     |
| [frontend-styling.md](./frontend-styling.md)                                 | Tailwind CSS、Prettier、ESLint、shadcn/ui、Dialog / ScrollFadeEdge。           |
| [transit-data-and-repository.md](./transit-data-and-repository.md)           | Stop ID lookup、GTFS i18n、TransitRepository API。                             |
| [timetable-stop-event-state-model.md](./timetable-stop-event-state-model.md) | 停車イベントの state model(2軸: faithful / passenger)。Issue #162 の決定記録。 |
| [web-storage.md](./web-storage.md)                                           | Web Storage 取得 / availability hook、SSOT semantics、不可時の挙動。           |
| [storage.md](./storage.md)                                                   | Storage を背景に持つ各 repository の挙動仕様。                                 |
| [dependency-notes.md](./dependency-notes.md)                                 | 依存更新の注意事項。                                                           |
