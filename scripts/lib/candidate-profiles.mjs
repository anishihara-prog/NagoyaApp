// 各サービスについて「これを選べば実際にマッチするはず」という、UI操作に対応した
// 候補プロフィールのリストを作る。scripts/e2e-audit-all-services.cjs のcond()充足チェックと
// Playwright操作の両方から使う共通定義。
import {
  buildProfile,
  GENDER_VALUES, MARITAL_VALUES, LIVING_VALUES, EMPLOYMENT_VALUES, HOUSING_VALUES, INCOME_VALUES,
  DISABLED_TAGS, CONCERN_TAGS, CHILD_STATUSES, CHILD_STATUS_AGE, ELDERLY_RELATIONS, ELDERLY_CARE_LEVELS,
  ADULT_RELATIONS, ADULT_TAGS,
  GENDER_LABEL, MARITAL_LABEL, LIVING_LABEL, EMPLOYMENT_LABEL, HOUSING_LABEL, INCOME_LABEL,
  DISABLED_LABEL, ADULT_TAG_LABEL, CONCERN_LABEL, CHILD_STATUS_LABEL, ELDERLY_RELATION_LABEL,
  ELDERLY_CARE_LEVEL_LABEL, ADULT_RELATION_LABEL,
} from './profile-utils.mjs';

const REP_AGES = ['16', '30', '45', '70'];
const AGE_ONLY = ['14', '16', '18', '20', '25', '39', '40', '49', '59', '60', '65', '70', '74', '75', '80'];

// DISABLED_LABEL/ADULT_TAG_LABEL は見やすさのため改行を除いた表記だが、
// 実際の画面（ProfileScreen.js）ではボタンラベルに改行が入っているため、
// Playwright操作（getByText exact）にはこちらの実表記を使う。
const UI_CLICK_LABEL = { ...DISABLED_LABEL, gray: '発達障害の疑い\n（診断なし）', hikikomori: 'ひきこもり・\n不登校' };

function candidate(desc, fields, uiActions) {
  return { desc, fields, uiActions };
}

