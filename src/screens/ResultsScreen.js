import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../theme';
import { SERVICES, CAT_LABELS, CAT_COLORS, SUBCAT_LABELS } from '../data/services';

// 【対象】行から年齢・対象者情報を抽出
function getAgeLabel(detail) {
  if (!detail) return null;
  const m = detail.match(/【対象[^】]*】([^\n]+)/);
  if (!m) return null;
  const t = m[1].trim();
  return t.length > 32 ? t.slice(0, 32) + '…' : t;
}

const CATS = ['all', 'emergency', 'disaster', 'child', 'health', 'mental', 'welfare', 'housing', 'work', 'money', 'elderly', 'admin'];

// 高齢者グループ（perElderly）の見出しラベルを「続柄（年齢）」の形で生成
const RELATION_LABELS = { self: '本人', parent: '親', grand: '祖父母', spouse: '配偶者', other: 'その他' };
function elderlyLabel(g) {
  const rel = RELATION_LABELS[g.relation] || `高齢者${g.idx + 1}人目`;
  return g.age ? `${rel}（${g.age}歳）` : rel;
}
function childLabel(g) {
  return `${g.idx + 1}人目のお子さま${g.age ? `（${g.age}歳）` : ''}`;
}

// 成人家族グループ（perAdult）の見出しラベルを「続柄（年齢）」の形で生成
const ADULT_RELATION_LABELS = { sibling: '兄弟姉妹', spouse: '配偶者', adult_child: '成人の子', other: 'その他' };
function adultLabel(g) {
  const rel = ADULT_RELATION_LABELS[g.relation] || `成人家族${g.idx + 1}人目`;
  return g.age ? `${rel}（${g.age}歳）` : rel;
}

