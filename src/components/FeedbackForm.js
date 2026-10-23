import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '../theme';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxlXW4-wr3yQBRpleas3YjfR5GzNfDhQ8krP5ldhzE6EXPOMdkFtPypOyWNGJZevx-l/exec';
const USABILITY_OPTIONS = ['とても使いやすい', '使いやすい', '普通', 'やや使いにくい', '使いにくい'];
const ALLOWED_APP_NAMES = ['NagoyaApp', 'nagoya-fukushi-navi'];

function resolveAppName(defaultAppName) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return defaultAppName;

  const requestedAppName = new URLSearchParams(window.location.search).get('appName');
  if (!requestedAppName) return defaultAppName;
  return ALLOWED_APP_NAMES.includes(requestedAppName) ? requestedAppName : '';
}

export default function FeedbackForm({ appName: defaultAppName }) {
  const [appName] = useState(() => resolveAppName(defaultAppName));
  const [visible, setVisible] = useState(false);
  const [usability, setUsability] = useState('');
  const [comments, setComments] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);

  const close = () => {
    if (submitting) return;
    setVisible(false);
    setNotice('');
  };

  const submit = async () => {
    const normalizedEmail = email.trim();
    if (!appName) {
      setNotice('アプリを判別できません。URLのappNameをご確認ください。');
      setNoticeIsError(true);
      return;
    }
    if (!usability || !comments.trim()) {
      setNotice('使いやすさとご感想をご入力ください。');
      setNoticeIsError(true);
      return;
    }
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setNotice('返信用メールアドレスの形式をご確認ください。');
      setNoticeIsError(true);
      return;
    }

    setSubmitting(true);
    setNotice('');
    setNoticeIsError(false);
    try {
      const body = JSON.stringify({
        appName,
        rating: usability,
        comment: comments.trim(),
        email: normalizedEmail,
        name: name.trim(),
        age,
      });
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': Platform.OS === 'web' ? 'text/plain;charset=UTF-8' : 'application/json',
        },
        body,
        ...(Platform.OS === 'web' ? { mode: 'no-cors' } : {}),
      });

      if (response.type !== 'opaque' && !response.ok) {
        throw new Error(`Feedback request failed with status ${response.status}`);
      }

      setComments('');
      setEmail('');
      setName('');
      setAge('');
      setUsability('');
      setNotice('ご意見ありがとうございました。送信しました。');
    } catch (error) {
      console.error('Feedback submission failed:', error);
      setNotice('送信できませんでした。通信環境を確認して、もう一度お試しください。');
      setNoticeIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.openButton}
        onPress={() => {
          setNotice('');
          setVisible(true);
        }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="フィードバックを送る"
      >
        <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
        <Text style={styles.openButtonText}>フィードバックを送る</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>フィードバック</Text>
              <TouchableOpacity onPress={close} disabled={submitting} accessibilityLabel="閉じる">
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>使いやすさ <Text style={styles.required}>必須</Text></Text>
              <View style={styles.options}>
                {USABILITY_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.option, usability === option && styles.optionSelected]}
                    onPress={() => setUsability(option)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: usability === option }}
                  >
                    <Text style={[styles.optionText, usability === option && styles.optionTextSelected]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>ご感想・改善点 <Text style={styles.required}>必須</Text></Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={comments}
                onChangeText={setComments}
                placeholder="使ってみた感想や改善してほしい点をお聞かせください"
                placeholderTextColor={colors.textTertiary}
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />

              <Text style={styles.label}>お名前 <Text style={styles.optional}>任意</Text></Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="例：名古屋 太郎"
                placeholderTextColor={colors.textTertiary}
                autoComplete="name"
                maxLength={50}
              />

              <Text style={styles.label}>年齢 <Text style={styles.optional}>任意</Text></Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={text => setAge(text.replace(/[^0-9]/g, ''))}
                placeholder="例：35"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                maxLength={3}
              />

              <Text style={styles.label}>返信用メールアドレス <Text style={styles.optional}>任意</Text></Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                maxLength={254}
              />
              <Text style={styles.privacyNote}>
                ご入力内容はフィードバックの確認・返信のためにスプレッドシートへ送信されます。
              </Text>

              {!!notice && (
                <Text style={[styles.notice, noticeIsError && styles.errorNotice]} accessibilityRole="alert">
                  {notice}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={submit}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.submitButtonText}>送信する</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  openButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  openButtonText: { color: colors.primary, fontSize: 13, fontWeight: font.medium },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: font.semibold },
  label: { color: colors.textPrimary, fontSize: 13, fontWeight: font.medium, marginTop: spacing.md, marginBottom: spacing.sm },
  required: { color: colors.danger, fontSize: 11 },
  optional: { color: colors.textTertiary, fontSize: 11 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: {
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.primaryBg },
  optionText: { color: colors.textSecondary, fontSize: 12 },
  optionTextSelected: { color: colors.primary, fontWeight: font.medium },
  input: {
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  multiline: { minHeight: 110 },
  privacyNote: { color: colors.textTertiary, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
  notice: { color: colors.success, fontSize: 12, lineHeight: 18, marginTop: spacing.md },
  errorNotice: { color: colors.danger },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: font.semibold },
});
