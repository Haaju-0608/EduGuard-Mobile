import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { LecturerTabParamList } from './types';
import { COLORS } from '../constants/theme';

import AttendanceScreen from '../screens/lecturer/AttendanceScreen';
import LecturerScheduleScreen from '../screens/lecturer/LecturerScheduleScreen';
import NotificationsScreen from '../screens/student/NotificationsScreen';
import ProfileScreen from '../screens/student/ProfileScreen';

const Tab = createBottomTabNavigator<LecturerTabParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<
  keyof LecturerTabParamList,
  { active: IoniconName; inactive: IoniconName }
> = {
  Attendance:    { active: 'checkmark-circle',  inactive: 'checkmark-circle-outline'  },
  Schedule:      { active: 'calendar',          inactive: 'calendar-outline'          },
  Notifications: { active: 'notifications',     inactive: 'notifications-outline'     },
  Profile:       { active: 'person',            inactive: 'person-outline'            },
};

export function LecturerTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Attendance"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: s.tabBar,
        tabBarActiveTintColor: COLORS.cyan,
        tabBarInactiveTintColor: 'rgba(241,245,255,0.38)',
        tabBarLabelStyle: s.tabLabel,
        tabBarIcon: ({ focused, color, size }) => {
          const cfg = TAB_ICONS[route.name as keyof LecturerTabParamList];
          return (
            <Ionicons
              name={focused ? cfg.active : cfg.inactive}
              size={size ?? 22}
              color={color}
            />
          );
        },
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
      <Tab.Screen name="Attendance"    component={AttendanceScreen}        options={{ title: 'Attendance' }} />
      <Tab.Screen name="Schedule"      component={LecturerScheduleScreen}  options={{ title: 'Schedule'   }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen}     options={{ title: 'Alerts'     }} />
      <Tab.Screen name="Profile"       component={ProfileScreen}           options={{ title: 'Profile'    }} />
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
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
