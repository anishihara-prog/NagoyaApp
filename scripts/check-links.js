#!/usr/bin/env node
// URLリンク切れチェックスクリプト
// 使い方: node scripts/check-links.js

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const SRC_DIR = path.join(__dirname, '../src');

// チェック対象外のURL（APIエンドポイント・アプリストア等はHEAD非対応）
const SKIP_PATTERNS = [
  /api\.anthropic\.com/,
  /apps\.apple\.com/,
  /play\.google\.com/,
];

// ファイルからURLを抽出（変数名も取得できる場合は含める）
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

// HTTP HEADリクエストでステータス確認
function checkUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const options = {
      method: 'HEAD',
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (NagoyaApp link checker)' },
    };
    const req = client.request(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve({ status: res.statusCode, redirect: res.headers.location });
      } else {
        resolve({ status: res.statusCode });
      }
    });
    req.on('error', (e) => resolve({ status: 'ERROR', error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT' }); });
    req.end();
  });
}

async function main() {
  const entries = extractUrls(SRC_DIR);

  // 重複排除
  const urlMap = new Map();
  for (const { url, file } of entries) {
    if (!urlMap.has(url)) urlMap.set(url, []);
    urlMap.get(url).push(file);
  }

  console.log(`\n🔍 ${urlMap.size}件のURLをチェックします...\n`);

  const broken = [];
  const ok = [];

  for (const [url, files] of urlMap) {
    process.stdout.write(`  チェック中: ${url.slice(0, 70)}...`);
    const result = await checkUrl(url);
    const status = result.status;

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
  console.log(`（App Store・Google Play・APIエンドポイントは除外済み）`);

  if (broken.length > 0) {
    console.log('\n❌ リンク切れ一覧:\n');
    for (const { url, status, files } of broken) {
      const uniqueFiles = [...new Set(files)];
      console.log(`  [${status}] ${url}`);
      for (const f of uniqueFiles) console.log(`       → src/${f}`);
      console.log('');
    }
  } else {
    console.log('\n全てのリンクが正常です！');
  }
}

main().catch(console.error);
