#!/usr/bin/env node
// 「検索画面のボタンを1つ1つクリックしたら何が出るか」を年齢×ボタンのマトリクスにした
// 人手レビュー用Excelを生成する。
//
// 評価方針：test-matching.mjs のBASELINE固定スイープとは異なり、その1項目だけを
// セットした空プロフィールを評価する（buildProfile()は通すのでdoSearch()の自動
// concerns/sit導出は再現される）。「このボタンを押すと何が出るか」を素直に表す。
//
// 出力: 確認用_年齢×ボタン別マッチ結果一覧.xlsx
// 使い方: node scripts/export-verification-matrix.mjs [出力ファイル名]

import { SERVICES } from '../src/data/services.js';
import XLSX from 'xlsx';
import {
  buildProfile, extractAgeThresholds, computeBoundaryAges,
  GENDER_VALUES, MARITAL_VALUES, LIVING_VALUES, EMPLOYMENT_VALUES, HOUSING_VALUES, INCOME_VALUES,
  DISABLED_TAGS, CONCERN_TAGS, CHILD_STATUSES, ELDERLY_RELATIONS, ELDERLY_CARE_LEVELS,
  ADULT_RELATIONS, ADULT_TAGS,
  GENDER_LABEL, MARITAL_LABEL, LIVING_LABEL, EMPLOYMENT_LABEL, HOUSING_LABEL, INCOME_LABEL,
  DISABLED_LABEL, ADULT_TAG_LABEL, CONCERN_LABEL, CHILD_STATUS_LABEL, ELDERLY_RELATION_LABEL,
  ELDERLY_CARE_LEVEL_LABEL, ADULT_RELATION_LABEL, CAT_LABEL, TARGET_LABEL,
} from './lib/profile-utils.mjs';

const OUT_FILE = process.argv[2] || '確認用_年齢×ボタン別マッチ結果一覧.xlsx';

const thresholds = extractAgeThresholds(SERVICES);
const ageCols = computeBoundaryAges(thresholds); // [{ age, thresholds: Set }, ...]

function idsFor(baseProfileFields) {
  const profile = buildProfile(baseProfileFields);
  return SERVICES
    .filter(s => { try { return !!s.cond(profile); } catch { return false; } })
    .map(s => s.title)
    .join('\n');
}

function ageLabels() {
  return ageCols.map(({ age }) => `${age}歳`);
}

// ── シート1: 本人：年齢×ボタン ──────────────────────────
function buildSelfSheet() {
  const rows = [];
  rows.push(['セクション', '選択肢（日本語）', '内部値', ...ageLabels()]);

  const addRow = (section, label, value, baseFields) => {
    const row = [section, label, value];
    for (const { age } of ageCols) {
      row.push(idsFor({ ...baseFields, age: String(age) }));
    }
    rows.push(row);
  };

  addRow('基準', '（何も選択しない）', '', {});
  for (const v of GENDER_VALUES) addRow('性別', GENDER_LABEL[v], v, { gender: v });
  for (const v of MARITAL_VALUES) addRow('婚姻状況', MARITAL_LABEL[v], v, { marital: v });
  for (const v of LIVING_VALUES) addRow('居住形態', LIVING_LABEL[v], v, { living: v });
  for (const v of EMPLOYMENT_VALUES) addRow('就労状況', EMPLOYMENT_LABEL[v], v, { employment: v });
  for (const v of HOUSING_VALUES) addRow('住まいの種類', HOUSING_LABEL[v], v, { housing: v });
  for (const v of INCOME_VALUES) addRow('世帯収入の目安', INCOME_LABEL[v], v, { income: v });
  for (const v of DISABLED_TAGS) addRow('障害・困難（本人）', DISABLED_LABEL[v], v, { disabledMembers: [v] });
  for (const v of CONCERN_TAGS) addRow('困りごと', CONCERN_LABEL[v], v, { concerns: [v] });

  return rows;
}

