# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [CalVer](https://calver.org/).

## [Unreleased]

### Fixed

- 当日の全便が終了した stop の [時刻表] が表示されない不具合を修正。
  `handleShowStopTimetable` が upcoming departures (時間フィルタ済み) に依存して
  route/headsign の一覧を取得していたため、全便終了後は一覧が空となり時刻表データが
  取得されなかった。新メソッド `getFullDayDeparturesForStop` を追加し、
  route/headsign を指定せずに全日の時刻表を一括取得するよう変更。
