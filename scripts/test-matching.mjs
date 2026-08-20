#!/usr/bin/env node
// マッチングロジックの検証スクリプト
// 使い方: node scripts/test-matching.mjs
//
// 多様なシードプロフィールで SERVICES の cond() を実行し、
// 1) 各プロフィールごとのマッチ件数・タイトル一覧
// 2) detail の【対象年齢】等の記載とcondの判定が矛盾していそうなケース（要目視確認）
// をコンソールに出力する。CI等でのpass/fail判定は行わない（目視レビュー用）。

import { SERVICES } from '../src/data/services.js';
import {
  buildProfile, extractAgeThresholds, computeBoundaryAges,
  MARITAL_VALUES, EMPLOYMENT_VALUES, INCOME_VALUES, GENDER_VALUES, DISABLED_TAGS, CONCERN_TAGS,
  CHILD_STATUSES, CHILD_STATUS_AGE, ELDERLY_RELATIONS, ELDERLY_CARE_LEVELS,
} from './lib/profile-utils.mjs';

const VERBOSE = process.argv.includes('--verbose');

// ── シードプロフィール ──────────────────────────────────
const personas = [
  { name: '単身若年（20代・就労中）', profile: { age: '24', gender: 'female', marital: 'single', living: 'alone', employment: 'fulltime', housing: 'rental', income: 'middle' } },
  { name: 'ひとり親＋乳児', profile: { age: '28', gender: 'female', marital: 'div', living: 'family', employment: 'parttime', housing: 'rental', income: 'low', children: [{ age: '0', status: 'none_school' }] } },
  { name: 'ひとり親＋就学児2人（きょうだい年齢差あり）', profile: { age: '38', gender: 'female', marital: 'div', living: 'family', employment: 'parttime', housing: 'rental', income: 'low', children: [{ age: '6', status: 'elementary' }, { age: '15', status: 'junior' }] } },
  { name: '共働き＋未就学児', profile: { age: '35', gender: 'male', marital: 'married', living: 'family', employment: 'fulltime', housing: 'owned_apt', income: 'middle', children: [{ age: '3', status: 'nursery' }] } },
  { name: '高齢者本人（65歳・要介護3・一人暮らし）', profile: { age: '65', gender: 'female', marital: 'widow', living: 'alone', employment: 'unemployed', housing: 'owned_house', income: 'low' } },
  { name: '40代夫婦＋高齢の親を1人登録（介護concern選択）', profile: { age: '45', gender: 'male', marital: 'married', living: 'family', employment: 'fulltime', housing: 'owned_house', income: 'middle', elderlyMembers: [{ age: '75', relation: 'parent', careLevel: 'c2', careService: 'using' }], concerns: ['nursing'] } },
  { name: '40代夫婦＋高齢の親を2人登録（続柄・年齢が異なる）', profile: { age: '48', gender: 'female', marital: 'married', living: 'family', employment: 'parttime', housing: 'owned_house', income: 'middle', elderlyMembers: [{ age: '80', relation: 'parent', careLevel: 'c4', careService: 'using' }, { age: '78', relation: 'parent', careLevel: 's1', careService: 'not_using' }] } },
  { name: '障害のある家族と同居', profile: { age: '42', gender: 'male', marital: 'married', living: 'family', employment: 'fulltime', housing: 'rental', income: 'middle', disabledMembers: ['disabled'] } },
  { name: '住民税非課税・生活困窮', profile: { age: '52', gender: 'male', marital: 'single', living: 'alone', employment: 'unemployed', housing: 'other_housing', income: 'nontax' } },
  { name: '外国人住民', profile: { age: '30', gender: 'female', marital: 'married', living: 'family', employment: 'fulltime', housing: 'rental', income: 'middle', concerns: ['foreign'] } },
  { name: '妊娠中', profile: { age: '31', gender: 'female', marital: 'married', living: 'family', employment: 'parental', housing: 'owned_apt', income: 'middle', concerns: ['pregnant'] } },
  { name: '不登校の子どもがいる家庭', profile: { age: '44', gender: 'female', marital: 'married', living: 'family', employment: 'parttime', housing: 'rental', income: 'middle', children: [{ age: '13', status: 'futoko' }] } },
  { name: '40歳・高齢者情報の誤表示バグの再現ケース', profile: { age: '40', gender: 'male', marital: 'married', living: 'family', employment: 'fulltime', housing: 'owned_house', income: 'middle', elderlyMembers: [{ age: '68', relation: 'parent', careLevel: 'none', careService: 'not_using' }] } },
  { name: '50代夫婦＋ひきこもりの成人きょうだい（30歳）登録', profile: { age: '50', gender: 'male', marital: 'married', living: 'family', employment: 'fulltime', housing: 'owned_house', income: 'middle', adultMembers: [{ age: '30', relation: 'sibling', tags: ['hikikomori'] }] } },
  { name: '成人の子（55歳・対象年齢外）がひきこもりタグ登録', profile: { age: '80', gender: 'female', marital: 'widow', living: 'family', employment: 'unemployed', housing: 'owned_house', income: 'low', adultMembers: [{ age: '55', relation: 'adult_child', tags: ['hikikomori'] }] } },
  { name: '空プロフィール（デフォルト状態）', profile: {} },
];

