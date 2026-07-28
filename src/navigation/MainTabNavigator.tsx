import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from './types';
import { COLORS } from '../constants/theme';
import { useAuth } from './AuthContext';
import { LecturerTabNavigator } from './LecturerTabNavigator';

import ScheduleScreen from '../screens/student/ScheduleScreen';
import NotificationsScreen from '../screens/student/NotificationsScreen';
import HistoryScreen from '../screens/student/HistoryScreen';
import ProfileScreen from '../screens/student/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<
  keyof MainTabParamList,
  { active: IoniconName; inactive: IoniconName }
> = {
  Schedule:      { active: 'calendar',       inactive: 'calendar-outline'       },
  Notifications: { active: 'notifications',  inactive: 'notifications-outline'  },
  History:       { active: 'time',           inactive: 'time-outline'           },
  Profile:       { active: 'person',         inactive: 'person-outline'         },
};

export function MainTabNavigator() {
  const { authState } = useAuth();

  if (authState.user?.role === 'lecturer') {
    return <LecturerTabNavigator />;
  }

  return (
    <Tab.Navigator
      initialRouteName="Schedule"
      screenOptions={({ route }) => ({
        headerShown: false,

        // ── Tab bar appearance ──
        tabBarStyle: s.tabBar,
        tabBarActiveTintColor: COLORS.cyan,
        tabBarInactiveTintColor: 'rgba(241,245,255,0.38)',
        tabBarLabelStyle: s.tabLabel,

        // ── Icons ──
        tabBarIcon: ({ focused, color, size }) => {
          const cfg = TAB_ICONS[route.name as keyof MainTabParamList];
          return (
            <Ionicons
              name={focused ? cfg.active : cfg.inactive}
              size={size ?? 22}
              color={color}
            />
          );
        },

        // Replace Pressable (which uses android_ripple with borderless:boolean
        // that triggers a Fabric String→Boolean ClassCastException on RN 0.81)
        // with TouchableOpacity which has no native boolean ripple props.
        tabBarButton: (props) => (
          <TouchableOpacity
            style={props.style as any}
            onPress={props.onPress ?? undefined}
            onLongPress={props.onLongPress ?? undefined}
            activeOpacity={0.7}
          >
            {props.children}
          </TouchableOpacity>
        ),

      })}
    >
      <Tab.Screen name="Schedule"      component={ScheduleScreen}      options={{ title: 'Schedule'      }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Alerts'        }} />
      <Tab.Screen name="History"       component={HistoryScreen}       options={{ title: 'History'       }} />
      <Tab.Screen name="Profile"       component={ProfileScreen}       options={{ title: 'Profile'       }} />
    </Tab.Navigator>
  );
}

const s = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.navyCard,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 62,
    paddingBottom: 10,
    paddingTop: 8,
    elevation: 0,          // remove Android shadow (use border instead)
    shadowOpacity: 0,      // remove iOS shadow
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
