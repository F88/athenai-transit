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

web app の設計・実装に関する詳細ドキュメントは [development/](./development/README.md) を参照。

## Pipeline independence

`pipeline/` is an independent data-build subsystem. Root web app docs may link to pipeline outputs or high-level responsibilities, but pipeline implementation details belong to [../pipeline/README.md](../pipeline/README.md) and [../pipeline/docs/](../pipeline/docs/).

When changing pipeline code, follow pipeline docs and commands. Do not treat root `DEVELOPMENT.md` placement rules as the primary source for `pipeline/` internals.
