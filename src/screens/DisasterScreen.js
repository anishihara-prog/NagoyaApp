import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../theme';
import { DISTRICTS, RISK_COLORS } from '../data/districts';

const openURL = async (url) => {
  const supported = await Linking.canOpenURL(url);
  if (supported) await Linking.openURL(url);
  else Alert.alert('エラー', 'URLを開けませんでした');
};

export default function DisasterScreen({ navigation, route }) {
  const { districtKey, profile } = route.params;
  const district = DISTRICTS[districtKey];

  const hasElderlyOrDisabled = profile.elderlyMembers?.length > 0 || profile.disabledMembers?.length > 0 || profile.children?.some(a => a <= 5);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{district.name}の防災情報</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* 区リスクバナー */}
        <View style={styles.riskBanner}>
          <View style={styles.riskBannerHeader}>
            <Ionicons name="warning" size={16} color="#B71C1C" />
            <Text style={styles.riskBannerTitle}>{district.name}の主な災害リスク</Text>
          </View>
          <View style={styles.riskTags}>
            {district.risks.map(risk => {
              const c = RISK_COLORS[risk] || { bg: '#F5F5F5', text: '#333' };
              return (
                <View key={risk} style={[styles.riskTag, { backgroundColor: c.bg }]}>
                  <Text style={[styles.riskTagText, { color: c.text }]}>{risk}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.riskNote}>{district.riskNote}</Text>
        </View>

        {/* 要配慮者向け注意 */}
        {hasElderlyOrDisabled && (
          <View style={styles.careCard}>
            <View style={styles.careCardHeader}>
              <Ionicons name="heart" size={15} color="#7B4EA0" />
              <Text style={styles.careCardTitle}>要配慮者の方がいる世帯への注意</Text>
            </View>
            <Text style={styles.careCardText}>
              高齢者・障害者・乳幼児がいる場合は「避難行動要支援者名簿」への登録を検討してください。災害時に地域や行政からの支援を受けやすくなります。
            </Text>
            <TouchableOpacity style={styles.careCardBtn} onPress={() => openURL('https://www.city.nagoya.jp/bousaiportal/hinan/1013390/index.html')} activeOpacity={0.8}>
              <Text style={styles.careCardBtnText}>避難行動要支援者制度について →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 緊急時の行動 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ 緊急時の行動</Text>
          <TouchableOpacity style={styles.emergencyBtn} onPress={() => openURL('https://www.city.nagoya.jp/bousaiportal/hinan/1013390/1013492.html')} activeOpacity={0.8}>
            <View style={styles.emergencyBtnLeft}>
              <Ionicons name="location" size={20} color="#B71C1C" />
              <View>
                <Text style={styles.emergencyBtnTitle}>指定避難所マップ（{district.name}）</Text>
                <Text style={styles.emergencyBtnSub}>自宅近くの避難所を今すぐ確認</Text>
              </View>
            </View>
            <Ionicons name="open-outline" size={16} color="#B71C1C" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.emergencyBtn} onPress={() => openURL(district.hazardmapUrl)} activeOpacity={0.8}>
            <View style={styles.emergencyBtnLeft}>
              <Ionicons name="map" size={20} color="#1565C0" />
              <View>
                <Text style={[styles.emergencyBtnTitle, { color: '#1565C0' }]}>ハザードマップ（{district.name}）</Text>
                <Text style={styles.emergencyBtnSub}>洪水・地震・高潮等の浸水リスクを確認</Text>
              </View>
            </View>
            <Ionicons name="open-outline" size={16} color="#1565C0" />
          </TouchableOpacity>
        </View>

        {/* 防災アプリ・ツール */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📱 防災アプリ・ツール</Text>

          <View style={styles.appCard}>
            <View style={styles.appCardHeader}>
              <View style={styles.appIcon}>
                <Ionicons name="phone-portrait" size={20} color={colors.primary} />
              </View>
              <View style={styles.appCardText}>
                <Text style={styles.appCardTitle}>名古屋市防災アプリ</Text>
                <Text style={styles.appCardSub}>ハザードマップ・避難所・マイタイムライン作成</Text>
              </View>
            </View>
            <Text style={styles.appCardDesc}>
              スマートフォンで自宅・職場の災害リスクを確認できます。避難先・家族との集合場所などを登録した「マイ・タイムライン（個人避難計画）」も作成可能。防災クイズや動画で学習もできます。
            </Text>
            <View style={styles.appBtnRow}>
              <TouchableOpacity style={styles.appBtn} onPress={() => openURL('https://apps.apple.com/jp/app/%E5%90%8D%E5%8F%A4%E5%B1%8B%E5%B8%82%E9%98%B2%E7%81%BD%E3%82%A2%E3%83%97%E3%83%AA/id1670812304')} activeOpacity={0.8}>
                <Ionicons name="logo-apple" size={14} color={colors.primary} />
                <Text style={styles.appBtnText}>App Store</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.appBtn} onPress={() => openURL('https://play.google.com/store/apps/details?id=jp.co.fujitsu.nagoyabousai')} activeOpacity={0.8}>
                <Ionicons name="logo-google-playstore" size={14} color={colors.primary} />
                <Text style={styles.appBtnText}>Google Play</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.toolCard} onPress={() => openURL('https://www.city.nagoya.jp/bousaikikikanri/page/0000171223.html')} activeOpacity={0.8}>
            <View style={styles.toolCardLeft}>
              <Ionicons name="mail" size={18} color="#1565C0" />
              <View>
                <Text style={styles.toolCardTitle}>なごやメール配信サービス</Text>
                <Text style={styles.toolCardSub}>避難情報・気象警報をメールで受信</Text>
              </View>
            </View>
            <Ionicons name="open-outline" size={14} color="#1565C0" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolCard} onPress={() => openURL('https://www.city.nagoya.jp/bousaiportal/hazardmap/1036428.html')} activeOpacity={0.8}>
            <View style={styles.toolCardLeft}>
              <Ionicons name="globe" size={18} color="#1565C0" />
              <View>
                <Text style={styles.toolCardTitle}>なごやハザードマップ（Web版）</Text>
                <Text style={styles.toolCardSub}>PCでも確認できるオンラインマップ</Text>
              </View>
            </View>
            <Ionicons name="open-outline" size={14} color="#1565C0" />
          </TouchableOpacity>
        </View>

        {/* 平常時の備え */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏠 平常時の備え</Text>
          <View style={styles.prepCard}>
            {[
              { icon: 'water', title: '飲料水・食料の備蓄', desc: '1人3日分（できれば1週間分）の水・食料を備蓄。ローリングストックで鮮度維持。' },
              { icon: 'medical', title: '非常持ち出し袋の準備', desc: '通帳・保険証コピー・薬・スマホ充電器・現金・懐中電灯・レインウェアなど。' },
              { icon: 'people', title: '家族の避難計画を作成', desc: '避難場所・集合場所・連絡方法を家族で確認。名古屋市防災アプリでマイタイムライン作成を。' },
              { icon: 'home', title: '家具の転倒防止', desc: '地震時の家具転倒による怪我を防ぐため、家具を壁に固定。就寝場所近くの家具から対策を。' },
            ].map((item, i) => (
              <View key={i} style={styles.prepItem}>
                <View style={styles.prepItemIcon}>
                  <Ionicons name={item.icon + '-outline'} size={16} color={colors.primary} />
                </View>
                <View style={styles.prepItemText}>
                  <Text style={styles.prepItemTitle}>{item.title}</Text>
                  <Text style={styles.prepItemDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 区役所連絡先 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏢 {district.name}役所</Text>
          <TouchableOpacity style={styles.officeCard} onPress={() => Linking.openURL('tel:' + district.officePhone)} activeOpacity={0.8}>
            <Ionicons name="call" size={18} color={colors.primary} />
            <View style={styles.officeCardText}>
              <Text style={styles.officeCardTitle}>{district.name}役所（代表）</Text>
              <Text style={styles.officeCardPhone}>{district.officePhone}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkCard} onPress={() => openURL(district.disasterPageUrl)} activeOpacity={0.8}>
            <Ionicons name="globe-outline" size={16} color={colors.primary} />
            <Text style={styles.linkCardText}>{district.name}のくらし情報（公式サイト）</Text>
            <Ionicons name="open-outline" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

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
  riskBanner: { margin: spacing.lg, marginBottom: 0, backgroundColor: '#FFFAFA', borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: '#FFCDD2' },
  riskBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  riskBannerTitle: { fontSize: 13, fontWeight: font.semibold, color: '#B71C1C' },
  riskTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  riskTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  riskTagText: { fontSize: 12, fontWeight: font.medium },
  riskNote: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  careCard: { margin: spacing.lg, marginBottom: 0, backgroundColor: '#F3EAFA', borderRadius: radius.lg, padding: 14, borderLeftWidth: 3, borderLeftColor: '#7B4EA0' },
  careCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  careCardTitle: { fontSize: 13, fontWeight: font.semibold, color: '#7B4EA0' },
  careCardText: { fontSize: 12, color: '#4A2D6B', lineHeight: 19, marginBottom: 8 },
  careCardBtn: { alignSelf: 'flex-start' },
  careCardBtnText: { fontSize: 12, color: '#7B4EA0', fontWeight: font.medium },
  section: { padding: spacing.lg, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 14, fontWeight: font.semibold, color: colors.textPrimary, marginBottom: 12 },
  emergencyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: colors.border },
  emergencyBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  emergencyBtnTitle: { fontSize: 13, fontWeight: font.semibold, color: '#B71C1C', marginBottom: 2 },
  emergencyBtnSub: { fontSize: 11, color: colors.textSecondary },
  appCard: { backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: 14, marginBottom: 8 },
  appCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  appIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  appCardText: { flex: 1 },
  appCardTitle: { fontSize: 13, fontWeight: font.semibold, color: colors.textPrimary, marginBottom: 2 },
  appCardSub: { fontSize: 11, color: colors.textSecondary },
  appCardDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 10 },
  appBtnRow: { flexDirection: 'row', gap: 8 },
  appBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primaryBg, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, borderColor: colors.primaryLight },
  appBtnText: { fontSize: 12, fontWeight: font.medium, color: colors.primary },
  toolCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: 13, marginBottom: 8, borderWidth: 0.5, borderColor: colors.border },
  toolCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  toolCardTitle: { fontSize: 13, fontWeight: font.medium, color: colors.textPrimary, marginBottom: 2 },
  toolCardSub: { fontSize: 11, color: colors.textSecondary },
  prepCard: { backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: 14 },
  prepItem: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  prepItemIcon: { width: 30, height: 30, borderRadius: radius.md, backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  prepItemText: { flex: 1 },
  prepItemTitle: { fontSize: 13, fontWeight: font.semibold, color: colors.textPrimary, marginBottom: 3 },
  prepItemDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  officeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primaryBg, borderRadius: radius.lg, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: colors.primaryLight },
  officeCardText: { flex: 1 },
  officeCardTitle: { fontSize: 13, fontWeight: font.medium, color: colors.textPrimary, marginBottom: 2 },
  officeCardPhone: { fontSize: 15, fontWeight: font.semibold, color: colors.primary },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: 13, borderWidth: 0.5, borderColor: colors.border },
  linkCardText: { flex: 1, fontSize: 13, color: colors.primary, fontWeight: font.medium },
});
