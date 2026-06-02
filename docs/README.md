# Documentation Index

このディレクトリは、root の `README.md` / `PRD.md` / `DEVELOPMENT.md` から分離した詳細ドキュメントを置く場所です。

## Root documents

| File                                   | Purpose                                                        |
| -------------------------------------- | -------------------------------------------------------------- |
| [../README.md](../README.md)           | プロジェクトの入口。概要、主な機能、主要ドキュメントへの導線。 |
| [../PRD.md](../PRD.md)                 | プロダクト要件。何を作るか、ユーザー体験、機能要件。           |
| [../DEVELOPMENT.md](../DEVELOPMENT.md) | 開発者向け入口。品質基準、配置ルール、頻出判断。               |
| [../CHANGELOG.md](../CHANGELOG.md)     | リリース前後の変更履歴。                                       |

## Web app implementation docs

| File                                                               | Purpose                                                               |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [system-architecture.md](./system-architecture.md)                 | GitHub Actions、pipeline、Vercel 配信の簡易システム構成。             |
| [map-architecture.md](./map-architecture.md)                       | MapView hoist、layout mode、z-index、pan/zoom、click/tap event 制御。 |
| [runtime-configuration.md](./runtime-configuration.md)             | Logger、mode 定義、URL parameter、MockRepository、diagnostics。       |
| [platform-pwa.md](./platform-pwa.md)                               | PWA cache、platform behavior、iOS standalone / safe-area。            |
| [frontend-styling.md](./frontend-styling.md)                       | Tailwind CSS、Prettier、ESLint、shadcn/ui、Dialog / ScrollFadeEdge。  |
| [transit-data-and-repository.md](./transit-data-and-repository.md) | Stop ID lookup、GTFS i18n、TransitRepository API。                    |
| [web-storage.md](./web-storage.md)                                 | Web Storage 取得 / availability hook、SSOT semantics、不可時の挙動。  |
| [storage.md](./storage.md)                                         | Storage を背景に持つ各 repository の挙動仕様。                        |
| [dependency-notes.md](./dependency-notes.md)                       | 依存更新の注意事項。                                                  |

## Pipeline independence

`pipeline/` is an independent data-build subsystem. Root web app docs may link to pipeline outputs or high-level responsibilities, but pipeline implementation details belong to [../pipeline/README.md](../pipeline/README.md) and [../pipeline/docs/](../pipeline/docs/).

When changing pipeline code, follow pipeline docs and commands. Do not treat root `DEVELOPMENT.md` placement rules as the primary source for `pipeline/` internals.
