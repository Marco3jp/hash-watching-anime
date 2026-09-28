# アニメ実況メモ — 要件とデータ構造

話を見ながら書くメモについて、要件と TypeScript の型をレビューするためのページ。実況を書くアプリ本体は、この型の確認が済んでから作る。

参考にした [sparkling-journey](https://github.com/Marco3jp/sparkling-journey) は、作品とタグをブラウザに置く台帳。このメモとはページの単位が違うので、同じリポジトリにはまとめていない。

## 起動

```bash
npm install
npm run dev
```

開発サーバーは http://127.0.0.1:43123 で開く。

## 中身

- `src/model/types.ts` — 保存する型
- `src/model/views.ts` — サイドパネルを組む関数
- `src/model/example.ts` — 『中二病でも恋がしたい！』周辺の見本
- 画面は、見本データに `views.ts` を適用した結果を描いている

## 確認

```bash
npm run test
npm run lint
npm run build
```
