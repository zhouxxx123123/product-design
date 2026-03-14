import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import LoginScreen from '../screens/LoginScreen';
import SessionsScreen from '../screens/SessionsScreen';
import RecordingScreen from '../screens/RecordingScreen';

// ─── Param list types (exported so screens can import them) ───────────────────

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type SessionsStackParamList = {
  Sessions: undefined;
  Recording: { sessionId: string; title: string };
};

export type MainTabParamList = {
  SessionsTab: undefined;
};

// ─── Stack / Tab navigators ───────────────────────────────────────────────────

const RootStack = createNativeStackNavigator<RootStackParamList>();
const SessionsStack = createNativeStackNavigator<SessionsStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

const SessionsNavigator = (): React.JSX.Element => (
  <SessionsStack.Navigator>
    <SessionsStack.Screen
      name="Sessions"
      component={SessionsScreen}
      options={{ title: '会话列表' }}
    />
    <SessionsStack.Screen
      name="Recording"
      component={RecordingScreen}
      options={{ title: '录音工作台' }}
    />
  </SessionsStack.Navigator>
);

const MainTabs = (): React.JSX.Element => (
  <MainTab.Navigator
    screenOptions={{ headerShown: false }}>
    <MainTab.Screen
      name="SessionsTab"
      component={SessionsNavigator}
      options={{
        tabBarLabel: '会话',
        tabBarIcon: ({ color }: { color: string }) => (
          <Text style={{ fontSize: 18, color }}>🗂</Text>
        ),
      }}
    />
  </MainTab.Navigator>
);

// ─── Root navigator (auth-gated) ──────────────────────────────────────────────

const RootNavigator = (): React.JSX.Element => {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          <RootStack.Screen name="Login" component={LoginScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
