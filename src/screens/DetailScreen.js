import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../theme';
import { CAT_LABELS, CAT_COLORS } from '../data/services';

export default function DetailScreen({ navigation, route }) {
  const { svc } = route.params;
  const catColor = CAT_COLORS[svc.cat] || { bg: colors.bgSecondary, text: colors.textSecondary };

  const openURL = async (url) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('エラー', 'URLを開けませんでした');
    }
  };

  const detailLines = svc.detail.split('\n');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>サービス詳細</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.tagRow}>
            <View style={[styles.catTag, { backgroundColor: catColor.bg }]}>
              <Text style={[styles.catTagText, { color: catColor.text }]}>{CAT_LABELS[svc.cat]}</Text>
            </View>
            {svc.grayzone && (
              <View style={styles.grayBadge}>
                <Ionicons name="information-circle-outline" size={13} color="#7B4EA0" />
                <Text style={styles.grayBadgeText}>手帳・診断なしでも相談OK</Text>
              </View>
            )}
            {svc.welnet && (
              <View style={styles.welnetBadge}>
                <Ionicons name="search-outline" size={12} color="#185FA5" />
                <Text style={styles.welnetBadgeText}>ウェルネット対応</Text>
              </View>
            )}
          </View>

          {svc.urgent && (
            <View style={styles.urgentBadge}>
              <Ionicons name="alert-circle" size={13} color={colors.accent} />
              <Text style={styles.urgentText}>早めに申請推奨</Text>
            </View>
          )}
          <Text style={styles.title}>{svc.title}</Text>
          <Text style={styles.desc}>{svc.desc}</Text>
        </View>

        {/* グレーゾーン向け説明 */}
        {svc.grayzone && (
          <View style={styles.grayCard}>
            <View style={styles.grayCardHeader}>
              <Ionicons name="heart-outline" size={16} color="#7B4EA0" />
              <Text style={styles.grayCardTitle}>診断がなくても大丈夫です</Text>
            </View>
            <Text style={styles.grayCardText}>
              「もしかしたら…」と感じている段階でも相談できます。まずは窓口に連絡してみてください。支援者があなたの状況を一緒に整理し、必要なサービスにつないでくれます。
            </Text>
          </View>
        )}

        <View style={styles.detailCard}>
          <Text style={styles.detailHeading}>詳細情報</Text>
          {detailLines.map((line, i) => {
            if (!line.trim()) return null;
            const isBold = line.startsWith('【');
            return (
              <Text key={i} style={[styles.detailLine, isBold && styles.detailBold]}>
                {line}
              </Text>
            );
          })}
        </View>

        <View style={styles.contactCard}>
          <View style={styles.contactRow}>
            <Ionicons name="business-outline" size={16} color={colors.primary} />
            <Text style={styles.contactLabel}>申請・問合せ先</Text>
          </View>
          <Text style={styles.contactValue}>{svc.contact}</Text>
        </View>

        {/* ウェルネット名古屋ボタン */}
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

        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => openURL(svc.url)}
          activeOpacity={0.8}
        >
          <Ionicons name="globe-outline" size={16} color={colors.primary} />
          <Text style={styles.linkBtnText}>名古屋市公式サイトで確認する</Text>
          <Ionicons name="open-outline" size={14} color={colors.primary} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.md, gap: 8 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: font.semibold, color: colors.textPrimary },
  scroll: { flex: 1 },
  hero: { padding: spacing.lg, paddingBottom: spacing.md },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  catTag: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 11, paddingVertical: 4 },
  catTagText: { fontSize: 11, fontWeight: font.medium },
  grayBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3EAFA', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  grayBadgeText: { fontSize: 11, fontWeight: font.medium, color: '#7B4EA0' },
  welnetBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primaryBg, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  welnetBadgeText: { fontSize: 11, fontWeight: font.medium, color: '#185FA5' },
  urgentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  urgentText: { fontSize: 12, color: colors.accent, fontWeight: font.medium },
  title: { fontSize: 20, fontWeight: font.semibold, color: colors.textPrimary, lineHeight: 28, marginBottom: 8 },
  desc: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  grayCard: {
    margin: spacing.lg, marginTop: 4, marginBottom: 0,
    backgroundColor: '#F3EAFA', borderRadius: radius.lg, padding: 14,
    borderLeftWidth: 3, borderLeftColor: '#7B4EA0',
  },
  grayCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  grayCardTitle: { fontSize: 13, fontWeight: font.semibold, color: '#7B4EA0' },
  grayCardText: { fontSize: 12, color: '#4A2D6B', lineHeight: 20 },
  detailCard: {
    margin: spacing.lg, marginTop: spacing.md,
    backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: 16,
  },
  detailHeading: { fontSize: 12, fontWeight: font.semibold, color: colors.textTertiary, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 },
  detailLine: { fontSize: 13, color: colors.textSecondary, lineHeight: 22, marginBottom: 2 },
  detailBold: { fontWeight: font.semibold, color: colors.textPrimary, marginTop: 6 },
  contactCard: {
    marginHorizontal: spacing.lg, marginBottom: 12,
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 14,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  contactLabel: { fontSize: 12, fontWeight: font.semibold, color: colors.primary },
  contactValue: { fontSize: 14, color: colors.textPrimary, fontWeight: font.medium },
  welnetBtn: {
    marginHorizontal: spacing.lg, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#E6F1FB', borderRadius: radius.lg,
    paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 0.5, borderColor: '#B5D4F4',
  },
  welnetBtnTextWrap: { flex: 1 },
  welnetBtnTitle: { fontSize: 13, fontWeight: font.semibold, color: '#185FA5' },
  welnetBtnSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  linkBtn: {
    marginHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: colors.bgSecondary, borderRadius: radius.lg,
    paddingVertical: 14, borderWidth: 0.5, borderColor: colors.border,
  },
  linkBtnText: { fontSize: 14, fontWeight: font.semibold, color: colors.primary },
});
