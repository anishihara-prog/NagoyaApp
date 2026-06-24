#!/usr/bin/env node
// URLリンク切れ＋ページ内容変更チェック
// 使い方:
//   node scripts/check-links.js           → リンク切れ(404)チェック
//   node scripts/check-links.js --content → ページ内容変更チェック

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const SRC_DIR = path.join(__dirname, '../src');
const SNAPSHOT_FILE = path.join(__dirname, '../.github/url-snapshots.json');

const SKIP_PATTERNS = [
  /api\.anthropic\.com/,
  /apps\.apple\.com/,
  /play\.google\.com/,
];

// ファイルからURLを抽出
function extractUrls(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...extractUrls(fullPath));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = content.matchAll(/['"`](https?:\/\/[^'"`\s\$\{\\]+)['"`]/g);
      for (const m of matches) {
        const url = m[1];
        if (!SKIP_PATTERNS.some(p => p.test(url))) {
          results.push({ url, file: path.relative(SRC_DIR, fullPath) });
        }
      }
    }
  }
  return results;
}

// HEADリクエストでステータス確認
function checkUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, {
      method: 'HEAD', timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (NagoyaApp link checker)' },
    }, (res) => {
      resolve({ status: res.statusCode });
    });
    req.on('error', (e) => resolve({ status: 'ERROR', error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT' }); });
    req.end();
  });
}

// GETリクエストでHTMLを取得
function fetchHtml(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    let body = '';
    const req = client.get(url, {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0 (NagoyaApp link checker)' },
    }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (d) => {
        body += d;
        if (body.length > 300000) req.destroy();
      });
      res.on('end', () => resolve({ ok: true, html: body }));
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
  });
}

// HTML からタイトル・見出しを抽出してハッシュ化
function extractAndHash(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  const headings = [];
  for (const m of html.matchAll(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/gi)) {
    const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text && text.length < 200) headings.push(text);
  }

  const content = title + '\n' + headings.slice(0, 10).join('\n');
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return { title, hash };
}

// ─── リンク切れチェック ───────────────────────────────
async function checkBrokenLinks(urlMap) {
  console.log(`\n🔍 ${urlMap.size}件のURLをチェックします...\n`);
  const broken = [];
  const ok = [];

  for (const [url, files] of urlMap) {
    process.stdout.write(`  チェック中: ${url.slice(0, 70)}...`);
    const { status } = await checkUrl(url);
    if (status === 200 || status === 301 || status === 302) {
      process.stdout.write(` ✅ ${status}\n`);
      ok.push({ url, status, files });
    } else {
      process.stdout.write(` ❌ ${status}\n`);
      broken.push({ url, status, files });
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`✅ 正常: ${ok.length}件  ❌ 問題あり: ${broken.length}件`);

  if (broken.length > 0) {
    console.log('\n❌ リンク切れ一覧:\n');
    for (const { url, status, files } of broken) {
      console.log(`  [${status}] ${url}`);
      for (const f of [...new Set(files)]) console.log(`       → src/${f}`);
      console.log('');
    }
    return true;
  }
  console.log('\n全てのリンクが正常です！');
  return false;
}

// ─── ページ内容変更チェック ──────────────────────────
async function checkContentChanges(urlMap) {
  // 既存スナップショット読み込み
  let snapshots = {};
  if (fs.existsSync(SNAPSHOT_FILE)) {
    snapshots = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
  }
  const isFirstRun = Object.keys(snapshots).length === 0;

  console.log(`\n📸 ${urlMap.size}件のページ内容をチェックします...\n`);

  const changed = [];
  const newSnapshots = {};
  const now = new Date().toISOString();

  for (const [url, files] of urlMap) {
    process.stdout.write(`  取得中: ${url.slice(0, 65)}...`);
    const result = await fetchHtml(url);

    if (!result.ok) {
      process.stdout.write(` ⚠️ 取得失敗\n`);
      if (snapshots[url]) newSnapshots[url] = snapshots[url];
      continue;
    }

    const { title, hash } = extractAndHash(result.html);
    newSnapshots[url] = { hash, title, lastChecked: now };

    if (!snapshots[url]) {
      process.stdout.write(` 🆕 初回登録\n`);
    } else if (snapshots[url].hash !== hash) {
      process.stdout.write(` 🔄 変更あり！\n`);
      changed.push({ url, files, oldTitle: snapshots[url].title, newTitle: title });
    } else {
      process.stdout.write(` ✅ 変更なし\n`);
    }
  }

  // スナップショット更新保存
  fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(newSnapshots, null, 2), 'utf8');

  console.log('\n' + '─'.repeat(60));

  if (isFirstRun) {
    console.log(`📸 初回スナップショット登録完了: ${Object.keys(newSnapshots).length}件`);
    console.log('次回実行から変更検知が有効になります。');
    return { changed: [], isFirstRun: true };
  }

  console.log(`🔄 変更あり: ${changed.length}件 / 全${urlMap.size}件`);

  if (changed.length > 0) {
    console.log('\n🔄 変更されたページ一覧:\n');
    for (const { url, files, oldTitle, newTitle } of changed) {
      console.log(`  ${url}`);
      if (oldTitle !== newTitle) {
        console.log(`    旧タイトル: ${oldTitle}`);
        console.log(`    新タイトル: ${newTitle}`);
      }
      for (const f of [...new Set(files)]) console.log(`    → src/${f}`);
      console.log('');
    }
  }

  return { changed, isFirstRun: false };
}

// ─── エントリーポイント ───────────────────────────────
async function run() {
  const mode = process.argv.includes('--content') ? 'content' : 'links';

  const entries = extractUrls(SRC_DIR);
  const urlMap = new Map();
  for (const { url, file } of entries) {
    if (!urlMap.has(url)) urlMap.set(url, []);
    urlMap.get(url).push(file);
  }

  if (mode === 'content') {
    const { changed, isFirstRun } = await checkContentChanges(urlMap);
    if (!isFirstRun && changed.length > 0) process.exit(2);
  } else {
    const hasBroken = await checkBrokenLinks(urlMap);
    if (hasBroken) process.exit(1);
  }
}

run().catch(err => { console.error(err); process.exit(1); });
