import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { theme } from './src/theme';

import LoginScreen from './src/screens/LoginScreen';
import ChatsScreen from './src/screens/ChatsScreen';
import ChatRoomScreen from './src/screens/ChatRoomScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: theme.bgSoft },
  headerTintColor: theme.fg,
  headerTitleStyle: { fontWeight: '600' },
  contentStyle: { backgroundColor: theme.bg },
};

function ChatsStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ChatsList"
        component={ChatsScreen}
        options={{ title: 'Chats' }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={({ route }) => ({
          title: route.params.name,
          headerBackTitle: 'Back',
        })}
      />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: theme.bgSoft,
          borderTopColor: theme.cardBorder,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="ChatsTab"
        component={ChatsStack}
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 4 }}>💬</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerShown: true,
          headerStyle: { backgroundColor: theme.bgSoft },
          headerTintColor: theme.fg,
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 4 }}>⚙️</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabs /> : <LoginScreen />}
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
