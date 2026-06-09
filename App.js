import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';

import ProfileScreen from './src/screens/ProfileScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import DetailScreen from './src/screens/DetailScreen';
import ChatScreen from './src/screens/ChatScreen';
import DisasterScreen from './src/screens/DisasterScreen';
import { ServicesProvider } from './src/context/ServicesContext';

const Stack = createStackNavigator();

export default function App() {
  useEffect(() => {
    if (!__DEV__) {
      Updates.checkForUpdateAsync().then(({ isAvailable }) => {
        if (isAvailable) {
          Updates.fetchUpdateAsync().then(() => {
            Alert.alert(
              'アップデート完了',
              '新しいバージョンを読み込みます。',
              [{ text: 'OK', onPress: () => Updates.reloadAsync() }]
            );
          });
        }
      });
    }
  }, []);

  return (
    <ServicesProvider>
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#FFFFFF' },
            gestureEnabled: true,
          }}
        >
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Results" component={ResultsScreen} />
          <Stack.Screen name="Detail" component={DetailScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Disaster" component={DisasterScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
    </ServicesProvider>
  );
}
