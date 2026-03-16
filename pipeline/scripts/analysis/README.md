# Analysis Scripts

`public/data/` の JSON データを分析するスクリプト群。データ品質の確認やソース間の比較に使用する。

## スクリプト一覧

| スクリプト              | 概要                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `describe-resources.ts` | リソース定義の一覧表示 (`npm run pipeline:describe`)                                                                   |
| `find-joint-routes.ts`  | 共同運行路線の検出。ソース間で route_short_name が一致する路線を検出し、停留所名の突き合わせと座標による近接分析を行う |

## 実行方法

```bash
# 入口スクリプトから選択実行
npm run pipeline:dev-tools

# 個別実行
npx tsx pipeline/scripts/analysis/describe-resources.ts
npx tsx pipeline/scripts/analysis/find-joint-routes.ts
```
