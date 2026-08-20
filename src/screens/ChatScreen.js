import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../theme';
import { SERVICES } from '../data/services';

const SERVICES_TEXT = SERVICES.map(
  (s) => `■${s.title}\n${s.detail}\nURL: ${s.url}`
).join('\n\n');

function buildProfileText(profile) {
  const p = [];
  if (profile.age) p.push(profile.age + '歳');
  const gm = { male: '男性', female: '女性', other: 'その他' };
  if (profile.gender && profile.gender !== 'none') p.push(gm[profile.gender]);
  const mm = { single: '独身', married: '既婚', div: 'ひとり親（離婚・別居）', widow: 'ひとり親（死別）' };
  if (profile.marital) p.push(mm[profile.marital]);
  if (profile.children?.length) p.push('子ども' + profile.children.length + '人（' + profile.children.join('・') + '歳）');
  if (profile.elderlyMembers?.length) {
    const elStr = profile.elderlyMembers.map(e => `${e.age}歳(${e.relation || '同居'})`).join('・');
    p.push('高齢者' + profile.elderlyMembers.length + '人（' + elStr + '）');
  }
  const dm = { disabled: '障害あり', gray: 'グレーゾーン', hikikomori: 'ひきこもり' };
  profile.disabledMembers?.forEach((v) => { if (dm[v]) p.push(dm[v]); });
  const sm = { pregnant: '妊娠中', unemployed: '求職中', lowincome: '低所得', nursing: '介護中' };
  profile.sit?.forEach((v) => { if (sm[v]) p.push(sm[v]); });
  return p.length ? p.join('、') : 'プロフィール未入力';
}

function stripMarkdown(text) {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .trim();
}

function buildSuggestChips(profile) {
  const chips = [];

  if (profile.children?.length > 0) {
    chips.push('子どもの医療費助成はある？');
    chips.push('子どもが不登校、相談先は？');
    chips.push('保育所の申請方法は？');
  }
  if (profile.sit?.includes('pregnant')) {
    chips.push('妊娠中に受けられるサービスは？');
    chips.push('出産後に必要な手続きは？');
  }
  if (profile.marital === 'div' || profile.marital === 'widow') {
    chips.push('ひとり親への支援はある？');
    chips.push('養育費の相談先は？');
  }
  if (profile.elderlyMembers?.length > 0) {
    chips.push('介護保険の申請方法は？');
    chips.push('認知症の相談はどこ？');
  }
  if (profile.sit?.includes('nursing')) {
    chips.push('介護中に使えるサービスは？');
  }
  if (profile.disabledMembers?.includes('hikikomori')) {
    chips.push('ひきこもりの相談先は？');
  }
  if (profile.disabledMembers?.includes('disabled') || profile.disabledMembers?.includes('gray')) {
    chips.push('障害福祉サービスの申請は？');
  }
  if (profile.sit?.includes('unemployed')) {
    chips.push('就労支援はどこに相談？');
  }
  if (profile.sit?.includes('lowincome')) {
    chips.push('生活費の支援はある？');
  }

  if (chips.length === 0) {
    chips.push('申請できるサービスを教えて');
    chips.push('名古屋市の相談窓口は？');
    chips.push('手続きに必要な書類は？');
  }

  return chips.slice(0, 5);
}

