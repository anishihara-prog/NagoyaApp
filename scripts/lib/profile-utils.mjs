// ProfileScreen.js の doSearch() と同じプロフィール変換、および services.js の
// cond() から使われている年齢閾値の抽出ロジック。
// test-matching.mjs / export-verification-matrix.mjs から共有で使う。

// ProfileScreen.js の doSearch() と同じ変換（concers自動補完・sit配列生成）を再現
export function buildProfile(base) {
  const {
    age = '', gender = '', marital = '', living = '', employment = '', housing = '',
    income = '', district = '', children = [], elderlyMembers = [], adultMembers = [], disabledMembers = [], concerns = [],
  } = base;

  const autoConcerns = [...concerns];
  children.forEach(c => {
    if (c.status === 'futoko' && !autoConcerns.includes('hikikomori_concern')) autoConcerns.push('hikikomori_concern');
    if (c.status === 'futoko' && !autoConcerns.includes('education')) autoConcerns.push('education');
    if (c.status === 'special' && !autoConcerns.includes('child_disability')) autoConcerns.push('child_disability');
    if (['nursery', 'elementary', 'junior', 'high'].includes(c.status) && !autoConcerns.includes('childcare')) autoConcerns.push('childcare');
  });
  if ((elderlyMembers.length > 0 || parseInt(age) >= 65) && !autoConcerns.includes('nursing')) autoConcerns.push('nursing');
  if (employment === 'unemployed' && !autoConcerns.includes('work')) autoConcerns.push('work');
  if (employment === 'student' && !autoConcerns.includes('education')) autoConcerns.push('education');
  if (employment === 'disabled_work' && !autoConcerns.includes('disability_service')) autoConcerns.push('disability_service');
  if ((income === 'low' || income === 'nontax') && !autoConcerns.includes('money')) autoConcerns.push('money');

  return {
    age, gender, marital, living, employment, housing, income, district,
    children: children.map(c => ({ age: parseInt(c.age) || 0, status: c.status })),
    elderlyMembers,
    adultMembers,
    disabledMembers,
    concerns: autoConcerns,
    sit: [
      ...(disabledMembers.includes('disabled') || employment === 'disabled_work' ? ['disabled'] : []),
      ...(disabledMembers.includes('gray') ? ['gray'] : []),
      ...(disabledMembers.includes('hikikomori') ? ['hikikomori'] : []),
      ...(children.some(c => c.status === 'futoko') ? ['hikikomori'] : []),
      ...(autoConcerns.includes('nursing') ? ['nursing'] : []),
      ...(autoConcerns.includes('pregnant') ? ['pregnant'] : []),
      ...(employment === 'unemployed' ? ['unemployed'] : []),
      ...(income === 'low' || income === 'nontax' ? ['lowincome'] : []),
      ...(elderlyMembers.length > 0 || parseInt(age) >= 65 ? ['elderly'] : []),
    ],
  };
}

// 年齢閾値の自動抽出（services.js の cond 関数ソースから発見）
// s.age / e.age（elderlyMembers要素） / c.age（children要素）に対する比較を正規表現で拾う
export function extractAgeThresholds(services) {
  const thresholds = new Set();
  const forward = /\b(?:parseInt\(\s*)?[sec]\.age\)?\s*(?:>=|<=|>|<|===|==)\s*(\d+)/g;
  const backward = /(\d+)\s*(?:>=|<=|>|<|===|==)\s*(?:parseInt\(\s*)?[sec]\.age\)?/g;
  for (const svc of services) {
    const src = svc.cond.toString();
    let m;
    while ((m = forward.exec(src))) thresholds.add(Number(m[1]));
    while ((m = backward.exec(src))) thresholds.add(Number(m[1]));
  }
  return [...thresholds].sort((a, b) => a - b);
}

// 各閾値の前後1歳（N-1, N, N+1）を境界値として生成し、年齢ごとに「どの閾値の近傍か」をまとめる
// 戻り値: [{ age, thresholds: Set<number> }, ...]（age昇順）
export function computeBoundaryAges(thresholds, { includePlusOne = true } = {}) {
  const boundaryAgeMap = new Map();
  for (const t of thresholds) {
    const deltas = includePlusOne ? [-1, 0, 1] : [-1, 0];
    for (const d of deltas) {
      const age = t + d;
      if (age < 0) continue;
      if (!boundaryAgeMap.has(age)) boundaryAgeMap.set(age, new Set());
      boundaryAgeMap.get(age).add(t);
    }
  }
  return [...boundaryAgeMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([age, thresholdSet]) => ({ age, thresholds: thresholdSet }));
}