export default function ResultsScreen({ navigation, route }) {
  const { profile } = route.params;
  const [activeCat, setActiveCat] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'byPerson'
  const [drillPerson, setDrillPerson] = useState(null); // null | person object from `people`
  const [drillCat, setDrillCat] = useState(null); // null | category key
  const [personViewMode, setPersonViewMode] = useState('all'); // 'all' | 'byCategory' — 人選択後のサブモード

  // 本人・世帯全体向けのマッチングでは、成人家族の情報（adultMembers）を見せない。
  // 成人家族固有の判定は下の perAdult が個別のシャドープロフィールで行うため、
  // ここで含めてしまうと「本人向け」にその家族の情報が漏れて出てしまう。
  const selfProfile = useMemo(() => ({ ...profile, adultMembers: [] }), [profile]);

  const matched = useMemo(
    () => showAll ? SERVICES : SERVICES.filter((s) => s.cond(selfProfile)),
    [selfProfile, showAll]
  );

  // 対象年齢チェック関数
  const isAgeMatch = (svc, profile) => {
    const myAge = parseInt(profile.age) || 0;
    const childAges = profile.children?.map(c => c.age || c) || [];
    if (svc.id === 1) return childAges.some(a => a <= 18) || (myAge >= 12 && myAge <= 18);
    if (svc.id === 2) return childAges.some(a => a <= 18) || (myAge >= 12 && myAge <= 18);
    if (svc.id === 3) return childAges.some(a => a <= 5) || profile.sit?.includes('pregnant') || profile.concerns?.includes('pregnant');
    if (svc.id === 4) return childAges.some(a => a <= 6);
    if (svc.id === 5) return childAges.some(a => a >= 6 && a <= 12);
    if (svc.id === 14) return (myAge >= 40 && myAge <= 74) || profile.concerns?.includes('health');
    if (svc.id === 15) return myAge >= 20 || profile.concerns?.includes('health');
    if (svc.id === 16) return myAge >= 65 || profile.elderlyMembers?.length > 0;
    if (svc.id === 13) return myAge >= 65 || profile.elderlyMembers?.length > 0;
    // 高校・大学関連サービス：本人が中高生・大学生年齢の場合も表示
    if (svc.id === 108 || svc.id === 109) return childAges.some(a => a >= 15 && a <= 18) || (myAge >= 15 && myAge <= 18);
    if (svc.id === 110) return childAges.some(a => a >= 15 && a <= 22) || (myAge >= 15 && myAge <= 25);
    return true;
  };

  // 「困っていること」による絞り込み
  const concernMatch = (svc, concerns) => {
    if (!concerns || concerns.length === 0) return true;
    const catMap = {
      pregnant:           ['child', 'health', 'money', 'work', 'welfare'],
      childcare:          ['child', 'money', 'work'],
      education:          ['child', 'money'],
      child_disability:   ['child', 'welfare'],
      nursing:            ['elderly', 'welfare', 'work'],
      work:               ['work', 'money'],
      money:              ['money', 'welfare', 'housing'],
      housing_concern:    ['housing', 'welfare'],
      health:             ['health', 'emergency', 'work'],
      mental_health:      ['mental', 'welfare'],
      disability_service: ['welfare', 'work', 'money'],
      hikikomori_concern: ['welfare', 'health', 'work'],
      dv:                 ['welfare', 'housing'],
      disaster:           ['emergency', 'disaster'],
      foreign:            ['welfare'],
      consumer:           ['welfare'],
      infertility:        ['health'],
      dementia:           ['elderly'],
      vaccination:        ['health'],
      admin:              ['admin'],
      tax:                ['money', 'admin'],
      waste:              ['admin'],
      transport:          ['elderly', 'welfare', 'admin'],
      pet:                ['admin'],
    };
    return concerns.some(c => {
      const cats = catMap[c] || [];
      return cats.includes(svc.cat) || svc.cat === 'emergency' || svc.cat === 'disaster' || svc.cat === 'admin';
    });
  };

  // 本人向け・子ども1人ずつ・高齢者1人ずつ・救急・その他に分類
  const categorized = useMemo(() => {
    const byCat = (a, b) => CATS.indexOf(a.cat) - CATS.indexOf(b.cat);
    const byTitle = (a, b) => a.title.localeCompare(b.title, 'ja');

    const matchList = (list) => showAll
      ? list
      : list
          .filter(s => isAgeMatch(s, profile))
          .filter(s => concernMatch(s, profile.explicitConcerns));

    const valid = matchList(matched);
    const emergency = valid.filter(s => s.cat === 'emergency');
    const disaster = valid.filter(s => s.cat === 'disaster');

    // 成人家族（高齢者以外）：1人ごとに、そのタグ・年齢だけを持つ仮プロフィールで改めてマッチングし直す
    // （本人自身の年齢・sit（本人の障害チェックや所得・就労状況から生成される世帯共通フラグ）を
    // そのまま引き継ぐと、家族のタグと無関係な理由でもマッチしてしまうため、
    // 年齢・sitともにその家族本人のものだけに差し替える。
    // 本人向けとの重複除外に使うため、forSelfより先に計算する）
    const perAdult = (profile.adultMembers || []).map((adult, idx) => {
      const tags = adult.tags || [];
      // concerns（困りごとチェック）も世帯共通のため、そのまま引き継ぐと「交通・移動のこと」
      // 等の本人由来の困りごとがタグなしの家族にも波及してしまう。その家族自身のタグから
      // 導ける範囲だけに絞って再構築する
      const adultConcerns = [
        ...(tags.includes('hikikomori') ? ['hikikomori_concern'] : []),
        ...(['disabled', 'intellectual', 'mental', 'gray'].some(t => tags.includes(t)) ? ['disability_service'] : []),
      ];
      const adultProfile = {
        ...profile,
        adultMembers: [adult],
        disabledMembers: tags,
        age: adult.age,
        sit: [
          ...(tags.includes('disabled') ? ['disabled'] : []),
          ...(tags.includes('gray') ? ['gray'] : []),
          ...(tags.includes('hikikomori') ? ['hikikomori'] : []),
        ],
        concerns: adultConcerns,
      };
      const services = SERVICES
        .filter(s => s.cat !== 'emergency' && s.cat !== 'disaster' && s.cat !== 'elderly' && s.cat !== 'child' && (s.target === 'adult' || s.target === 'both' || !s.target))
        .filter(s => showAll || s.cond(adultProfile))
        .filter(s => isAgeMatch(s, adultProfile))
        .filter(s => showAll || concernMatch(s, adultConcerns))
        .sort(byTitle);
      return { key: adult.id ?? idx, idx, age: adult.age, relation: adult.relation, services };
    });
    // お子さま：1人ごとに、その子だけを持つ仮プロフィールで改めてマッチングし直す
    // （きょうだいの年齢で誤って一致してしまうのを防ぐ。forSelfとの重複除外に使うため、forSelfより先に計算する）
    const perChild = (profile.children || []).map((child, idx) => {
      const childProfile = { ...profile, children: [child] };
      const services = SERVICES
        .filter(s => s.target === 'child')
        .filter(s => showAll || s.cond(childProfile))
        .filter(s => isAgeMatch(s, childProfile))
        .filter(s => showAll || concernMatch(s, profile.explicitConcerns))
        .sort(byCat);
      return { key: child.id ?? idx, idx, age: child.age, status: child.status, services };
    });

    // 「障害福祉サービスのこと」等、本人か家族かを区別しないconcernsチェック経由で
    // 成人家族向けと同じサービスがforSelfにも重複するのを防ぐ。
    // ただし「本人単独でも元々マッチする」（＝汎用的で本人にも関係がある）項目まで
    // 消してしまわないよう、本人単独では一致しない項目だけを除外対象にする
    const selfMatchedIds = new Set(matched.map(s => s.id));
    const adultAttributedIds = new Set(
      perAdult.flatMap(g => g.services.map(s => s.id)).filter(id => !selfMatchedIds.has(id))
    );
    // target:'child'の項目（高校生等就学支援金など）は本来「子どもを登録した世帯」向けだが、
    // 本人自身が15〜18歳等でcondの本人年齢条件を満たす場合（本人が高校生本人としてアプリを使うケース）
    // は、登録した子ども側で個別に一致しない限り、本人向けとして表示する。
    // ここでの「本人単独での一致」はchildrenを含めたselfMatchedIdsで判定すると、
    // 登録した子どもの年齢だけで一致したケース（本人自身は無関係）まで「本人も一致した」と
    // 誤判定してしまうため、children を除いたプロフィールで改めて判定する。
    const selfWithoutChildrenIds = new Set(
      SERVICES.filter(s => { try { return !!s.cond({ ...selfProfile, children: [] }); } catch { return false; } }).map(s => s.id)
    );
    const childAttributedIds = new Set(
      perChild.flatMap(g => g.services.map(s => s.id)).filter(id => !selfWithoutChildrenIds.has(id))
    );

    // 本人向け：世帯全体向けサービス（高齢者向け・成人家族固有・子ども固有の項目は個別セクションへ分離）
    const forSelf = valid
      .filter(s => s.cat !== 'emergency' && s.cat !== 'disaster' && s.cat !== 'elderly' && !adultAttributedIds.has(s.id) && !childAttributedIds.has(s.id) && (s.target === 'adult' || s.target === 'both' || !s.target || s.target === 'child'))
      .sort(byCat);

    // 高齢者：1人ごとに、その方だけを持つ仮プロフィールで改めてマッチングし直す
    const perElderly = (profile.elderlyMembers || []).map((elder, idx) => {
      const elderProfile = { ...profile, elderlyMembers: [elder] };
      const services = SERVICES
        .filter(s => s.cat === 'elderly')
        .filter(s => showAll || s.cond(elderProfile))
        .filter(s => isAgeMatch(s, elderProfile))
        .filter(s => showAll || concernMatch(s, profile.explicitConcerns))
        .sort(byTitle);
      return { key: elder.id ?? idx, idx, age: elder.age, relation: elder.relation, services };
    });

    return { emergency, disaster, forSelf, perChild, perElderly, perAdult };
  }, [matched, profile, showAll]);

  // 「人ごとに見る」モード用：救急医療・防災・本人・子ども・高齢者を1つのリストにまとめる（0件は除く）
  const people = useMemo(() => {
    const list = [];
    if (categorized.emergency.length) {
      list.push({ key: 'emergency', type: 'emergency', label: '救急医療', icon: 'warning', color: '#B71C1C', services: categorized.emergency });
    }
    if (profile.district) {
      list.push({ key: 'disasterInfo', type: 'disasterInfo', label: '防災情報', icon: 'alert-circle', color: '#B71C1C' });
    }
    if (categorized.disaster.length) {
      list.push({ key: 'disaster', type: 'disaster', label: '防災・備え', icon: 'home', color: '#E65100', services: categorized.disaster });
    }
    if (categorized.forSelf.length) {
      list.push({ key: 'self', type: 'self', label: '本人', icon: 'person', color: colors.primary, services: categorized.forSelf });
    }
    categorized.perChild.forEach(g => {
      if (!g.services.length) return;
      list.push({
        key: 'child-' + g.key, type: 'child',
        label: `${g.idx + 1}人目のお子さま${g.age ? `（${g.age}歳）` : ''}`,
        icon: 'happy', color: '#085041', services: g.services,
      });
    });
    categorized.perElderly.forEach(g => {
      if (!g.services.length) return;
      list.push({
        key: 'elderly-' + g.key, type: 'elderly',
        label: `高齢者${g.idx + 1}人目${g.age ? `（${g.age}歳）` : ''}`,
        icon: 'people', color: '#712B13', services: g.services,
      });
    });
    categorized.perAdult.forEach(g => {
      if (!g.services.length) return;
      list.push({
        key: 'adult-' + g.key, type: 'adult',
        label: adultLabel(g),
        icon: 'body', color: '#5C6BC0', services: g.services,
      });
    });
    return list;
  }, [categorized, profile.district]);

  // 選択中の人のサービスをカテゴリ別（高齢者・子育ては件数が多いためサブカテゴリ別）に集計
  const DRILL_ORDER = [
    'emergency', 'disaster',
    'child_care', 'child_newborn', 'child_consult', 'child_other',
    'health', 'mental', 'welfare', 'housing', 'work', 'money',
    'elderly_consult', 'elderly_care', 'elderly_money', 'elderly_rights',
    'admin',
  ];
  const categorizeByCat = (services) => {
    const map = {};
    services.forEach(s => { const key = s.subcat || s.cat; (map[key] ||= []).push(s); });
    return DRILL_ORDER.filter(k => map[k]).map(k => ({ cat: k, label: CAT_LABELS[k] || SUBCAT_LABELS[k], services: map[k] }));
  };

  const drillPersonCats = useMemo(
    () => drillPerson ? categorizeByCat(drillPerson.services) : [],
    [drillPerson]
  );

  // 救急医療・防災のように人のラベル自体がカテゴリ名と同じ場合は重複表示しない
  const drillHeading = (person, cat) => {
    const catLabel = CAT_LABELS[cat] || SUBCAT_LABELS[cat];
    return person.label === catLabel ? person.label : `${person.label}・${catLabel}`;
  };

  // 人を選択：カテゴリが1つしかなければカテゴリ選択を飛ばして直接項目一覧へ
  const selectPerson = (person) => {
    const cats = categorizeByCat(person.services);
    setDrillPerson(person);
    setDrillCat(cats.length === 1 ? cats[0].cat : null);
    setPersonViewMode('all');
  };

  // 項目一覧から「← 戻る」：カテゴリが1つしかなく自動スキップされていた場合は人一覧まで戻る
  const backFromItems = () => {
    if (drillPersonCats.length <= 1) {
      setDrillPerson(null);
      setDrillCat(null);
      setPersonViewMode('all');
    } else {
      setDrillCat(null);
    }
  };

  const switchViewMode = (mode) => {
    setViewMode(mode);
    setDrillPerson(null);
    setDrillCat(null);
    setPersonViewMode('all');
  };

  // ヘッダーの「←」：ドリルダウン中は1段階だけ戻り、一覧まで戻ったら通常通り前の画面へ
  const handleHeaderBack = () => {
    if (viewMode === 'byPerson' && drillPerson) {
      if (drillCat) {
        backFromItems();
      } else {
        setDrillPerson(null);
        setPersonViewMode('all');
      }
      return;
    }
    navigation.goBack();
  };

  const filtered = useMemo(() => {
    const allValid = showAll
      ? matched
      : matched
          .filter(s => isAgeMatch(s, profile))
          .filter(s => concernMatch(s, profile.explicitConcerns));
    if (activeCat === 'all') return allValid;
    return allValid.filter(s => s.cat === activeCat);
  }, [matched, activeCat, profile, showAll]);

  const profilePills = useMemo(() => {
    const p = [];
    if (profile.age) p.push(profile.age + '歳');
    const gm = { male: '男性', female: '女性', other: 'その他' };
    if (profile.gender && profile.gender !== 'none') p.push(gm[profile.gender]);
    const mm = { single: '独身', married: '既婚', div: 'ひとり親', widow: 'ひとり親(死別)' };
    if (profile.marital) p.push(mm[profile.marital]);
    if (profile.children?.length) p.push('子ども' + profile.children.length + '人');
    if (profile.elderlyMembers?.length) p.push('高齢者' + profile.elderlyMembers.length + '人');
    const dm = { disabled: '身体障害', intellectual: '知的障害', mental: '精神障害', gray: 'グレーゾーン', hikikomori: 'ひきこもり' };
    profile.disabledMembers?.forEach(v => { if (dm[v]) p.push(dm[v]); });
    const em = { fulltime: '正社員', parttime: 'パート', self: '自営', parental: '育休中', unemployed: '求職中', student: '学生' };
    if (profile.employment && em[profile.employment]) p.push(em[profile.employment]);
    const im = { nontax: '非課税世帯', low: '低所得', middle: '一般', high: '高所得' };
    if (profile.income && im[profile.income]) p.push(im[profile.income]);
    const cm = {
      pregnant: '妊娠・出産', childcare: '子育て', education: '教育', child_disability: '子の障害',
      nursing: '介護', work: '就労', money: 'お金', housing_concern: '住まい',
      health: '健康', mental_health: 'メンタル', disability_service: '障害福祉',
      hikikomori_concern: 'ひきこもり', dv: 'DV・虐待', disaster: '防災', foreign: '外国人', consumer: '消費生活',
      infertility: '不妊・不育症', dementia: '認知症', vaccination: '予防接種',
      admin: '行政手続き', tax: '税・年金', waste: 'ごみ', transport: '交通・移動', pet: 'ペット',
    };
    profile.concerns?.forEach(v => { if (cm[v]) p.push(cm[v]); });
    return p;
  }, [profile]);

  const totalCount = SERVICES.filter(s => s.cond(profile) && isAgeMatch(s, profile)).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleHeaderBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {viewMode === 'byPerson' && drillPerson ? drillPerson.label : 'おすすめサービス'}
        </Text>
        <TouchableOpacity
          style={[styles.allToggle, showAll && styles.allToggleActive]}
          onPress={() => { setShowAll(v => !v); setActiveCat('all'); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.allToggleText, showAll && styles.allToggleTextActive]}>
            {showAll ? `全${SERVICES.length}件` : `${totalCount}件`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 表示モード切替：人を選択中（カテゴリ複数）は「全表示／項目ごとに表示」に切り替わる */}
      <View style={styles.viewModeWrap}>
        {viewMode === 'byPerson' && drillPerson && drillCat === null && drillPersonCats.length > 1 ? (
          <>
            <TouchableOpacity
              style={[styles.viewModeBtn, personViewMode === 'all' && styles.viewModeBtnActive]}
              onPress={() => setPersonViewMode('all')}
              activeOpacity={0.7}
            >
              <Text style={[styles.viewModeBtnText, personViewMode === 'all' && styles.viewModeBtnTextActive]}>全表示</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeBtn, personViewMode === 'byCategory' && styles.viewModeBtnActive]}
              onPress={() => setPersonViewMode('byCategory')}
              activeOpacity={0.7}
            >
              <Text style={[styles.viewModeBtnText, personViewMode === 'byCategory' && styles.viewModeBtnTextActive]}>項目ごとに表示</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'all' && styles.viewModeBtnActive]}
              onPress={() => switchViewMode('all')}
              activeOpacity={0.7}
            >
              <Text style={[styles.viewModeBtnText, viewMode === 'all' && styles.viewModeBtnTextActive]}>まとめて表示</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'byPerson' && styles.viewModeBtnActive]}
              onPress={() => switchViewMode('byPerson')}
              activeOpacity={0.7}
            >
              <Text style={[styles.viewModeBtnText, viewMode === 'byPerson' && styles.viewModeBtnTextActive]}>人ごとに見る</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {viewMode === 'all' ? (
        <>
          {/* Profile pills */}
          <View style={styles.pillsWrap}>
            {profilePills.map((p, i) => (
              <View key={i} style={styles.pill}>
                <Text style={styles.pillText}>{p}</Text>
              </View>
            ))}
          </View>

          {/* Category filters - 2段折り返し */}
          <View style={styles.filterWrap}>
            {CATS.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, activeCat === cat && styles.filterChipActive, cat === 'emergency' && styles.filterChipEmergency, activeCat === cat && cat === 'emergency' && styles.filterChipEmergencyActive, cat === 'disaster' && styles.filterChipDisaster, activeCat === cat && cat === 'disaster' && styles.filterChipDisasterActive]}
                onPress={() => setActiveCat(cat)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, activeCat === cat && styles.filterChipTextActive, cat === 'emergency' && styles.filterChipTextEmergency, cat === 'disaster' && styles.filterChipTextDisaster]}>{CAT_LABELS[cat] || cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.pillsWrap}>
          {drillPerson === null ? (
            people.length === 0 ? (
              <Text style={styles.pillText}>該当する方が見つかりませんでした</Text>
            ) : (
              people.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={styles.personBtn}
                  onPress={() => p.type === 'disasterInfo'
                    ? navigation.navigate('Disaster', { districtKey: profile.district, profile })
                    : selectPerson(p)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={p.icon} size={14} color={p.color} />
                  <Text style={[styles.personBtnText, { color: p.color }]}>{p.label}</Text>
                  {p.type !== 'disasterInfo' && <Text style={styles.personBtnCount}>{p.services.length}</Text>}
                </TouchableOpacity>
              ))
            )
          ) : drillCat === null ? (
            <>
              <TouchableOpacity style={styles.backRow} onPress={() => { setDrillPerson(null); setPersonViewMode('all'); }} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
                <Text style={styles.backRowText}>{drillPerson.label}</Text>
              </TouchableOpacity>
              {personViewMode === 'byCategory' && drillPersonCats.map(c => (
                <TouchableOpacity key={c.cat} style={styles.catDrillChip} onPress={() => setDrillCat(c.cat)} activeOpacity={0.7}>
                  <Text style={styles.catDrillChipText}>{c.label}</Text>
                  <Text style={styles.catDrillChipCount}>{c.services.length}</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <TouchableOpacity style={styles.backRow} onPress={backFromItems} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
              <Text style={styles.backRowText}>{drillHeading(drillPerson, drillCat)}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={true}>

        {viewMode === 'all' ? (
          activeCat === 'all' ? (
            // グループ表示：救急医療／本人・世帯向けサービスの2つのみ
            <View style={styles.list}>
              {/* 救急医療 */}
              {categorized.emergency.length > 0 && (
                <View>
                  <View style={styles.groupHeader}>
                    <Ionicons name="warning" size={15} color="#B71C1C" />
                    <Text style={[styles.groupTitle, {color:'#B71C1C'}]}>救急医療</Text>
                    <Text style={styles.groupCount}>{categorized.emergency.length}件</Text>
                  </View>
                  {categorized.emergency.map(svc => (
                    <ServiceCard key={svc.id} svc={svc} onPress={() => navigation.navigate('Detail', { svcId: svc.id })} />
                  ))}
                </View>
              )}
              {/* 防災・備え */}
              {categorized.disaster.length > 0 && (
                <View>
                  <View style={styles.groupHeader}>
                    <Ionicons name="home" size={15} color="#E65100" />
                    <Text style={[styles.groupTitle, {color:'#E65100'}]}>防災・備え</Text>
                    <Text style={styles.groupCount}>{categorized.disaster.length}件</Text>
                  </View>
                  {categorized.disaster.map(svc => (
                    <ServiceCard key={svc.id} svc={svc} onPress={() => navigation.navigate('Detail', { svcId: svc.id })} />
                  ))}
                </View>
              )}
              {/* 本人向け */}
              {categorized.forSelf.length > 0 && (
                <View>
                  <View style={styles.groupHeader}>
                    <Ionicons name="person" size={15} color={colors.primary} />
                    <Text style={styles.groupTitle}>本人向けサービス</Text>
                    <Text style={styles.groupCount}>{categorized.forSelf.length}件</Text>
                  </View>
                  {categorized.forSelf.map(svc => (
                    <ServiceCard key={svc.id} svc={svc} onPress={() => navigation.navigate('Detail', { svcId: svc.id })} />
                  ))}
                </View>
              )}
              {/* お子さま向け（登録した子どもごと） */}
              {categorized.perChild.filter(g => g.services.length > 0).map(g => (
                <View key={'child-' + g.key}>
                  <View style={styles.groupHeader}>
                    <Ionicons name="happy" size={15} color="#085041" />
                    <Text style={[styles.groupTitle, {color:'#085041'}]}>{childLabel(g)}向けサービス</Text>
                    <Text style={styles.groupCount}>{g.services.length}件</Text>
                  </View>
                  {g.services.map(svc => (
                    <ServiceCard key={svc.id} svc={svc} onPress={() => navigation.navigate('Detail', { svcId: svc.id })} />
                  ))}
                </View>
              ))}
              {/* 高齢者向け（登録した家族ごと） */}
              {categorized.perElderly.filter(g => g.services.length > 0).map(g => (
                <View key={'elderly-' + g.key}>
                  <View style={styles.groupHeader}>
                    <Ionicons name="people" size={15} color="#712B13" />
                    <Text style={[styles.groupTitle, {color:'#712B13'}]}>{elderlyLabel(g)}向けサービス</Text>
                    <Text style={styles.groupCount}>{g.services.length}件</Text>
                  </View>
                  {g.services.map(svc => (
                    <ServiceCard key={svc.id} svc={svc} onPress={() => navigation.navigate('Detail', { svcId: svc.id })} />
                  ))}
                </View>
              ))}
              {/* 成人家族向け（登録した家族ごと） */}
              {categorized.perAdult.filter(g => g.services.length > 0).map(g => (
                <View key={'adult-' + g.key}>
                  <View style={styles.groupHeader}>
                    <Ionicons name="body" size={15} color="#5C6BC0" />
                    <Text style={[styles.groupTitle, {color:'#5C6BC0'}]}>{adultLabel(g)}向けサービス</Text>
                    <Text style={styles.groupCount}>{g.services.length}件</Text>
                  </View>
                  {g.services.map(svc => (
                    <ServiceCard key={svc.id} svc={svc} onPress={() => navigation.navigate('Detail', { svcId: svc.id })} />
                  ))}
                </View>
              ))}
            </View>
          ) : (
            // カテゴリフィルター表示
            <View style={styles.list}>
              {filtered.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="search-outline" size={40} color={colors.textTertiary} />
                  <Text style={styles.emptyText}>このカテゴリに該当するサービスは{'\n'}見つかりませんでした</Text>
                </View>
              ) : (
                filtered.map(svc => (
                  <ServiceCard key={svc.id} svc={svc} onPress={() => navigation.navigate('Detail', { svcId: svc.id })} />
                ))
              )}
            </View>
          )
        ) : (
          // 人ごとに見るモード：カテゴリを選んだとき、または「全表示」選択時のみ項目を表示
          <View style={styles.list}>
            {drillPerson && drillCat && (
              <View>
                <View style={styles.groupHeader}>
                  <Ionicons name={drillPerson.icon} size={15} color={drillPerson.color} />
                  <Text style={[styles.groupTitle, { color: drillPerson.color }]}>
                    {drillHeading(drillPerson, drillCat)}
                  </Text>
                  <Text style={styles.groupCount}>{drillPerson.services.filter(s => (s.subcat || s.cat) === drillCat).length}件</Text>
                </View>
                {drillPerson.services.filter(s => (s.subcat || s.cat) === drillCat).map(svc => (
                  <ServiceCard key={svc.id} svc={svc} onPress={() => navigation.navigate('Detail', { svcId: svc.id })} />
                ))}
              </View>
            )}
            {drillPerson && !drillCat && personViewMode === 'all' && (
              <View>
                <View style={styles.groupHeader}>
                  <Ionicons name={drillPerson.icon} size={15} color={drillPerson.color} />
                  <Text style={[styles.groupTitle, { color: drillPerson.color }]}>{drillPerson.label}</Text>
                  <Text style={styles.groupCount}>{drillPerson.services.length}件</Text>
                </View>
                {drillPerson.services.map(svc => (
                  <ServiceCard key={svc.id} svc={svc} onPress={() => navigation.navigate('Detail', { svcId: svc.id })} />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <View style={styles.fabWrap}>
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('Chat', { profile })} activeOpacity={0.85}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
          <Text style={styles.fabText}>チャットで詳しく調べる</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ServiceCard({ svc, onPress }) {
  const catColor = CAT_COLORS[svc.cat] || { bg: colors.bgSecondary, text: colors.textSecondary };
  const isEmergency = svc.cat === 'emergency';
  const ageLabel = getAgeLabel(svc.detail);
  return (
    <TouchableOpacity style={[styles.card, svc.urgent && !isEmergency && styles.cardUrgent, isEmergency && styles.cardEmergency]} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.badgeRow}>
        <View style={[styles.catTag, { backgroundColor: catColor.bg }]}>
          <Text style={[styles.catTagText, { color: catColor.text }]}>{CAT_LABELS[svc.cat]}</Text>
        </View>
        {svc.grayzone && (
          <View style={styles.grayzoneBadge}>
            <Text style={styles.grayzoneText}>手帳・診断なしでも相談OK</Text>
          </View>
        )}
        {svc.welnet && (
          <View style={styles.welnetBadge}>
            <Text style={styles.welnetText}>ウェルネット対応</Text>
          </View>
        )}
      </View>
      {ageLabel && (
        <View style={styles.ageBadge}>
          <Ionicons name="people-outline" size={11} color="#1565C0" />
          <Text style={styles.ageBadgeText}>{ageLabel}</Text>
        </View>
      )}
      <View style={styles.cardTitleRow}>
        {isEmergency && <Ionicons name="warning" size={15} color="#B71C1C" style={{ marginRight: 4, marginTop: 1 }} />}
        {svc.urgent && !isEmergency && <Ionicons name="alert-circle" size={15} color={colors.accent} style={{ marginRight: 4, marginTop: 1 }} />}
        <Text style={[styles.cardTitle, isEmergency && { color: '#B71C1C' }]}>[{svc.id}] {svc.title}</Text>
      </View>
      <Text style={styles.cardDesc} numberOfLines={2}>{svc.desc}</Text>
      <View style={styles.cardMeta}>
        <Ionicons name="call-outline" size={12} color={colors.textTertiary} />
        <Text style={styles.cardMetaText}>{svc.contact}</Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={[styles.cardLink, isEmergency && { color: '#B71C1C' }]}>詳細を見る</Text>
        <Ionicons name="chevron-forward" size={14} color={isEmergency ? '#B71C1C' : colors.accent} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.md, gap: 8 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: font.semibold, color: colors.textPrimary },
  badge: { backgroundColor: colors.primaryBg, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: font.medium, color: colors.primary },
  allToggle: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgPrimary },
  allToggleActive: { borderColor: colors.accent, backgroundColor: colors.primaryBg },
  allToggleText: { fontSize: 12, fontWeight: font.medium, color: colors.textSecondary },
  allToggleTextActive: { color: colors.primary },
  viewModeWrap: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 8, marginBottom: 10 },
  viewModeBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.bgPrimary },
  viewModeBtnActive: { borderColor: colors.accent, backgroundColor: colors.primaryBg },
  viewModeBtnText: { fontSize: 13, fontWeight: font.semibold, color: colors.textSecondary },
  viewModeBtnTextActive: { color: colors.primary, fontWeight: font.semibold },
  personBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgPrimary, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  personBtnText: { fontSize: 13, fontWeight: font.medium },
  personBtnCount: { fontSize: 11, color: colors.textTertiary, backgroundColor: colors.bgSecondary, paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.full },
  catDrillChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgPrimary, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  catDrillChipText: { fontSize: 13, fontWeight: font.medium, color: colors.textPrimary },
  catDrillChipCount: { fontSize: 11, color: colors.textTertiary, backgroundColor: colors.bgSecondary, paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.full },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4, marginBottom: 2, width: '100%' },
  backRowText: { fontSize: 13, fontWeight: font.medium, color: colors.textSecondary },
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: 5, marginBottom: 8 },
  pillsScroll: { marginBottom: 4 },
  pillsContent: { paddingHorizontal: spacing.lg, gap: 6 },
  pill: { backgroundColor: colors.bgSecondary, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 0.5, borderColor: colors.border },
  pillText: { fontSize: 11, color: colors.textSecondary },
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: 6, marginBottom: 8 },
  filterScroll: { marginBottom: 8, flexGrow: 0 },
  filterContent: { paddingHorizontal: spacing.lg, gap: 6, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, borderWidth: 0.5, borderColor: colors.border, backgroundColor: colors.bgPrimary },
  filterChipActive: { borderColor: colors.accent, backgroundColor: colors.primaryBg },
  filterChipEmergency: { borderColor: '#FFCDD2', backgroundColor: '#FFF5F5' },
  filterChipEmergencyActive: { borderColor: '#B71C1C', backgroundColor: '#FDECEA' },
  filterChipDisaster: { borderColor: '#FFCC80', backgroundColor: '#FFFDE7' },
  filterChipDisasterActive: { borderColor: '#E65100', backgroundColor: '#FFF3E0' },
  filterChipText: { fontSize: 12, color: colors.textSecondary },
  filterChipTextActive: { color: colors.primary, fontWeight: font.medium },
  filterChipTextEmergency: { color: '#B71C1C' },
  filterChipTextDisaster: { color: '#E65100' },
  list: { padding: spacing.lg, gap: 8, paddingBottom: 20 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 8, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  groupTitle: { flex: 1, fontSize: 14, fontWeight: font.semibold, color: colors.primary },
  groupCount: { fontSize: 12, color: colors.textTertiary, backgroundColor: colors.bgSecondary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  card: { backgroundColor: colors.bgPrimary, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 14, marginBottom: 2 },
  cardUrgent: { borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: 12 },
  cardEmergency: { borderLeftWidth: 3, borderLeftColor: '#B71C1C', paddingLeft: 12, backgroundColor: '#FFFAFA' },
  catTag: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  catTagText: { fontSize: 11, fontWeight: font.medium },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 7 },
  grayzoneBadge: { backgroundColor: '#F3EAFA', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  grayzoneText: { fontSize: 10, fontWeight: font.medium, color: '#7B4EA0' },
  welnetBadge: { backgroundColor: colors.primaryBg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  welnetText: { fontSize: 10, fontWeight: font.medium, color: '#185FA5' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: font.semibold, color: colors.textPrimary, lineHeight: 20 },
  cardDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 8 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  cardMetaText: { fontSize: 11, color: colors.textTertiary, flex: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  cardLink: { fontSize: 12, color: colors.accent, fontWeight: font.medium },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  ageBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E3F0FB', borderRadius: radius.full, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, marginBottom: 7 },
  ageBadgeText: { fontSize: 10, color: '#1565C0', fontWeight: font.medium },
  fabWrap: { position: 'absolute', bottom: 20, right: 16, gap: 8, alignItems: 'flex-end' },
  fab: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.primaryMid, borderRadius: radius.full, paddingVertical: 13, paddingHorizontal: 18 },
  fabText: { fontSize: 14, fontWeight: font.semibold, color: '#fff' },
});
