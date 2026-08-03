import type { StackScreenProps } from '@react-navigation/stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// Used only inside the authenticated MainStack (Tabs + FaceReRegistration)
export type MainStackParamList = {
  Tabs: undefined;
  FaceReRegistration: undefined;
};

// Student bottom tabs
export type MainTabParamList = {
  Schedule: undefined;
  Notifications: undefined;
  History: undefined;
  Profile: undefined;
};

// Lecturer bottom tabs
export type LecturerTabParamList = {
  Attendance: undefined;
  Schedule:   undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type MainStackScreenProps<T extends keyof MainStackParamList> =
  StackScreenProps<MainStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  BottomTabScreenProps<MainTabParamList, T>;

export type LecturerTabScreenProps<T extends keyof LecturerTabParamList> =
  BottomTabScreenProps<LecturerTabParamList, T>;
