import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../theme';
import { SERVICES, CAT_LABELS, CAT_COLORS } from '../data/services';
import MATCH_CONDITION_LABELS from '../data/matchConditionLabels.json';

const TARGET_LABELS = { child: '子ども', adult: '本人・大人', both: '両方' };

// 【対象】【必要書類】等のdetail見出しを、開発確認用レイアウトのセクションに振り分ける
const SECTION_RULES = [
  { key: 'target', title: '対象となる方', match: /^対象/, canonical: ['対象', '対象年齢'] },
  { key: 'procedure', title: '手続きの流れ', match: /^(申請|受付|利用方法|手続き)/, canonical: ['申請方法', '申請先'] },
  { key: 'needed', title: '必要なもの', match: /^必要書類/, canonical: ['必要書類'] },
];

function parseDetailSections(detail) {
  const lines = (detail || '').split('\n').filter(l => l.trim());
  const sections = { target: [], procedure: [], needed: [], other: [] };
  for (const line of lines) {
    const m = line.match(/^【([^】]+)】(.*)$/);
    if (!m) { sections.other.push(line); continue; }
    const [, label, body] = m;
    const rule = SECTION_RULES.find(r => r.match.test(label));
    if (rule) {
      const isCanonical = rule.canonical.includes(label);
      sections[rule.key].push(isCanonical ? body : `${label}：${body}`);
    } else {
      sections.other.push(`【${label}】${body}`);
    }
  }
  return sections;
}

