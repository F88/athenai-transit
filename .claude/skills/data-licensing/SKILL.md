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

**Applies to**: Toei Bus GTFS, Toei Train GTFS (via ODPT/CKAN)

**Credit display** (ABOUT.md): Follow the ODPT FAQ format at `https://developer.odpt.org/en/faq-info#cc-by-credit`.

- Unmodified data: `[Provider name], [Content name], Creative Commons License Attribution 4.0 International (URL)`
- Modified data (our case, GTFS -> JSON): `This [app] uses the following copyrighted material with modifications. [Provider name], [Content name], Creative Commons License Attribution 4.0 International (URL)`

**Provider name**: Found on each dataset's CKAN page (e.g. `https://ckan.odpt.org/dataset/b_bus_gtfs_jp-toei`). Look for "Provider name of content" field.

**Resource definition**: `license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }`

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

| What                  | Where                                                        |
| --------------------- | ------------------------------------------------------------ |
| License metadata      | `pipeline/config/resources/{gtfs,odpt-json}/*.ts` — `license` field |
| Credit display        | `ABOUT.md` — "ライセンス / クレジット" section               |
| License verification  | CKAN catalog: `https://ckan.odpt.org/dataset/`               |
| ODPT rules/guidelines | `https://developer.odpt.org/terms`                           |

## Checklist: Adding a New Data Source

1. Find the dataset on CKAN (`https://ckan.odpt.org/dataset/`) or the provider's catalog
2. Identify the license type and provider name from the catalog page
3. Set `license.name` and `license.url` in the resource definition (use the license full text URL, not a landing page)
4. Add a credit section to ABOUT.md following the format for that license type
5. Verify the credit text meets all requirements of the specific license
