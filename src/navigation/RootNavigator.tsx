import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { MainStackParamList } from './types';
import { COLORS } from '../constants/theme';

import FaceReRegistrationScreen from '../screens/student/FaceReRegistrationScreen';
import { MainTabNavigator } from './MainTabNavigator';

const Stack = createStackNavigator<MainStackParamList>();

// Mounted only when the user is fully authenticated (isLoggedIn && hasRegisteredFace).
// Uses the pure-JS @react-navigation/stack — no react-native-screens / Fabric bridge involved.
export function MainStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.navy },
      }}
    >
      <Stack.Screen name="Tabs" component={MainTabNavigator} />
      <Stack.Screen name="FaceReRegistration" component={FaceReRegistrationScreen} />
    </Stack.Navigator>
  );
}
