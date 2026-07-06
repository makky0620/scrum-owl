# `/rotate template stats` — 当番の公平性表示

日付: 2026-07-07
ステータス: 設計承認済み
親ドキュメント: 2026-07-06-engagement-roadmap-design.md(機能 2-4、Phase 1)

## 目的

テンプレートが既に永続化している `selectionCounts` と `bag` を表示し、
当番選出の公平性をチームが確認できるようにする。追加のデータ収集は不要。
既存データを見せるだけのクイックウィン。

## コマンド定義

`/rotate template stats name:<テンプレート名>`

- 既存の `template` サブコマンドグループに `stats` サブコマンドを追加
- `name` オプション: required + autocomplete(既存 `use` / `delete` と同じ)
- テンプレート未存在時は既存と同文言の not found メッセージを返す
  (既存ハンドラ同様 `safeReply` 経由の ephemeral)
- 成功時の stats embed は公開返信(既存コマンドの結果表示と同様)
- DM 実行は既存の guild ガードで拒否

## ヘルパー(純関数)

`src/utils/rotateHelpers.ts` に追加する:

```ts
export interface TemplateStatsEntry {
  name: string; // 参加者名
  count: number; // selectionCounts[name] ?? 0
  inBag: boolean; // 今の巡でまだ選ばれ得るか
}

export function buildTemplateStats(
  participants: string[],
  selectionCounts: { [name: string]: number },
  bag: string[],
): TemplateStatsEntry[];
```

仕様:

- 全 `participants` を対象とする。`selectionCounts` に無い参加者は `count: 0`
- `inBag` の判定:
  - `bag` が空(テンプレート保存後まだ一度も抽選していない)→ **全員 `true`**。
    新しい巡では全員が候補なので意味的に正しい
  - `bag` が非空 → `bag` に含まれる名前のみ `true`
- ソート: `count` 降順。同数は `participants` の並び順を維持(安定ソート)
- `bag` 内に `participants` に存在しない名前があっても無視する
  (`upsertTemplate` が reconcile 済みだが防御的に扱う)

## データフロー

```
handler → getTemplateByName → buildTemplateStats → embed 整形 → reply
```

rotate.ts のハンドラ(`handleTemplateStats`)は取得・整形・返信のみを担当し、
計算ロジックは純関数に置く。既存パターン(`drawFromBag` + 薄いハンドラ)と同型。

## 出力形式(embed)

既存出力にあわせ英語・事務的トーン(フクロウ人格の導入は 1-3 の範囲であり
本機能では行わない)。

```
Title: Template Stats: <name>
Description(選出回数、count 降順):
  Alice: 5
  Bob: 3
  Carol: 0
Field "Remaining in current cycle":
  Bob, Carol   ← inBag=true の名前をカンマ区切りで列挙
Footer: 参加者数(例: "3 participants")
```

- 回数リストは description に格納する。description の上限は 4096 字で、
  参加者上限 50 人 × 短い行でも余裕がある(field の 1024 字では 50 人で
  溢れる可能性があるため使わない)
- `bag` が空(未抽選)の場合、Remaining には全員を列挙する

## エッジケース

| ケース                           | 挙動                      |
| -------------------------------- | ------------------------- |
| テンプレート未存在               | 既存の not found 文言     |
| `selectionCounts` に無い参加者   | 0 回として表示            |
| `bag` に `participants` 外の名前 | 無視(防御)                |
| DM 実行                          | 既存の guild ガードで拒否 |

## テスト計画(TDD)

`src/__tests__/` の既存パターンに従う。

`buildTemplateStats` の純関数テスト:

1. `selectionCounts` に無い参加者 → `count: 0`
2. `count` 降順ソート、同数は `participants` 順を維持
3. `bag` が空 → 全員 `inBag: true`
4. `bag` が非空 → `bag` 内の名前のみ `inBag: true`
5. `bag` 内の無効名(participants 外)→ 結果に影響しない

`rotate` コマンドのハンドラテスト(既存の discord.js モックパターン):

6. stats 実行 → embed に選出回数と Remaining が表示される
7. 未存在テンプレート指定 → not found 返信

## 実装アプローチの決定記録

- 採用: 純関数を `rotateHelpers.ts` に追加(テスタブル、既存パターン踏襲)
- 見送り: ハンドラ直書き(テストが interaction モック依存で重い)、
  新規 util ファイル(規模に対し過剰)
