import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../../components/ui/AppText';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import AttendanceHistoryScreen from './AttendanceHistoryScreen';
import ViolationHistoryScreen from './ViolationHistoryScreen';

type Segment = 'attendance' | 'violations';

export default function HistoryScreen() {
  const [active, setActive] = useState<Segment>('attendance');

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.orb, s.orb1]} />
      <View style={[s.orb, s.orb2]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Page header ── */}
        <View style={s.header}>
          <View>
            <AppText variant="h2" style={{ color: COLORS.whiteSoft }}>History</AppText>
            <AppText variant="caption">Attendance & violation records</AppText>
          </View>
        </View>

        {/* ── Segmented control ── */}
        <View style={s.segmentOuter}>
          <View style={s.segmentContainer}>
            {(['attendance', 'violations'] as Segment[]).map((tab) => {
              const isActive = active === tab;
              const label = tab === 'attendance' ? 'Attendance' : 'Violations';

              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActive(tab)}
                  activeOpacity={0.8}
                  style={s.segmentBtn}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={[COLORS.blue, COLORS.cyan]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.md - 2 }]}
                    />
                  ) : null}
                  <AppText
                    style={[
                      s.segmentLabel,
                      { color: isActive ? COLORS.whiteSoft : 'rgba(241,245,255,0.40)' },
                    ]}
                  >
                    {label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Tab content ── */}
        {active === 'attendance' ? (
          <AttendanceHistoryScreen embedded />
        ) : (
          <ViolationHistoryScreen embedded />
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },

  orb: { position: 'absolute', borderRadius: RADIUS.full },
  orb1: { width: 260, height: 260, top: -60, right: -70, backgroundColor: 'rgba(37,99,235,0.08)' },
  orb2: { width: 180, height: 180, bottom: 120, left: -50, backgroundColor: 'rgba(6,182,212,0.06)' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },

  segmentOuter: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: RADIUS.md - 2,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
