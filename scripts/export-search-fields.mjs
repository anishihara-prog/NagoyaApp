#!/usr/bin/env node
// 検索画面（ProfileScreen.js）の入力項目（ボタン・チェックボックス）一覧をExcelにする。
// マッチ結果は含まない、選択肢そのものの一覧。
// 使い方: node scripts/export-search-fields.mjs [出力ファイル名]

import XLSX from 'xlsx';
import {
  GENDER_VALUES, MARITAL_VALUES, LIVING_VALUES, EMPLOYMENT_VALUES, HOUSING_VALUES, INCOME_VALUES,
  DISABLED_TAGS, CONCERN_TAGS, CHILD_STATUSES, ELDERLY_RELATIONS, ELDERLY_CARE_LEVELS,
  ADULT_RELATIONS, ADULT_TAGS,
  GENDER_LABEL, MARITAL_LABEL, LIVING_LABEL, EMPLOYMENT_LABEL, HOUSING_LABEL, INCOME_LABEL,
  DISABLED_LABEL, ADULT_TAG_LABEL, CONCERN_LABEL, CHILD_STATUS_LABEL, ELDERLY_RELATION_LABEL,
  ELDERLY_CARE_LEVEL_LABEL, ADULT_RELATION_LABEL,
} from './lib/profile-utils.mjs';

const OUT_FILE = process.argv[2] || '確認用_検索項目一覧.xlsx';

const rows = [['区分', 'セクション', '選択肢（日本語）', '内部値', '複数選択可否']];

const addRows = (section, values, labelMap, multi) => {
  for (const v of values) rows.push(['本人', section, labelMap[v], v, multi ? '複数選択可' : '単一選択']);
};

addRows('性別', GENDER_VALUES, GENDER_LABEL, false);
addRows('婚姻状況', MARITAL_VALUES, MARITAL_LABEL, false);
addRows('居住形態', LIVING_VALUES, LIVING_LABEL, false);
addRows('就労状況', EMPLOYMENT_VALUES, EMPLOYMENT_LABEL, false);
addRows('住まいの種類', HOUSING_VALUES, HOUSING_LABEL, false);
addRows('世帯収入の目安', INCOME_VALUES, INCOME_LABEL, false);
addRows('障害・困難', DISABLED_TAGS, DISABLED_LABEL, true);
addRows('困りごと・相談したいこと', CONCERN_TAGS, CONCERN_LABEL, true);

for (const v of CHILD_STATUSES) rows.push(['お子さまの情報', '状況', CHILD_STATUS_LABEL[v], v, '単一選択（子ども1人ごと）']);
for (const v of ELDERLY_RELATIONS) rows.push(['同居する高齢者の情報', '続柄', ELDERLY_RELATION_LABEL[v], v, '単一選択（高齢者1人ごと）']);
for (const v of ELDERLY_CARE_LEVELS) rows.push(['同居する高齢者の情報', '要介護度', ELDERLY_CARE_LEVEL_LABEL[v], v, '単一選択（高齢者1人ごと）']);
for (const v of ADULT_RELATIONS) rows.push(['同居する成人家族の情報', '続柄', ADULT_RELATION_LABEL[v], v, '単一選択（成人家族1人ごと）']);
for (const v of ADULT_TAGS) rows.push(['同居する成人家族の情報', '障害・困難', ADULT_TAG_LABEL[v], v, '複数選択可（成人家族1人ごと）']);

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), '検索項目一覧');
XLSX.writeFile(wb, OUT_FILE);
console.log(`✅ 出力しました: ${OUT_FILE}（${rows.length - 1}件）`);