// ── ProfileScreen.js の選択肢と同期を保つこと ──────────────────
export const GENDER_VALUES = ['male', 'female', 'other', 'none'];
export const MARITAL_VALUES = ['single', 'married', 'div', 'widow'];
export const LIVING_VALUES = ['alone', 'family'];
export const EMPLOYMENT_VALUES = ['fulltime', 'parttime', 'self', 'parental', 'unemployed', 'student', 'disabled_work'];
export const HOUSING_VALUES = ['owned_house', 'owned_apt', 'rental', 'public', 'company', 'other_housing'];
export const INCOME_VALUES = ['nontax', 'low', 'middle', 'high', 'unknown'];
export const DISABLED_TAGS = ['disabled', 'intellectual', 'mental', 'gray', 'hikikomori'];
export const ADULT_TAGS = ['disabled', 'intellectual', 'mental', 'gray', 'hikikomori'];
export const ADULT_RELATIONS = ['sibling', 'spouse', 'adult_child', 'other'];
export const CONCERN_TAGS = [
  'pregnant', 'childcare', 'education', 'child_disability', 'nursing', 'work', 'money',
  'housing_concern', 'health', 'mental_health', 'disability_service', 'hikikomori_concern',
  'dv', 'disaster', 'foreign', 'consumer', 'infertility', 'dementia', 'vaccination',
  'admin', 'tax', 'waste', 'transport', 'pet',
];
export const CHILD_STATUSES = ['nursery', 'elementary', 'junior', 'high', 'futoko', 'special', 'none_school'];
export const CHILD_STATUS_AGE = { nursery: '3', elementary: '8', junior: '13', high: '16', futoko: '13', special: '8', none_school: '0' };
export const ELDERLY_RELATIONS = ['self', 'parent', 'grand', 'spouse', 'other'];
export const ELDERLY_CARE_LEVELS = ['unknown', 'none', 's1', 's2', 'c1', 'c2', 'c3', 'c4', 'c5'];

export const GENDER_LABEL = { male: '男性', female: '女性', other: 'その他', none: '未回答' };
export const MARITAL_LABEL = { single: '独身', married: '既婚', div: '離婚・別居', widow: '死別' };
export const LIVING_LABEL = { alone: '一人暮らし', family: '家族と同居' };
export const EMPLOYMENT_LABEL = {
  fulltime: '正社員・公務員', parttime: 'パート・アルバイト', self: '自営業・フリー',
  parental: '育休・産休中', unemployed: '求職中・無職', student: '学生', disabled_work: '障害等で未就労',
};
export const HOUSING_LABEL = {
  owned_house: '持ち家（戸建て）', owned_apt: '持ち家（マンション）', rental: '民間賃貸',
  public: '公営住宅', company: '社宅・寮', other_housing: 'その他・不安定',
};
export const INCOME_LABEL = {
  nontax: '住民税非課税', low: '低所得（年収200万以下）', middle: '一般（年収200〜600万）',
  high: '比較的高め（年収600万超）', unknown: 'わからない',
};
export const DISABLED_LABEL = {
  disabled: '身体障害（手帳あり）', intellectual: '知的障害（療育手帳）', mental: '精神障害（手帳あり）',
  gray: '発達障害の疑い（診断なし）', hikikomori: 'ひきこもり・不登校',
};
export const ADULT_TAG_LABEL = DISABLED_LABEL;
export const ADULT_RELATION_LABEL = { sibling: '兄弟姉妹', spouse: '配偶者', adult_child: '成人の子', other: 'その他' };
export const CONCERN_LABEL = {
  pregnant: '妊娠・出産のこと', childcare: '子育て・保育のこと', education: '子どもの教育・学校のこと',
  child_disability: '子どもの障害・発達のこと', nursing: '介護・高齢者のこと', work: '仕事・就労のこと',
  money: 'お金・生活費のこと', housing_concern: '住まいのこと', health: '健康・医療のこと',
  mental_health: '心の健康・メンタルのこと', disability_service: '障害福祉サービスのこと',
  hikikomori_concern: 'ひきこもり・不登校のこと', dv: 'DV・虐待・ハラスメント', disaster: '防災・災害への備え',
  foreign: '外国人・多文化共生', consumer: '消費生活・詐欺被害', infertility: '不妊・不育症のこと',
  dementia: '認知症のこと', vaccination: '感染症・予防接種のこと', admin: '行政手続き・証明のこと',
  tax: '税・国民年金のこと', waste: 'ごみ・リサイクルのこと', transport: '交通・移動のこと', pet: 'ペット・動物のこと',
};
export const CHILD_STATUS_LABEL = {
  nursery: '保育所・幼稚園通園中', elementary: '小学生', junior: '中学生', high: '高校生',
  futoko: '不登校・登校しぶり', special: '障害・発達支援中', none_school: '未就園',
};
export const ELDERLY_RELATION_LABEL = { self: '本人', parent: '親', grand: '祖父母', spouse: '配偶者', other: 'その他' };
export const ELDERLY_CARE_LEVEL_LABEL = {
  unknown: '不明', none: '自立', s1: '要支援1', s2: '要支援2',
  c1: '要介護1', c2: '要介護2', c3: '要介護3', c4: '要介護4', c5: '要介護5',
};

export const CAT_LABEL = {
  money: '給付・手当', child: '子育て', health: '医療・健康', elderly: '高齢者',
  welfare: '福祉', housing: '住まい', work: '就労', mental: '心の健康',
  emergency: '救急医療', disaster: '防災・備え', admin: '行政手続き',
};
export const TARGET_LABEL = { child: '子ども', adult: '本人・大人', both: '両方' };
