---
marp: true
theme: gaia
paginate: true
---

<style>
/* Athenai concept deck -- monochrome refinement (theme / class / font-size unchanged) */

section {
  padding: 70px 80px;
  color: #2b2b2b;
  justify-content: flex-start;
}

/* heading hierarchy via grayscale, not accent color */
h1 {
  color: #1a1a1a;
  border-bottom: 3px solid #d4d4d2;
  padding-bottom: 0.25em;
}
h2,
h3 {
  color: #555;
}

/* emphasis carried by weight / ink, no accent color */
strong {
  color: #111;
  font-weight: 700;
}

/* list rhythm */
ul {
  line-height: 1.55;
}
li {
  margin-bottom: 0.35em;
}
li::marker {
  color: #9a9a9a;
}

/* key-phrase callout: styles any blockquote */
blockquote {
  border-left: 5px solid #c4c4c2;
  padding-left: 0.9em;
  color: #333;
  font-style: normal;
}

/* one-pager code block */
pre {
  background: #f5f5f3;
  border: 1px solid #e3e3e1;
  border-radius: 10px;
}

/* subtle pagination */
section::after {
  color: #b3b3b3;
}

/* lead (title / summary) slides */
section.lead {
  justify-content: center;
}
section.lead h1 {
  border-bottom: none;
}
</style>

<!-- markdownlint-disable MD025 -->
<!-- markdownlint-disable MD036 -->

<!-- _class: lead -->

# Athenai Transit

あてのない乗換案内

---

# 1. 前提 - 目的地を入力しない

Athenai Transit は **目的地検索機能を持たない** 乗換案内

- 一般的な乗換案内: 「A から B への最短経路」を提示
- Athenai: 目的地 (B) を問わない

**「移動効率」や「経路の不安解消」は気にしない**

---

# 2. UIの再定義 - 「目的地検索」は可能性を狭める

- 目的地検索とは、行き先を **決めてから** 使う道具
- 目的地を検索した時点で、無数の選択肢は一つに絞り込まれる
- **「検索」は可能性を「狭める」行為**

あてのない旅には、そもそも向かない

---

# 2. UIの再定義 - 「選択」は可能性を広げる

- 多くの選択肢が一度に「提示」されれば、可能性は「広がる」
- **現実の移動体験は** 行き先と時刻表を見て「どれに乗るか」を決める **「選択」の連続**

あてのない旅の面白さは、時刻表や案内板を見て「選択」を楽しむこと。その先にある未知の風景や街歩きの楽しさ。

---

# 2. UIの再定義 - 「見て、選ぶ」

今、ここからどこへ行けるか が見えていれば...

- いつも見かけるのに乗ったことのないバス
- 名前しか知らない行き先

**未知の選択肢に、ふと手が伸びる**

Athenai Transit は、この「見て、選ぶ」という自然な振る舞いに UI を最適化した

---

# 3. コアバリュー - 「今、ここからどこへ行けるか」の可視化

**最大の価値**

- 様々な公共交通データを、ひとつの使いやすい UI に **統合**し
- 「今、ここからどこへ行けるか」を **可視化**すること

多様なデータを現在地周辺で整理し直し、目の前に提示することで、
**俯瞰と出会いのサイクル**を生み出す

---

# 3.1 「点」の探索から「面」の俯瞰へ

### 実質的価値

- 一般的な検索: のりばを一つずつ開いて行き先と発車時間を確認する **「点」の探索 (タップ地獄)**
- Athenai: 多数のデータを統合的に案内し、周辺ののりばと発着便を **面で俯瞰**

<br>

**「どこにのりばがあって」「いつ・どこへ行くのか」を一望**

---

# 3.2 未体験を「選ぶ」小さな冒険

### 情緒的価値

**一望できるからこそ生まれる、「あのバスに乗ってみよう」という衝動**

- 乗ったことのない路線・行ったことのない街を、自分の意思で「選ぶ」
- 決めきれなくても、まず一歩を踏み出せばいい

その先に待つのは - **発見・出会い・街歩き・小さな冒険**
あてのない移動の不安を、未知と出会う楽しさへと転じる

---

# 4. 衝動を支える常時性と安心

- 未知へ踏み出す冒険は、**いつでも近くに乗り物を見つけられる安心**があってこそ楽しめる
- Athenai はその安心を、仕組みの **「常時性」** で支える
    - 現在地を起点に、思い立ったその場で確かめられる
    - 「いつでも見られる」安心が、見知らぬ便に飛び乗る勇気を裏から支える

**安心は前面の価値ではなく、選択と出会いを成立させる土台**

---

# 5. コア機能 - 2 つの軸

**のりばを見つける (どこから)**

- 場所・方向・距離を空間的に把握
- 機能例: **エッジマーカー**

**発着を俯瞰する (いつ、どこへ)**

- 運行情報を、点でなく面で見渡す
- 機能例: **仮想統合発着案内**

---

# 6. 基盤機能とデータ特性

**基盤機能**

- 時刻表 / 行程 / 日時セレクター / 複数地図(タイル) / 情報レベル ...
- 多言語対応 / お気に入り / PWA / 多言語 ...

**データ特性 (Athenai Insights)**

- 元データから独自算出する統計・地理指標
  (運行統計、交通空白の度合い、近隣圏の乗り継ぎ利便性 ...)
- **あてのない旅をより楽しむ各種指標**

---

# 7. できないこと (Non-goals)

**経路検索なし**

- 目的地を指定した探索は行わない (制約ではなくコンセプト)

**リアルタイム遅延情報の非対応**

- 遅延情報は「急がなきゃ」「効率的に」という **最適化の思考を誘発**する
- あてのない偶然の出会いを主眼とするため、あえて **静的なダイヤ (本来の可能性の提示)** のみに特化