// ── 年齢閾値の自動抽出（services.js の cond 関数ソースから発見） ──
// s.age / e.age（elderlyMembers要素） / c.age（children要素）に対する比較を正規表現で拾う
const ageThresholds = extractAgeThresholds(SERVICES);
console.log(`自動抽出した年齢閾値: ${ageThresholds.join(', ')}`);

// 各閾値の前後1歳（N-1, N, N+1）を境界値プロフィールとして生成（重複年齢はまとめる）
for (const { age, thresholds: srcThresholds } of computeBoundaryAges(ageThresholds)) {
  personas.push({ name: `境界値（閾値${[...srcThresholds].join('/')}近傍）：本人${age}歳のみ`, profile: { age: String(age) } });
}

// ── 属性の一因子ずつスイープ（one-factor-at-a-time） ──
// 基準プロフィール：他の属性は固定し、1項目だけ変化させる
const BASELINE = { age: '35', gender: 'male', marital: 'single', living: 'alone', employment: 'fulltime', housing: 'rental', income: 'middle' };

for (const v of MARITAL_VALUES) personas.push({ name: `スイープ: marital=${v}`, profile: { ...BASELINE, marital: v } });
for (const v of EMPLOYMENT_VALUES) personas.push({ name: `スイープ: employment=${v}`, profile: { ...BASELINE, employment: v } });
for (const v of INCOME_VALUES) personas.push({ name: `スイープ: income=${v}`, profile: { ...BASELINE, income: v } });
for (const v of GENDER_VALUES) personas.push({ name: `スイープ: gender=${v}`, profile: { ...BASELINE, gender: v } });
for (const v of DISABLED_TAGS) personas.push({ name: `スイープ: disabledMembers=[${v}]`, profile: { ...BASELINE, disabledMembers: [v] } });
for (const v of CONCERN_TAGS) personas.push({ name: `スイープ: concerns=[${v}]`, profile: { ...BASELINE, concerns: [v] } });
for (const v of CHILD_STATUSES) personas.push({ name: `スイープ: child.status=${v}`, profile: { ...BASELINE, children: [{ age: CHILD_STATUS_AGE[v], status: v }] } });
for (const v of ELDERLY_RELATIONS) personas.push({ name: `スイープ: elderly.relation=${v}`, profile: { ...BASELINE, elderlyMembers: [{ age: '75', relation: v, careLevel: 'none', careService: 'not_using' }] } });
for (const v of ELDERLY_CARE_LEVELS) personas.push({ name: `スイープ: elderly.careLevel=${v}`, profile: { ...BASELINE, elderlyMembers: [{ age: '75', relation: 'parent', careLevel: v, careService: 'using' }] } });

