import type { StackScreenProps } from '@react-navigation/stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// Used only inside the authenticated MainStack (Tabs + FaceReRegistration)
export type MainStackParamList = {
  Tabs: undefined;
  FaceReRegistration: undefined;
};

export type MainTabParamList = {
  Schedule: undefined;
  Notifications: undefined;
  History: undefined;
  Profile: undefined;
};

export type MainStackScreenProps<T extends keyof MainStackParamList> =
  StackScreenProps<MainStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  BottomTabScreenProps<MainTabParamList, T>;
