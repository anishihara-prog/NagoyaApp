@AGENTS.md

# ブラウザでの確認方法（Expo web）

このコンテナには `chromium-cli` がないため、`playwright-core` を直接使う。

```bash
npx expo start --web --port 8081 --clear &
```

- **必ず `--clear` を付ける。** Metro のバンドルキャッシュが新しい編集を拾わず、古い内容を返し続けることが頻発する。`--clear` なしで再起動しても直らないことがある。
- 起動待ちは `curl -sf http://localhost:8081` をポーリング。`--clear` 時はキャッシュ再構築で数十秒〜90秒かかる。
- 反映を確実に確認したい場合は、配信中のバンドルを直接 curl して該当文字列の有無を grep する：
  `curl -s "http://localhost:8081/node_modules/expo/AppEntry.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable"`

# git 運用上の注意

- `.git/hooks/post-commit` が `git push origin master` を自動実行する。リモートが先行しているとpushが失敗するので、失敗した場合は `git pull --rebase origin master` してから再度 `git push origin master`。
- 作業ディレクトリに、このタスクと無関係な未コミット変更（他画面の編集など）が残っていることが多い。コミットは対象ファイル・対象ハンクのみを `git add <file>` や `git apply --cached` で選択的にステージすること。