export default function ChatScreen({ navigation, route }) {
  const { profile } = route.params;
  const profileText = buildProfileText(profile);
  const suggestChips = buildSuggestChips(profile);

  const welcomeText =
    `こんにちは！名古屋市のサービスについて、何でもお気軽にご質問ください。\n\nプロフィール：${profileText}\n\nたとえばこんなことを聞けます👇`;

  const [messages, setMessages] = useState([
    { id: 1, role: 'bot', text: welcomeText, chips: suggestChips },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const chatHistory = useRef([
    { role: 'user', parts: [{ text: `私のプロフィール：${profileText}。名古屋市のサービスについて質問します。` }] },
    { role: 'model', parts: [{ text: `了解しました。${profileText}の方ですね。名古屋市のサービスについて何でもご質問ください。` }] },
  ]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { id: Date.now(), role: 'user', text: msg };
    setMessages((prev) => [...prev, userMsg]);
    chatHistory.current.push({ role: 'user', parts: [{ text: msg }] });
    setLoading(true);

    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: `あなたは名古屋市の行政サービスに詳しいアシスタントです。ユーザープロフィール：${profileText}。\n\n以下は名古屋市の公式サービス一覧（最新情報）です。この情報をもとに、具体的なサービス名・申請先・必要書類・公式URLを含めて日本語で簡潔に回答してください。箇条書きを適宜使い、見やすく整理してください。\n\n${SERVICES_TEXT}` }],
            },
            contents: chatHistory.current,
            generationConfig: { maxOutputTokens: 1000 },
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error?.message ?? `APIエラー (${res.status})`;
        throw new Error(errMsg);
      }
      const reply = stripMarkdown(data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'エラーが発生しました。');
      chatHistory.current.push({ role: 'model', parts: [{ text: reply }] });
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'bot', text: reply }]);
    } catch (e) {
      const errText = e.message ? `エラー: ${e.message}` : '通信エラーが発生しました。インターネット接続を確認してください。';
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'bot', text: errText }]);
    } finally {
      setLoading(false);
    }
  };

  const now = () => new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>名古屋市サービス相談</Text>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={true}
        >
          {messages.map((msg) => (
            <View key={msg.id} style={[styles.msgWrap, msg.role === 'user' ? styles.msgWrapUser : styles.msgWrapBot]}>
              <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
                <Text style={[styles.bubbleText, msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextBot]}>
                  {msg.text}
                </Text>
              </View>
              <Text style={[styles.ts, msg.role === 'user' && styles.tsRight]}>{now()}</Text>
              {msg.chips?.length > 0 && (
                <View style={styles.chips}>
                  {msg.chips.map((chip) => (
                    <TouchableOpacity key={chip} style={styles.chip} onPress={() => sendMessage(chip)} activeOpacity={0.7}>
                      <Text style={styles.chipText}>{chip}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
          {loading && (
            <View style={[styles.msgWrap, styles.msgWrapBot]}>
              <View style={[styles.bubble, styles.bubbleBot]}>
                <ActivityIndicator size="small" color={colors.textTertiary} />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="何でも質問してください..."
            placeholderTextColor={colors.textTertiary}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary, overflow: 'hidden' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.md, gap: 8 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: font.semibold, color: colors.textPrimary },
  aiBadge: { backgroundColor: colors.primaryBg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  aiBadgeText: { fontSize: 11, fontWeight: font.semibold, color: colors.primary },
  messages: { flex: 1 },
  messagesContent: { padding: spacing.lg, gap: 12 },
  msgWrap: { maxWidth: '88%' },
  msgWrapBot: { alignSelf: 'flex-start' },
  msgWrapUser: { alignSelf: 'flex-end' },
  bubble: { borderRadius: 16, padding: 11 },
  bubbleBot: { backgroundColor: colors.bgSecondary, borderBottomLeftRadius: 3 },
  bubbleUser: { backgroundColor: colors.primaryBg, borderBottomRightRadius: 3 },
  bubbleText: { fontSize: 13, lineHeight: 20 },
  bubbleTextBot: { color: colors.textPrimary },
  bubbleTextUser: { color: colors.primary },
  ts: { fontSize: 10, color: colors.textTertiary, marginTop: 3, paddingHorizontal: 3 },
  tsRight: { textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { borderWidth: 0.5, borderColor: colors.accent, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 12, color: colors.primary },
  inputArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: spacing.md, paddingHorizontal: spacing.lg, borderTopWidth: 0.5, borderTopColor: colors.border },
  input: { flex: 1, borderWidth: 0.5, borderColor: colors.borderMed, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: colors.textPrimary, maxHeight: 100, backgroundColor: colors.bgPrimary },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryMid, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: colors.bgTertiary },
});
