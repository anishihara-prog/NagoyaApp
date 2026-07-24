#!/usr/bin/env node
// scripts/check-links.js --json-out で出力したJSON結果をまとめてExcel(.xlsx)にする
// 使い方:
//   node scripts/check-links.js --content    --json-out content-result.json
//   node scripts/check-links.js --categories --json-out categories-result.json
//   node scripts/check-links.js              --json-out links-result.json
//   node scripts/export-excel.js [出力ファイル名]

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const OUT_FILE = process.argv[2] || `hp-check-report-${new Date().toISOString().slice(0, 10)}.xlsx`;

// アプリ側 = src/ 内で実際に使っているURLに対するチェック（リンク切れ・内容変更）
// 名古屋市HP側 = トップページ主要タブ配下全体の増減チェック（アプリで使っているかは問わない）
const SOURCES = [
  { file: 'links-result.json', sheet: 'アプリ：リンク切れ' },
  { file: 'content-result.json', sheet: 'アプリ：内容変更' },
  { file: 'categories-result.json', sheet: '名古屋市HP：カテゴリ変更' },
];

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function linksRows(data) {
  if (!data) return [];
  const rows = [];
  for (const { url, status, files } of data.broken || []) {
    rows.push({ 判定: '❌ リンク切れ', URL: url, ステータス: status, 参照ファイル: [...new Set(files)].join(', ') });
  }
  for (const { url, status, files } of data.ok || []) {
    rows.push({ 判定: '✅ 正常', URL: url, ステータス: status, 参照ファイル: [...new Set(files)].join(', ') });
  }
  return rows;
}

function contentRows(data) {
  if (!data) return [];
  if (data.isFirstRun) return [{ 状態: '初回登録（比較対象なし）' }];
  return (data.changed || []).map(({ url, files, oldTitle, newTitle }) => ({
    URL: url,
    旧タイトル: oldTitle,
    新タイトル: newTitle,
    参照ファイル: [...new Set(files)].join(', '),
  }));
}

function categoryRows(data) {
  if (!data) return [];
  if (data.isFirstRun) return [{ 状態: '初回登録（比較対象なし）' }];
  const rows = [];
  for (const { label, url, added, removed, changed } of data.results || []) {
    for (const { href, text } of added || []) {
      rows.push({ タブ: label, タブURL: url, 種別: '➕ 追加', 対象URL: href, 内容: text });
    }
    for (const { href, text } of removed || []) {
      rows.push({ タブ: label, タブURL: url, 種別: '➖ 削除', 対象URL: href, 内容: text });
    }
    for (const { href, oldText, newText } of changed || []) {
      rows.push({ タブ: label, タブURL: url, 種別: '🔁 変更', 対象URL: href, 内容: `${oldText} → ${newText}` });
    }
  }
  return rows;
}

function buildRows(fileName, data) {
  if (fileName === 'links-result.json') return linksRows(data);
  if (fileName === 'content-result.json') return contentRows(data);
  return categoryRows(data);
}

// ─── 履歴ログ（検知された問題だけを検知日付きで積み上げる） ──
const HISTORY_SHEET = '履歴ログ';

// 「問題なし」「初回登録」のプレースホルダー行は履歴に残さない
function isPlaceholderRow(row) {
  return Object.keys(row).length === 1 && ('状態' in row);
}

function toHistoryRows(today, checkType, rows, mapRow) {
  return rows.filter(r => !isPlaceholderRow(r)).map(r => ({
    検知日: today,
    チェック種別: checkType,
    ...mapRow(r),
  }));
}

function buildThisRunHistory(today, linksData, contentData, categoriesData) {
  const rows = [];

  // リンク切れは「壊れているもの」だけを履歴化（正常なものは積み上げない）
  const broken = (linksData?.broken || []).map(({ url, status, files }) => ({
    URL: url, ステータス: status, 参照ファイル: [...new Set(files)].join(', '),
  }));
  rows.push(...toHistoryRows(today, 'リンク切れ', broken, r => r));

  rows.push(...toHistoryRows(today, '内容変更', contentRows(contentData), r => r));
  rows.push(...toHistoryRows(today, 'カテゴリ変更', categoryRows(categoriesData), r => r));

  return rows;
}

// 既存の latest-report.xlsx があれば「履歴ログ」シートの既存行を読み込む
function readExistingHistory(outFile) {
  if (!fs.existsSync(outFile)) return [];
  try {
    const wb = XLSX.readFile(outFile);
    const ws = wb.Sheets[HISTORY_SHEET];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws);
  } catch {
    return [];
  }
}

function run() {
  const today = new Date().toISOString().slice(0, 10);
  const existingHistory = readExistingHistory(OUT_FILE);

  const linksData = readJson('links-result.json');
  const contentData = readJson('content-result.json');
  const categoriesData = readJson('categories-result.json');

  const wb = XLSX.utils.book_new();
  let anySheet = false;

  for (const { file, sheet } of SOURCES) {
    const data = readJson(file);
    const rows = buildRows(file, data);
    if (!data) continue;
    anySheet = true;
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 状態: '検知なし' }]);
    XLSX.utils.book_append_sheet(wb, ws, sheet);
  }

  if (!anySheet) {
    console.log('入力となるJSON結果ファイル（links-result.json / content-result.json / categories-result.json）が見つかりませんでした。');
    console.log('先に node scripts/check-links.js ... --json-out <file> を実行してください。');
    process.exit(1);
  }

  const newHistoryRows = buildThisRunHistory(today, linksData, contentData, categoriesData);
  const history = [...existingHistory, ...newHistoryRows];
  const historyWs = XLSX.utils.json_to_sheet(history.length ? history : [{ 状態: 'これまでに検知された問題はありません' }]);
  XLSX.utils.book_append_sheet(wb, historyWs, HISTORY_SHEET);

  fs.mkdirSync(path.dirname(OUT_FILE) || '.', { recursive: true });
  XLSX.writeFile(wb, OUT_FILE);
  console.log(`✅ Excelレポートを出力しました: ${OUT_FILE}（履歴ログ: 累計${history.length}件、今回${newHistoryRows.length}件追加）`);
}

run();
