import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ServicesProvider } from './src/context/ServicesContext';
import ChatScreen from './src/screens/ChatScreen';
import DetailScreen from './src/screens/DetailScreen';
import DisasterScreen from './src/screens/DisasterScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ResultsScreen from './src/screens/ResultsScreen';

const Stack = createStackNavigator();

export default function App() {

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
