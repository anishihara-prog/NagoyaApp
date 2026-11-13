import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '../theme';
import { GOOGLE_APPS_SCRIPT_URL } from '../config/appsScript';

const VISITOR_ID_KEY = '@nagoyaapp/visitor-id/v1';

async function getVisitorId() {
  let visitorId = await AsyncStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = Crypto.randomUUID();
    await AsyncStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
}

function getResponseUrl(appName, visitorId, callback) {
  const params = new URLSearchParams({ appName, visitorId });
  if (callback) params.set('callback', callback);
  return `${GOOGLE_APPS_SCRIPT_URL}?${params.toString()}`;
}

async function registerVisitor(appName, visitorId) {
  const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': Platform.OS === 'web' ? 'text/plain;charset=UTF-8' : 'application/json',
    },
    body: JSON.stringify({ action: 'registerVisit', appName, visitorId }),
    ...(Platform.OS === 'web' ? { mode: 'no-cors' } : {}),
  });

  if (response.type === 'opaque') return;
  if (!response.ok) {
    throw new Error(`Visitor registration failed with status ${response.status}`);
  }

  const result = await response.json();
  if (result.status !== 'success') {
    throw new Error(result.message || 'Visitor registration failed');
  }
}

function readVisitorStatsInBrowser(appName, visitorId) {
  return new Promise((resolve, reject) => {
    const callbackName = `visitorCountCallback_${Crypto.randomUUID().replace(/-/g, '')}`;
    const script = document.createElement('script');
    let timeoutId;

    const cleanup = () => {
      clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = result => {
      cleanup();
      resolve(result);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('Visitor count request failed'));
    };
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Visitor count request timed out'));
    }, 15000);
    script.src = getResponseUrl(appName, visitorId, callbackName);
    document.head.appendChild(script);
  });
}

async function getVisitorStats(appName, visitorId) {
  if (Platform.OS === 'web') {
    return readVisitorStatsInBrowser(appName, visitorId);
  }

  const response = await fetch(getResponseUrl(appName, visitorId));
  if (!response.ok) {
    throw new Error(`Visitor count request failed with status ${response.status}`);
  }
  return response.json();
}

function isValidVisitorStats(result) {
  return (
    result.status === 'success' &&
    typeof result.registered === 'boolean' &&
    Number.isSafeInteger(result.visitorCount) &&
    result.visitorCount >= 0
  );
}

export default function VisitorCount({ appName }) {
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadCount = useCallback(async () => {
    setLoading(true);
    setHasError(false);
    try {
      const visitorId = await getVisitorId();
      let result = await getVisitorStats(appName, visitorId);
      if (!isValidVisitorStats(result)) {
        throw new Error(result.message || 'Invalid visitor count response');
      }
      if (!result.registered) {
        await registerVisitor(appName, visitorId);
        result = await getVisitorStats(appName, visitorId);
      }
      if (!isValidVisitorStats(result) || !result.registered) {
        throw new Error(result.message || 'Visitor registration could not be verified');
      }
      setCount(result.visitorCount);
    } catch (error) {
      console.error('Visitor count loading failed:', error);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [appName]);

  useEffect(() => {
    loadCount();
  }, [loadCount]);

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <Ionicons name="people-outline" size={16} color={colors.primary} />
      {loading ? (
        <>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.label}>来場者数を読み込み中...</Text>
        </>
      ) : hasError ? (
        <>
          <Text style={styles.error}>来場者数を取得できませんでした</Text>
          <TouchableOpacity
            onPress={loadCount}
            accessibilityRole="button"
            accessibilityLabel="来場者数を再読み込み"
          >
            <Text style={styles.retry}>再試行</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.label}>来場者数</Text>
          <Text style={styles.count}>{count.toLocaleString()}人</Text>
          <Text style={styles.note}>端末・ブラウザごとに1回集計</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignSelf: 'flex-end',
    width: '50%',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.primaryBg,
    borderRadius: radius.md,
  },
  label: { fontSize: 13, color: colors.textSecondary },
  count: { fontSize: 16, color: colors.primary, fontWeight: font.semibold },
  note: { width: '100%', paddingLeft: 24, fontSize: 11, color: colors.textTertiary },
  error: { flex: 1, fontSize: 12, color: colors.danger },
  retry: { fontSize: 12, color: colors.primary, fontWeight: font.medium },
});
