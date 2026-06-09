import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../theme';
import { CAT_LABELS, CAT_COLORS } from '../data/services';
import { useServices } from '../context/ServicesContext';

const CATS = ['all', 'child', 'health', 'emergency', 'welfare', 'housing', 'work', 'money', 'elderly'];

export default function ResultsScreen({ navigation, route }) {
  const { profile } = route.params;
  const [activeCat, setActiveCat] = useState('all');
  const { services, loading } = useServices();

  const matched = useMemo(() => services.filter((s) => s.cond(profile)), [services, profile]);

  // データ取得中はローディング表示
  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 13 }}>サービス情報を取得中...</Text>
      </SafeAreaView>
    );
  }

  // 対象年齢チェック関数
  const isAgeMatch = (svc, profile) => {
    const childAges = profile.children?.map(c => c.age || c) || [];
    if (svc.id === 1) return childAges.some(a => a <= 15);
    if (svc.id === 2) return childAges.some(a => a <= 15);
    if (svc.id === 3) return childAges.some(a => a <= 5);
    if (svc.id === 4) return childAges.some(a => a <= 5);
    if (svc.id === 5) return childAges.some(a => a >= 6 && a <= 12);
    if (svc.id === 14) return parseInt(profile.age) >= 40 && parseInt(profile.age) <= 74;
    if (svc.id === 15) return parseInt(profile.age) >= 20;
    if (svc.id === 16) return parseInt(profile.age) >= 65 || profile.elderlyMembers?.length > 0;
    if (svc.id === 13) return parseInt(profile.age) >= 65 || profile.elderlyMembers?.length > 0;
    return true;
  };

  // 「困っていること」による絞り込み
  const concernMatch = (svc, concerns) => {
    if (!concerns || concerns.length === 0) return true;
    const catMap = {
      pregnant:           ['child', 'health', 'money'],
      childcare:          ['child', 'money'],
      education:          ['child'],
      child_disability:   ['child', 'welfare'],
      nursing:            ['elderly', 'welfare'],
      work:               ['work'],
      money:              ['money', 'welfare', 'housing'],
      housing_concern:    ['housing', 'welfare'],
      health:             ['health', 'emergency'],
      mental_health:      ['health', 'welfare'],
      disability_service: ['welfare', 'work'],
      hikikomori_concern: ['welfare', 'health'],
      dv:                 ['welfare', 'housing'],
      disaster:           ['emergency'],
      foreign:            ['welfare'],
      consumer:           ['welfare'],
    };
    return concerns.some(c => {
      const cats = catMap[c] || [];
      return cats.includes(svc.cat) || svc.cat === 'emergency';
    });
  };

  // 本人向け・子ども向け・救急・その他に分類
  const categorized = useMemo(() => {
    const valid = matched
      .filter(s => isAgeMatch(s, profile))
      .filter(s => concernMatch(s, profile.concerns));
    const emergency = valid.filter(s => s.cat === 'emergency');
    const forChild = valid.filter(s => s.cat !== 'emergency' && s.target === 'child');
    const forAdult = valid.filter(s => s.cat !== 'emergency' && (s.target === 'adult' || s.target === 'both' || !s.target));
    return { emergency, forChild, forAdult };
  }, [matched, profile]);

  const filtered = useMemo(() => {
    const allValid = matched
      .filter(s => isAgeMatch(s, profile))
      .filter(s => concernMatch(s, profile.concerns));
    if (activeCat === 'all') return allValid;
    return allValid.filter(s => s.cat === activeCat);
  }, [matched, activeCat, profile]);

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
    };
    profile.concerns?.forEach(v => { if (cm[v]) p.push(cm[v]); });
    return p;
  }, [profile]);

  const totalCount = matched.filter(s => isAgeMatch(s, profile)).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>おすすめサービス</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{totalCount}件</Text>
        </View>
      </View>

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
            style={[styles.filterChip, activeCat === cat && styles.filterChipActive, cat === 'emergency' && styles.filterChipEmergency, activeCat === cat && cat === 'emergency' && styles.filterChipEmergencyActive]}
            onPress={() => setActiveCat(cat)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeCat === cat && styles.filterChipTextActive, cat === 'emergency' && styles.filterChipTextEmergency]}>{CAT_LABELS[cat] || cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {activeCat === 'all' ? (
          // グループ表示
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
                  <ServiceCard key={svc.id} svc={svc} onPress={() => navigation.navigate('Detail', { svc })} />
                ))}
              </View>
            )}
            {/* 本人向け */}
            {categorized.forAdult.length > 0 && (
              <View>
                <View style={styles.groupHeader}>
                  <Ionicons name="person" size={15} color={colors.primary} />
                  <Text style={styles.groupTitle}>本人・世帯向けサービス</Text>
                  <Text style={styles.groupCount}>{categorized.forAdult.length}件</Text>
                </View>
                {categorized.forAdult.map(svc => (
                  <ServiceCard key={svc.id} svc={svc} onPress={() => navigation.navigate('Detail', { svc })} />
                ))}
              </View>
            )}
            {/* 子ども向け */}
            {categorized.forChild.length > 0 && (
              <View>
                <View style={styles.groupHeader}>
                  <Ionicons name="happy" size={15} color="#085041" />
                  <Text style={[styles.groupTitle, {color:'#085041'}]}>お子さま向けサービス</Text>
                  <Text style={styles.groupCount}>{categorized.forChild.length}件</Text>
                </View>
                {categorized.forChild.map(svc => (
                  <ServiceCard key={svc.id} svc={svc} onPress={() => navigation.navigate('Detail', { svc })} />
                ))}
              </View>
            )}
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
                <ServiceCard key={svc.id} svc={svc} onPress={() => navigation.navigate('Detail', { svc })} />
              ))
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <View style={styles.fabWrap}>
        {profile.district && (
          <TouchableOpacity style={styles.fabDisaster} onPress={() => navigation.navigate('Disaster', { districtKey: profile.district, profile })} activeOpacity={0.85}>
            <Ionicons name="warning-outline" size={18} color="#B71C1C" />
            <Text style={styles.fabDisasterText}>{profile.district ? require('../data/districts').DISTRICT_LIST.find(d => d.key === profile.district)?.name : ''}の防災情報</Text>
          </TouchableOpacity>
        )}
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
      <View style={styles.cardTitleRow}>
        {isEmergency && <Ionicons name="warning" size={15} color="#B71C1C" style={{ marginRight: 4, marginTop: 1 }} />}
        {svc.urgent && !isEmergency && <Ionicons name="alert-circle" size={15} color={colors.accent} style={{ marginRight: 4, marginTop: 1 }} />}
        <Text style={[styles.cardTitle, isEmergency && { color: '#B71C1C' }]}>{svc.title}</Text>
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
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.md, gap: 8 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: font.semibold, color: colors.textPrimary },
  badge: { backgroundColor: colors.primaryBg, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: font.medium, color: colors.primary },
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
  filterChipText: { fontSize: 12, color: colors.textSecondary },
  filterChipTextActive: { color: colors.primary, fontWeight: font.medium },
  filterChipTextEmergency: { color: '#B71C1C' },
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
  fabWrap: { position: 'absolute', bottom: 20, right: 16, gap: 8, alignItems: 'flex-end' },
  fab: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.primaryMid, borderRadius: radius.full, paddingVertical: 13, paddingHorizontal: 18 },
  fabText: { fontSize: 14, fontWeight: font.semibold, color: '#fff' },
  fabDisaster: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FDECEA', borderRadius: radius.full, paddingVertical: 11, paddingHorizontal: 16, borderWidth: 1, borderColor: '#FFCDD2' },
  fabDisasterText: { fontSize: 13, fontWeight: font.semibold, color: '#B71C1C' },
});