export function buildCandidates() {
  const list = [];

  // 1. 年齢だけ
  for (const age of AGE_ONLY) {
    list.push(candidate(`本人${age}歳のみ`, { age }, [{ type: 'age', value: age }]));
  }

  // 2. 本人の単一ボタン × 代表年齢
  for (const age of REP_AGES) {
    for (const v of GENDER_VALUES) {
      list.push(candidate(`性別=${GENDER_LABEL[v]}, ${age}歳`, { age, gender: v }, [{ type: 'age', value: age }, { type: 'click', label: GENDER_LABEL[v] }]));
    }
    for (const v of MARITAL_VALUES) {
      list.push(candidate(`婚姻状況=${MARITAL_LABEL[v]}, ${age}歳`, { age, marital: v }, [{ type: 'age', value: age }, { type: 'click', label: MARITAL_LABEL[v] }]));
    }
    for (const v of LIVING_VALUES) {
      list.push(candidate(`居住形態=${LIVING_LABEL[v]}, ${age}歳`, { age, living: v }, [{ type: 'age', value: age }, { type: 'click', label: LIVING_LABEL[v] }]));
    }
    for (const v of EMPLOYMENT_VALUES) {
      list.push(candidate(`就労状況=${EMPLOYMENT_LABEL[v]}, ${age}歳`, { age, employment: v }, [{ type: 'age', value: age }, { type: 'click', label: EMPLOYMENT_LABEL[v] }]));
    }
    for (const v of HOUSING_VALUES) {
      list.push(candidate(`住まいの種類=${HOUSING_LABEL[v]}, ${age}歳`, { age, housing: v }, [{ type: 'age', value: age }, { type: 'click', label: HOUSING_LABEL[v] }]));
    }
    for (const v of INCOME_VALUES) {
      list.push(candidate(`世帯収入=${INCOME_LABEL[v]}, ${age}歳`, { age, income: v }, [{ type: 'age', value: age }, { type: 'click', label: INCOME_LABEL[v] }]));
    }
    for (const v of DISABLED_TAGS) {
      list.push(candidate(`障害・困難=${DISABLED_LABEL[v]}, ${age}歳`, { age, disabledMembers: [v] }, [{ type: 'age', value: age }, { type: 'click', label: UI_CLICK_LABEL[v] }]));
    }
    for (const v of CONCERN_TAGS) {
      list.push(candidate(`困りごと=${CONCERN_LABEL[v]}, ${age}歳`, { age, concerns: [v] }, [{ type: 'age', value: age }, { type: 'click', label: CONCERN_LABEL[v] }]));
    }
  }

  // 3. 家族登録パターン（本人年齢は空、または代表年齢）
  for (const v of CHILD_STATUSES) {
    const cAge = CHILD_STATUS_AGE[v];
    list.push(candidate(`子ども:状況=${CHILD_STATUS_LABEL[v]}`, { children: [{ age: cAge, status: v }] },
      [{ type: 'addChild', age: cAge, status: CHILD_STATUS_LABEL[v] }]));
  }
  for (const v of ELDERLY_RELATIONS) {
    list.push(candidate(`高齢者:続柄=${ELDERLY_RELATION_LABEL[v]}`, { elderlyMembers: [{ age: '75', relation: v, careLevel: 'unknown', careService: '' }] },
      [{ type: 'addElderly', age: '75', relation: ELDERLY_RELATION_LABEL[v] }]));
  }
  for (const v of ELDERLY_CARE_LEVELS) {
    list.push(candidate(`高齢者:要介護度=${ELDERLY_CARE_LEVEL_LABEL[v]}`, { elderlyMembers: [{ age: '75', relation: 'parent', careLevel: v, careService: '' }] },
      [{ type: 'addElderly', age: '75', relation: ELDERLY_RELATION_LABEL.parent, careLevel: ELDERLY_CARE_LEVEL_LABEL[v] }]));
  }
  for (const v of ADULT_RELATIONS) {
    list.push(candidate(`成人家族:続柄=${ADULT_RELATION_LABEL[v]}`, { adultMembers: [{ age: '30', relation: v, tags: [] }] },
      [{ type: 'addAdult', age: '30', relation: ADULT_RELATION_LABEL[v] }]));
  }
  for (const v of ADULT_TAGS) {
    list.push(candidate(`成人家族:障害・困難=${ADULT_TAG_LABEL[v]}`, { adultMembers: [{ age: '30', relation: 'sibling', tags: [v] }] },
      [{ type: 'addAdult', age: '30', relation: ADULT_RELATION_LABEL.sibling, tags: [UI_CLICK_LABEL[v]] }]));
  }

  // 4. 複合条件（年齢+就労状況/所得/困りごと 等）を持つ既知サービス向けの組み合わせ候補
  const comboSpecs = [
    { age: '30', employment: 'unemployed', income: 'low' },
    { age: '30', employment: 'student' },
    { age: '17', income: 'low' },
    { age: '17', income: 'nontax' },
    { age: '30', concerns: ['work'], employment: 'unemployed' },
    { age: '30', concerns: ['disaster'], elderlyMembers: [{ age: '75', relation: 'parent', careLevel: 'unknown', careService: '' }] },
    { age: '65', concerns: ['vaccination'] },
    { age: '30', concerns: ['vaccination'], children: [{ age: '3', status: 'nursery' }] },
    { age: '35', concerns: ['nursing'], elderlyMembers: [{ age: '75', relation: 'parent', careLevel: 'c4', careService: '' }] },
    { age: '20', marital: 'div', children: [{ age: '5', status: 'nursery' }] },
    { age: '20', employment: 'parental', concerns: ['pregnant'] },
    { age: '30', gender: 'female', marital: 'div', income: 'low', children: [{ age: '10', status: 'elementary' }] },
    { age: '30', marital: 'div', concerns: ['housing_concern'], children: [{ age: '10', status: 'elementary' }] },
    { age: '30', income: 'low', children: [{ age: '10', status: 'elementary' }] },
    { age: '30', income: 'low', children: [{ age: '15', status: 'junior' }] },
    { age: '30', concerns: ['vaccination', 'pregnant'] },
  ];
  for (const spec of comboSpecs) {
    const uiActions = [{ type: 'age', value: spec.age }];
    if (spec.gender) uiActions.push({ type: 'click', label: GENDER_LABEL[spec.gender] });
    if (spec.employment) uiActions.push({ type: 'click', label: EMPLOYMENT_LABEL[spec.employment] });
    if (spec.income) uiActions.push({ type: 'click', label: INCOME_LABEL[spec.income] });
    if (spec.marital) uiActions.push({ type: 'click', label: MARITAL_LABEL[spec.marital] });
    if (spec.concerns) for (const c of spec.concerns) uiActions.push({ type: 'click', label: CONCERN_LABEL[c] });
    if (spec.children) for (const c of spec.children) uiActions.push({ type: 'addChild', age: c.age, status: CHILD_STATUS_LABEL[c.status] });
    if (spec.elderlyMembers) for (const e of spec.elderlyMembers) uiActions.push({ type: 'addElderly', age: e.age, relation: ELDERLY_RELATION_LABEL[e.relation], careLevel: e.careLevel !== 'unknown' ? ELDERLY_CARE_LEVEL_LABEL[e.careLevel] : undefined });
    list.push(candidate('複合: ' + JSON.stringify(spec), spec, uiActions));
  }

  // 5. 個別対応: 同年齢の子ども2人（多胎児家庭支援事業）
  list.push(candidate('子ども2人・同年齢（双子）', { age: '30', children: [{ age: '3', status: 'nursery' }, { age: '3', status: 'nursery' }] },
    [{ type: 'age', value: '30' }, { type: 'addChild', age: '3', status: CHILD_STATUS_LABEL.nursery }, { type: 'addChild', age: '3', status: CHILD_STATUS_LABEL.nursery }]));

  return list;
}

// SERVICES の各サービスについて、cond()を満たす最初の候補を1つ選ぶ
export function assignCandidates(services) {
  const candidates = buildCandidates();
  // あらかじめ全候補のプロフィール化とマッチ結果を計算
  const evaluated = candidates.map(c => ({ ...c, profile: buildProfile(c.fields) }));

  const result = new Map(); // id -> candidate or null
  for (const s of services) {
    let found = null;
    for (const c of evaluated) {
      try {
        if (s.cond(c.profile)) { found = c; break; }
      } catch { /* skip */ }
    }
    result.set(s.id, found);
  }
  return result;
}
