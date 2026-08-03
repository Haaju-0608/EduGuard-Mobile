import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../../constants/theme';

type CardAccent = 'blue' | 'cyan' | 'green' | 'gold' | 'red' | 'none';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  accent?: CardAccent;
  padding?: number;
}

const ACCENT_COLORS: Record<CardAccent, string> = {
  blue:  '#2563EB',
  cyan:  '#06B6D4',
  green: '#10B981',
  gold:  '#F59E0B',
  red:   '#EF4444',
  none:  'transparent',
};

export function Card({ children, accent = 'none', padding = 16, style, ...props }: CardProps) {
  return (
    <View style={[styles.card, { padding }, style]} {...props}>
      {accent !== 'none' && (
        <View style={[styles.accentBar, { backgroundColor: ACCENT_COLORS[accent] }]} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    opacity: 0.9,
  },
});