// ── シート2: 家族登録パターン ────────────────────────────
function buildFamilySheet() {
  const rows = [];
  rows.push(['対象', '項目', '選択肢（日本語）', '内部値', ...ageLabels()]);

  const addRow = (target, item, label, value, baseFieldsFn) => {
    const row = [target, item, label, value];
    for (const { age } of ageCols) {
      row.push(idsFor(baseFieldsFn(String(age))));
    }
    rows.push(row);
  };

  for (const v of CHILD_STATUSES) {
    addRow('子ども', '状況', CHILD_STATUS_LABEL[v], v, age => ({ children: [{ age, status: v }] }));
  }
  for (const v of ELDERLY_RELATIONS) {
    addRow('高齢者', '続柄', ELDERLY_RELATION_LABEL[v], v, age => ({
      elderlyMembers: [{ age, relation: v, careLevel: 'unknown', careService: '' }],
    }));
  }
  for (const v of ELDERLY_CARE_LEVELS) {
    addRow('高齢者', '要介護度', ELDERLY_CARE_LEVEL_LABEL[v], v, age => ({
      elderlyMembers: [{ age, relation: 'parent', careLevel: v, careService: '' }],
    }));
  }
  for (const v of ADULT_RELATIONS) {
    addRow('成人家族', '続柄', ADULT_RELATION_LABEL[v], v, age => ({
      adultMembers: [{ age, relation: v, tags: [] }],
    }));
  }
  for (const v of ADULT_TAGS) {
    addRow('成人家族', '障害・困難', ADULT_TAG_LABEL[v], v, age => ({
      adultMembers: [{ age, relation: 'sibling', tags: [v] }],
    }));
  }

  return rows;
}

// ── シート3: 凡例（サービスID一覧） ──────────────────────
function buildLegendSheet() {
  const rows = [['ID', '項目名', 'カテゴリ', '対象']];
  for (const s of SERVICES) {
    rows.push([s.id, s.title, CAT_LABEL[s.cat] || s.cat, TARGET_LABEL[s.target] || s.target]);
  }
  return rows;
}

// ── シート4: 注意点 ──────────────────────────────────────
function buildNotesSheet() {
  return [
    ['この一覧の見方・注意点'],
    [''],
    ['・この一覧は services.js の cond() 関数を直接評価した結果です。'],
    ['　ResultsScreen.js が行う「本人向け／家族向けの振り分け」「重複の除外」「対象年齢による絞り込み」までは'],
    ['　再現していないため、実際のアプリ画面での表示先・表示有無とは異なる場合があります。'],
    [''],
    ['・年齢の列は、コード中で実際に使われている年齢の閾値（境界）の前後1歳です。'],
    ['　全ての年齢を網羅したものではなく、「結果が変わりうる年齢」だけを抜き出しています。'],
    [''],
    ['・「家族登録パターン」シートは、家族を1人だけ登録した場合を想定しています。'],
    ['　複数人を組み合わせて登録した場合の挙動はこの一覧には含まれていません。'],
    [''],
    ['・「介護保険サービスの利用状況」は入力画面にはありますが、現状どのマッチ条件からも'],
    ['　参照されていないため、この一覧には含めていません。'],
    [''],
    ['・セルの数字はサービスIDです。「凡例（サービスID一覧）」シートでタイトルを確認してください。'],
    ['・空欄のセルは「該当するサービスがない」ことを意味します。'],
  ];
}

function run() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildSelfSheet()), '本人：年齢×ボタン');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildFamilySheet()), '家族登録パターン');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildLegendSheet()), '凡例（サービスID一覧）');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildNotesSheet()), '注意点');
  XLSX.writeFile(wb, OUT_FILE);
  console.log(`✅ 出力しました: ${OUT_FILE}`);
  console.log(`   年齢列数: ${ageCols.length} / 本人シート行数: ${buildSelfSheet().length} / 家族シート行数: ${buildFamilySheet().length} / 凡例行数: ${SERVICES.length}`);
}

run();
