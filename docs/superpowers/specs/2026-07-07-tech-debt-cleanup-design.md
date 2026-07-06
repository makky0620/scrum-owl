# 技術的負債の解消(2026-07 棚卸し)

日付: 2026-07-07
ステータス: 設計承認済み

## 背景

feature 開発を重ねる中で SDD ledger と final review に負債が蓄積した。
本書は棚卸しの結果採用した 3 つの独立したワークストリームの合意文書。
各ワークストリームは個別のブランチ・PR で順番に出す(PR1 → PR2 → PR3)。
実装着手時にそれぞれ実装計画(writing-plans)を作成する。

今回のスコープ外(記録のみ): major 更新群(jest 30 / eslint 10 /
TypeScript 6 / dotenv 17 / @types/node 26)、stats embed の
`Remaining in current cycle` field 1024 字超過対策。

## PR1: 依存更新(branch: `chore/dependency-updates`)

棚卸し時点で `npm audit` が 17 件(high 8)を報告。wanted 範囲の更新で
大半が解消される見込み。

- `npm update` で wanted 範囲へ更新する。主なもの:
  discord.js 14.21.0 → 14.26.4、axios 1.11.0 → 1.18.1、
  prettier 3.6.2 → 3.9.4、typescript 5.8.3 → 5.9.3、
  typescript-eslint 8.35.1 → 8.63.0、ほか minor 群
- major 更新は含めない
- 更新後に `npm audit` を再確認。残る脆弱性は major 更新が必要なもの
  として本書または PR 本文に記録し、今回は対応しない
- 検証: `npm test` / `npm run build` / `npm run lint`
- 注意: prettier 3.9 で整形結果が変わり得るため、repo-wide 整形(PR3)は
  本 PR の merge 後に行う
- 注意: discord.js が minor 5 つ進むため、merge 後に bot 起動スモーク
  テストを推奨(未実施の `npm run deploy`(stats サブコマンド登録)と
  同時に行うと 1 回で済む)

## PR2: rotate テンプレートの競合対策(branch: `fix/rotate-template-race`)

### 問題

1. **stale-template clobber**: `handleTemplateUse` はテンプレートを読んで
   からルーレット(最大 5 分の collector)完了後に書き戻す。その間に
   `add-member` 等が同じテンプレートを更新すると、古い `participants` で
   上書きされ更新が消える。`add-member` / `remove-member` 自身も
   get → 検証 → upsert の間にレース窓がある(mutex は save 単位のみ)
2. **double-click**: ルーレットの Start ボタン連打で collector の
   collect が複数回発火し、スピン処理が多重実行され得る

### 対策1: 原子更新 API

`FacilitatorTemplateStorage` に追加する:

```ts
async updateTemplate(
  guildId: string,
  name: string,
  updateFn: (template: FacilitatorTemplate) => FacilitatorTemplate,
): Promise<FacilitatorTemplate>
```

動作(すべて mutex 内):

1. 最新のテンプレート一覧を load
2. 対象を find。無ければ `Template "<name>" not found in this server` を
   throw(既存 `deleteTemplate` と同文言)
3. `updateFn` を適用。`updateFn` が throw した場合は保存せず伝播する
4. 既存の reconcile 処理(`selectionCounts` / `bag` から `participants`
   外の名前を除去)を適用
5. save し、更新後のテンプレートを返す

### 対策2: ハンドラ移行

| ハンドラ                       | 変更                                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `use`                          | ルーレット後の書き戻しを `updateTemplate` へ。コールバックで最新テンプレートに「selected の counts +1、bag = draw 結果、updatedAt 更新」を適用。bag 内のゴーストは reconcile が除去 |
| `add-member` / `remove-member` | get → 検証 → upsert を `updateTemplate` へ。検証(既存重複・50 上限・最低 1 人)はコールバック内で throw し、ハンドラが catch して既存文言で返信                                      |
| `save`                         | create 兼 replace のため `upsertTemplate` のまま                                                                                                                                    |
| `delete`                       | 既に mutex 内。変更なし                                                                                                                                                             |

### 対策3: double-click guard

`runRoulette` の collector に `selectionStarted` フラグを追加。
start_selection 処理開始済みなら後続クリックは `i.deferUpdate()` で無視。

### テスト

1. `updateTemplate`: not found で throw / updateFn の変更が保存される /
   updateFn throw 時は未保存
2. `updateTemplate` を並行 2 本実行 → 両方の変更が反映される
   (mutex 直列化。temp ファイル + 実 fs I/O の既存パターン)
3. `use` ハンドラ: ルーレット中のテンプレート更新をシミュレート
   (`getTemplateByName` は古い値、`updateTemplate` は新しい値を返す
   mock)→ 書き戻しが最新 participants を保持する
4. double-click: start_selection 2 連打 → スピン処理は 1 回のみ

## PR3: repo-wide 整形 + テスト衛生(branch: `chore/format-and-test-hygiene`)

PR1 merge 後に着手(prettier 3.9 で整形するため)。

### repo-wide prettier

- `npm run format` を全体に適用し、`npm run format:check` を完全クリーンへ
  (棚卸し時点で 17 ファイルが未整形)
- 整形のみの commit を実質変更と分離する

### テスト衛生(rotate.test.ts)

1. **コピペテスト解消**: parseParticipants のロジックをテスト内へ複製した
   5 テストは実関数を検証していない。`parseParticipants` を
   `rotateHelpers.ts` へ移動して export し、`rotate.ts` は import に変更。
   テストは実関数を直接検証する形に書き換える
2. **introspection ヘルパー重複解消**: `getAddMemberSubcommand` /
   `getRemoveMemberSubcommand` / `getStatsSubcommand` の 3 重複を
   共通 `getTemplateSubcommand(name)` に統合
3. **ephemeral flag の固定**: not-found 系テストの
   `objectContaining({ content })` に `flags: MessageFlags.Ephemeral` を
   追加し、「エラー返信は ephemeral」の裁定を回帰防止する
4. **単数 footer テスト**: stats で participants が 1 人のとき
   footer が `1 participant` になることを検証

### 検証

`npm test` / `npm run lint` / `npm run format:check` すべてクリーン。

## 順序と依存

```
PR1 (deps)  →  PR3 (整形: prettier 3.9 依存)
PR2 (競合対策) … PR1/PR3 と独立だが、rotate.test.ts の衝突回避のため
                PR2 → PR3 の順で出す
```

実施順: PR1 → PR2 → PR3。各 PR は独立してリリース可能。
