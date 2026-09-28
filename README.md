# アニメ実況メモ — 要件とデータ構造

話を見ながら書くメモについて、1st の範囲に絞った要件と TypeScript の型をレビューするためのページ。1st は話、シリーズ、キャラクターのサイドパネルまで。実況を書くアプリ本体は、この型の確認が済んでから作る。

参考にした [sparkling-journey](https://github.com/Marco3jp/sparkling-journey) は、作品とタグをブラウザに置く台帳。このメモとはページの単位が違うので、同じリポジトリにはまとめていない。

## 起動

```bash
npm install
npm run dev
```

開発サーバーは http://127.0.0.1:43123 で開く。

## 中身

- `src/model/types.ts` — 保存する型
- `src/model/records.ts` — ページを作って、返った id を紐づける
- `src/model/views.ts` — 保存してある配列からサイドパネルを組む関数
- `src/model/example.ts` — 『中二病でも恋がしたい！』周辺の見本
- 画面は、見本データに `views.ts` を適用した結果を描いている

方針と作業の記録は `開発ノート.md`。

## 確認

```bash
npm run test
npm run lint
npm run build
npm run screenshot
```

`npm run screenshot` は port 43124 でページを開き、`screenshots/` を更新する。