// ── 【対象年齢】等の記載からの年齢レンジ抽出（ヒューリスティック） ──
function extractAgeClauses(detail) {
  if (!detail) return [];
  const lines = detail.split('\n').filter(l => /^【対象/.test(l));
  const clauses = [];
  for (const line of lines) {
    const body = line.replace(/^【[^】]*】/, '');
    const segs = body.split(/[\/、]/);
    for (const seg of segs) {
      const rangeMatch = seg.match(/(\d+)\s*(?:[〜~\-]\s*(\d+))?\s*歳\s*(以上|以下|未満)?/);
      if (!rangeMatch) continue;
      let subject = '本人'; // 判定できない場合は本人向けとみなす
      if (/子ども|こども|児童|子[をがでの]|児/.test(seg)) subject = '子ども';
      else if (/高齢者|祖父母/.test(seg)) subject = '高齢者';
      else if (/本人/.test(seg)) subject = '本人';
      let min, max;
      if (rangeMatch[2]) {
        min = Number(rangeMatch[1]); max = Number(rangeMatch[2]);
      } else if (rangeMatch[3] === '以上') {
        min = Number(rangeMatch[1]); max = Infinity;
      } else if (rangeMatch[3] === '以下') {
        min = 0; max = Number(rangeMatch[1]);
      } else if (rangeMatch[3] === '未満') {
        min = 0; max = Number(rangeMatch[1]) - 1;
      } else if (/まで/.test(seg)) {
        // 「18歳到達後の最初の3月31日まで」等、「歳」直後に以上/以下等が付かない上限表現
        min = 0; max = Number(rangeMatch[1]);
      } else {
        min = max = Number(rangeMatch[1]);
      }
      clauses.push({ subject, min, max, raw: seg.trim() });
    }
  }
  return clauses;
}

function isConsistent(clause, profile) {
  const selfAge = parseInt(profile.age);
  const hasSelfAge = !Number.isNaN(selfAge);
  const elderlyInRange = () => profile.elderlyMembers?.some(e => parseInt(e.age) >= clause.min && parseInt(e.age) <= clause.max);

  if (clause.subject === '子ども') {
    if (!profile.children?.length) return null; // 子ども登録なしなら判定対象外
    return profile.children.some(c => c.age >= clause.min && c.age <= clause.max);
  }
  if (clause.subject === '高齢者') {
    if (!profile.elderlyMembers?.length) return null;
    return elderlyInRange();
  }
  // 本人：この文言は「登録済みの高齢者家族本人」を指すケースが多い
  // （例：本人65歳以上／家族に65歳以上がいれば対象、という cond 設計と対応）ため、
  // 本人の年齢が範囲外でも、登録済み高齢者家族が範囲内ならOKとみなす
  if (profile.elderlyMembers?.length && elderlyInRange()) return true;
  if (!hasSelfAge) return null; // 年齢未入力・高齢者家族もなしは判定対象外
  return selfAge >= clause.min && selfAge <= clause.max;
}

// ── 実行 ────────────────────────────────────────────────
console.log(`SERVICES: ${SERVICES.length}件 / シードプロフィール: ${personas.length}件\n`);

const suspicious = [];

for (const { name, profile: base } of personas) {
  const profile = buildProfile(base);
  const matched = SERVICES.filter(s => {
    try { return !!s.cond(profile); } catch { return false; }
  });

  if (VERBOSE) {
    console.log(`\n■ ${name}（本人age=${profile.age || '未入力'}）: ${matched.length}件マッチ`);
    console.log('  ' + matched.map(s => s.title).join(' / '));
  } else {
    console.log(`■ ${name}（本人age=${profile.age || '未入力'}）: ${matched.length}件マッチ`);
  }

  for (const svc of matched) {
    const clauses = extractAgeClauses(svc.detail);
    for (const clause of clauses) {
      const consistent = isConsistent(clause, profile);
      if (consistent === false) {
        suspicious.push({ persona: name, id: svc.id, title: svc.title, clause: clause.raw, profileAge: profile.age });
      }
    }
  }
}

console.log('\n\n========================================');
console.log(`年齢不整合の疑いあり（要目視確認）: ${suspicious.length}件`);
console.log('========================================');
for (const s of suspicious) {
  console.log(`- [id ${s.id}] ${s.title}\n    シード: ${s.persona}（本人age=${s.profileAge || '未入力'}）\n    detail記載: 「${s.clause}」`);
}
