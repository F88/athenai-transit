---
name: data-licensing
description: >
    Data licensing rules for transit data sources used in this project.
    Use when adding a new data source, updating ABOUT.md credits, editing
    resource definition license fields, or when the user asks about license
    compliance, credit display, or data usage terms.
---

# Data Licensing

License compliance rules for transit data used in this project. Each data source has specific credit display and usage requirements.

## Golden Rule

Never guess license information. Always verify from the primary source (CKAN catalog page, ODPT developer site) before writing license fields or credit text.

## License Types in Use

### 1. CC BY 4.0 (Creative Commons Attribution 4.0 International)

CC BY 4.0 data we use reaches the app through two distinct distribution paths. The license itself is the same, but the credit-text authority differs by path, so handle each separately.

**Resource definition** (both paths):
`license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }`

#### 1a. CC BY 4.0 distributed via ODPT

**Applies to**: datasets where `catalog.type === 'odpt'` and the CKAN dataset page lists CC BY 4.0 as the license (e.g. Toei Bus / Toei Train GTFS, 千代田区風ぐるま, 北区Kバス, 三宅村営バス, 杉並区グリーンスローモビリティ, 京成バス千葉ウエスト, 名古屋市 SRT).

**Authoritative reference**: ODPT FAQ
"Q: How can I give credit, etc. when using CC BY 4.0 licensed data?"
<https://developer.odpt.org/en/faq-info#cc-by-credit>

Always consult this FAQ first. It specifies both the exact template wording and how to resolve the provider name.

**Credit display** (ABOUT.md): Use the FAQ's "modified content" template (we transform GTFS / ODPT JSON into the app's v2 JSON):

- Intro phrase: `本アプリケーションは以下の著作物を改変して利用しています。`
- Per entry: `[コンテンツ等の提供者名] - [コンテンツ等の名称]`
- The license name + URL is carried by the H4 heading above the list, so we omit it from each bullet (CC BY 4.0 §3(a)(2) "reasonable manner").

**Resolving "コンテンツ等の提供者名"** (per the FAQ):

1. If the CKAN dataset page has an explicit credit-display section ("クレジット表示に関する情報" / "コンテンツ等の提供者名"), use that string verbatim, including its separator characters (e.g. `東京都交通局・公共交通オープンデータ協議会`).
2. Otherwise, use the CKAN organization name (the entity behind `catalog.organizationUrl`). Do NOT add adjacent municipalities or commissioners unless they are explicitly designated as a provider on the CKAN page.

**Resolving "コンテンツ等の名称"**: Use the CKAN dataset title verbatim (e.g. `千代田区地域福祉交通「風ぐるま」`). Do NOT use the resource-level name — resource names carry version dates and other catalog-side noise (`-20260401`, `GTFS/GTFS-JP`, etc.) and are not stable.

#### 1b. CC BY 4.0 distributed outside ODPT

**Applies to**: datasets where `catalog.type !== 'odpt'` (`'direct'` / `'municipal'`) and the catalog still licenses the data under CC BY 4.0 (e.g. ACTV Venezia via dati.venezia.it, ハチ公バス via Shibuya open data, ちぃばす via Minato open data).

**The ODPT FAQ does not apply here.** Use the credit text required by the actual distribution page. If the page does not designate a specific format, default to: `[publisher named on the distribution page] - [dataset title on the distribution page]`. Always verify against the distribution page before writing credit text.

### 2. Public Transportation Open Data Basic License

**Applies to**: Yurikamome ODPT JSON data (and future ODPT Basic License sources)

**Full text**: `https://developer.odpt.org/terms/data_basic_license.html`

**Key requirements** (Article 10.3):

1. Announce to users that the Center, Association, and Data Provider do not guarantee accuracy or integrity of the data
2. State developer contact information for inquiries about the app
3. Make efforts so that inquiries are not sent directly to the Data Provider

**Additional rules** (Article 4):

- Data must only be displayed within the Deliverable (Article 4.2(3))
- Raw data redistribution is prohibited (Article 8.4(1)); transformed data in the app is OK
- Commercial and non-commercial use are both permitted (Article 4.7)

**Credit display** (ABOUT.md): Must include all three items from Article 10.3. Example:

```
本アプリケーションは、公共交通オープンデータセンターにおいて提供されるデータを利用しています。
- 事業者: [operator name]
- ライセンス: 公共交通オープンデータ基本ライセンス (URL)
公共交通オープンデータセンターから提供されるデータの正確性・完全性は保証されません。
本アプリケーションに関するお問い合わせは...開発者にご連絡ください。
```

**Resource definition**: `license: { name: '公共交通オープンデータ基本ライセンス', url: 'https://developer.odpt.org/terms/data_basic_license.html' }`

## Where to Update

| What                  | Where                                                               |
| --------------------- | ------------------------------------------------------------------- |
| License metadata      | `pipeline/config/resources/{gtfs,odpt-json}/*.ts` — `license` field |
| Credit display        | `ABOUT.md` — "ライセンス / クレジット" section                      |
| License verification  | CKAN catalog: `https://ckan.odpt.org/dataset/`                      |
| ODPT rules/guidelines | `https://developer.odpt.org/terms`                                  |

## Checklist: Adding a New Data Source

1. Find the dataset on CKAN (`https://ckan.odpt.org/dataset/`) or the provider's catalog
2. Identify the license type and provider name from the catalog page
3. Set `license.name` and `license.url` in the resource definition (use the license full text URL, not a landing page)
4. Add a credit section to ABOUT.md following the format for that license type
5. Verify the credit text meets all requirements of the specific license
