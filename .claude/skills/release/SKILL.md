---
name: release
description: >
    Bump version, update CHANGELOG, commit, tag, push, and create a GitHub Release.
    Use when the user asks to "release", "bump version", "cut a release",
    "create a release", or wants to publish a new version.
---

# Release

Create a CalVer release with changelog, tag, and GitHub Release.

## Version Format

CalVer: `YYYY.MM.DD` (e.g. `2026.03.12`). The user provides the version.

When multiple releases occur on the same day, append a sequential suffix:
`YYYY.MM.DD.1`, `YYYY.MM.DD.2`, etc. The first release of the day omits the suffix.

## Steps

1. **Update `package.json`** — set `"version"` to the new CalVer version
2. **Run `npm install`** — to update `package-lock.json`
3. **Update `CHANGELOG.md`**
    - Move contents under `[Unreleased]` into a new `[version]` section
    - If `[Unreleased]` is empty, draft changelog from `git log` since the last tag
    - Keep `[Unreleased]` header (empty) above the new version section
    - Follow [Keep a Changelog](https://keepachangelog.com/) format: `### Added`, `### Fixed`, `### Changed`, `### Removed`
4. **Run all checks** — `npm run typecheck && npm run format && npm run lint:fix && npm run test && npm run build`
5. **Commit** — `chore(release): {version}`
6. **Tag** — `v{version}` (e.g. `v2026.03.12`)
7. **Push** — `git push && git push --tags` (confirm with user before pushing to main)
8. **Create GitHub Release** — `gh release create v{version} --title "{version}"` with release notes
    - Title: `{version}` (v prefix なし、例: `2026.03.17`)
    - Tag: `v{version}` (v prefix あり、例: `v2026.03.17`)

## GitHub Release Notes

Release notes are a **concise summary of the major user-facing changes — NOT a copy of the
CHANGELOG.** The CHANGELOG is the exhaustive, detailed record; the release note is the
highlight reel.

- **First, read the last 1-2 releases** (`gh release view <prev_tag> --json body --jq '.body'`)
  and match their length and tone. Recent releases run ~15-25 lines / ~1-2KB. If your draft is
  several KB, you are pasting the CHANGELOG — cut it down.
- **Summarize, don't transcribe.** One short line per notable change. Drop implementation
  detail, file/symbol names, and PR refs (`(#296)`) — those live in the CHANGELOG.
- **Lead with what users see.** Focus on UI / UX / behavior changes. Minor bug fixes,
  internal refactors, and renames may be omitted entirely when they don't affect users.
- **Structure**: WebApp (user-facing) と Pipeline/CI (developer-facing) に分けて記載する
    - `## WebApp` — エンドユーザーに影響する変更 (UI, UX, 表示)
    - `## Pipeline / CI` — パイプライン、CI/CD、開発ツール等の変更
    - 各セクション内は `### Added`, `### Fixed`, `### Changed` で分類。該当が無いセクション
      (例: Pipeline/CI 変更なし) は丸ごと省く
- Include link to full diff: `**Full Changelog**: https://github.com/{owner}/{repo}/compare/{prev_tag}...v{version}`
- If this is the first release (no previous tag), use the initial commit as base

## Pre-flight Checks

Before starting, verify:

- Working tree is clean (`git status`)
- On the correct branch (usually `main`)
- No version references to old version in source files (search for the old version string)
- `__APP_VERSION__` in `vite.config.ts` reads from `npm_package_version` (auto-updated)