export default function DetailScreen({ navigation, route }) {
  const { svcId } = route.params;
  const svc = SERVICES.find(s => s.id === svcId);
  const catColor = CAT_COLORS[svc.cat] || { bg: colors.bgSecondary, text: colors.textSecondary };

  const openURL = (url) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(url).catch(() => Alert.alert('エラー', 'URLを開けませんでした'));
  };

  // URL が空・未設定の場合は名古屋市トップページへフォールバック
  const officialUrl = (svc.url && svc.url.startsWith('http'))
    ? svc.url
    : 'https://www.city.nagoya.jp/';

  const sections = parseDetailSections(svc.detail);
  const matchConditionLabel = MATCH_CONDITION_LABELS[String(svc.id)];

  const infoTags = [
    CAT_LABELS[svc.cat],
    TARGET_LABELS[svc.target] || '対象不問',
    svc.grayzone && '手帳・診断なしでも相談OK',
    svc.urgent && '早めに申請推奨',
    svc.welnet && 'ウェルネット対応',
  ].filter(Boolean);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>サービス詳細</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={true}>
        <View style={styles.card}>
          <View style={styles.catTag}>
            <Text style={[styles.catTagText, { color: catColor.text }]}>{CAT_LABELS[svc.cat]}</Text>
          </View>

          <Text style={styles.title}>[{svc.id}] {svc.title}</Text>
          <Text style={styles.desc}>{svc.desc}</Text>

          <View style={styles.divider} />

          {sections.target.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>対象となる方</Text>
              {sections.target.map((t, i) => <Text key={i} style={styles.sectionText}>{t}</Text>)}
            </View>
          )}

          {sections.procedure.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>手続きの流れ</Text>
              {sections.procedure.map((t, i) => <Text key={i} style={styles.sectionText}>・{t}</Text>)}
            </View>
          )}

          {sections.needed.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>必要なもの</Text>
              {sections.needed.map((t, i) => <Text key={i} style={styles.sectionText}>・{t}</Text>)}
            </View>
          )}

          {sections.other.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>その他</Text>
              {sections.other.map((t, i) => <Text key={i} style={styles.sectionText}>{t}</Text>)}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>窓口・問い合わせ先</Text>
            <Text style={styles.sectionText}>{svc.contact}</Text>
            {svc.hours && <Text style={styles.sectionText}>{svc.hours}</Text>}
          </View>

          <View style={styles.tagRow}>
            {infoTags.map((t, i) => (
              <View key={i} style={styles.infoTag}>
                <Text style={styles.infoTagText}>{t}</Text>
              </View>
            ))}
          </View>

          {/* DEV ONLY: マッチ条件（日本語）の確認用。本番リリース前に削除すること */}
          {matchConditionLabel ? (
            <View style={styles.devSection}>
              <Text style={styles.devSectionTitle}>[開発用] マッチ条件（日本語）</Text>
              <Text style={styles.devSectionText}>{matchConditionLabel}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => openURL(officialUrl)}
          activeOpacity={0.8}
        >
          <Ionicons name="globe-outline" size={16} color={colors.primary} />
          <Text style={styles.linkBtnText}>{svc.urlLabel || '名古屋市公式サイトで確認する'}</Text>
          <Ionicons name="open-outline" size={14} color={colors.primary} />
        </TouchableOpacity>

        {svc.welnet && (
          <TouchableOpacity
            style={styles.welnetBtn}
            onPress={() => openURL('https://www.kaigo-wel.city.nagoya.jp/view/wel/jigyosho/')}
            activeOpacity={0.8}
          >
            <Ionicons name="search-outline" size={16} color="#185FA5" />
            <View style={styles.welnetBtnTextWrap}>
              <Text style={styles.welnetBtnTitle}>ウェルネット名古屋で事業所を探す</Text>
              <Text style={styles.welnetBtnSub}>名古屋市公式の介護・障害サービス事業所検索</Text>
            </View>
            <Ionicons name="open-outline" size={14} color="#185FA5" />
          </TouchableOpacity>
        )}

        {svc.externalUrl && (
          <TouchableOpacity
            style={styles.externalLinkBtn}
            onPress={() => openURL(svc.externalUrl)}
            activeOpacity={0.8}
          >
            <Ionicons name="exit-outline" size={16} color="#6A1B9A" />
            <Text style={styles.externalLinkBtnText}>{svc.externalLabel || '外部サイトで詳細を見る'}</Text>
            <Ionicons name="open-outline" size={14} color="#6A1B9A" />
          </TouchableOpacity>
        )}

        {(svc.extraLinks || []).map((link, i) => (
          <TouchableOpacity
            key={i}
            style={styles.externalLinkBtn}
            onPress={() => openURL(link.url)}
            activeOpacity={0.8}
          >
            <Ionicons name="exit-outline" size={16} color="#6A1B9A" />
            <Text style={styles.externalLinkBtnText}>{link.label || '外部サイトで詳細を見る'}</Text>
            <Ionicons name="open-outline" size={14} color="#6A1B9A" />
          </TouchableOpacity>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.md, gap: 8 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: font.semibold, color: colors.textPrimary },
  scroll: { flex: 1 },
  card: {
    margin: spacing.lg, marginTop: spacing.sm,
    backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: 18,
  },
  catTag: { alignSelf: 'flex-start', borderRadius: radius.full, backgroundColor: '#E9EEF3', paddingHorizontal: 11, paddingVertical: 4, marginBottom: 10 },
  catTagText: { fontSize: 11, fontWeight: font.medium },
  title: { fontSize: 19, fontWeight: font.semibold, color: colors.textPrimary, lineHeight: 26, marginBottom: 6 },
  desc: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: font.semibold, color: colors.textPrimary, marginBottom: 5 },
  sectionText: { fontSize: 13, color: colors.textSecondary, lineHeight: 21 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  infoTag: { backgroundColor: '#EFF2F5', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  infoTagText: { fontSize: 11, color: colors.textSecondary, fontWeight: font.medium },
  devSection: {
    marginTop: 16, padding: 12, borderRadius: radius.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: '#E0A800', backgroundColor: '#FFF9E8',
  },
  devSectionTitle: { fontSize: 11, fontWeight: font.semibold, color: '#8A6300', marginBottom: 4 },
  devSectionText: { fontSize: 12, color: '#6B4E00', lineHeight: 19 },
  linkBtn: {
    marginHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: colors.bgSecondary, borderRadius: radius.lg,
    paddingVertical: 14, borderWidth: 0.5, borderColor: colors.border,
  },
  linkBtnText: { fontSize: 14, fontWeight: font.semibold, color: colors.primary },
  welnetBtn: {
    marginHorizontal: spacing.lg, marginTop: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#E6F1FB', borderRadius: radius.lg,
    paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 0.5, borderColor: '#B5D4F4',
  },
  welnetBtnTextWrap: { flex: 1 },
  welnetBtnTitle: { fontSize: 13, fontWeight: font.semibold, color: '#185FA5' },
  welnetBtnSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  externalLinkBtn: {
    marginHorizontal: spacing.lg, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: '#F3E5F5', borderRadius: radius.lg,
    paddingVertical: 14, borderWidth: 0.5, borderColor: '#CE93D8',
  },
  externalLinkBtnText: { fontSize: 14, fontWeight: font.semibold, color: '#6A1B9A' },
});
