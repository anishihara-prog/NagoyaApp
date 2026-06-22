import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../theme';

const SUGGEST_CHIPS = ['申請方法・窓口は？', '必要書類を教えて', '締切・申請期限は？', '所得制限の詳細は？'];

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

export default function ChatScreen({ navigation, route }) {
  const { profile } = route.params;
  const profileText = buildProfileText(profile);
  const [messages, setMessages] = useState([
    {
      id: 1, role: 'bot',
      text: `こんにちは！名古屋市のサービスについてお気軽にご質問ください。\n\nあなたのプロフィール：${profileText}\n\nこの情報をもとに、申請窓口や必要書類なども具体的にご案内します。`,
      showChips: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const chatHistory = useRef([
    { role: 'user', content: `私のプロフィール：${profileText}。名古屋市のサービスについて質問します。名古屋市公式サイト（https://www.city.nagoya.jp）の情報をもとに、具体的なサービス名・申請先・必要書類・URLを含めて日本語で簡潔に答えてください。` },
    { role: 'assistant', content: `了解しました。${profileText}の方ですね。名古屋市のサービスについて何でもご質問ください。` },
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
    chatHistory.current.push({ role: 'user', content: msg });
    setLoading(true);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `あなたは名古屋市の行政サービスに詳しいアシスタントです。ユーザープロフィール：${profileText}。名古屋市公式サイト(https://www.city.nagoya.jp)のサービスを踏まえ、具体的なサービス名・申請先の区役所窓口・必要書類・公式URLを含めて、日本語で簡潔に回答してください。箇条書きを適宜使い、見やすく整理してください。`,
          messages: chatHistory.current,
        }),
      });
      const data = await res.json();
      const reply = data.content?.map((b) => (b.type === 'text' ? b.text : '')).join('') || 'エラーが発生しました。';
      chatHistory.current.push({ role: 'assistant', content: reply });
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'bot', text: reply, showChips: false }]);
    } catch (e) {
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'bot', text: '通信エラーが発生しました。インターネット接続を確認してください。', showChips: false }]);
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
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View key={msg.id} style={[styles.msgWrap, msg.role === 'user' ? styles.msgWrapUser : styles.msgWrapBot]}>
              <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
                <Text style={[styles.bubbleText, msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextBot]}>
                  {msg.text}
                </Text>
              </View>
              <Text style={[styles.ts, msg.role === 'user' && styles.tsRight]}>{now()}</Text>
              {msg.showChips && (
                <View style={styles.chips}>
                  {SUGGEST_CHIPS.map((chip) => (
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
            placeholder="サービスについて質問してください..."
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
  safe: { flex: 1, backgroundColor: colors.bgPrimary },
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
