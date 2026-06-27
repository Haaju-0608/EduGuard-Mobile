import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import { useAuth } from '../../navigation/AuthContext';
import type { MainStackParamList } from '../../navigation/types';

type RootNav = StackNavigationProp<MainStackParamList>;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <AppText variant="label" style={s.infoLabel}>
        {label}
      </AppText>
      <AppText variant="semi" color={COLORS.whiteSoft} style={s.infoValue}>
        {value}
      </AppText>
    </View>
  );
}

export default function ProfileScreen() {
  const { authState, logout } = useAuth();
  const rootNav = useNavigation<RootNav>();

  const user = authState.user ?? {
    name: 'Student User',
    studentId: '20229999',
    email: 'student@edu.vn',
    class: 'IT-K67-A1',
  };

  // initials avatar
  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.orb, s.orb1]} />
      <View style={[s.orb, s.orb2]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Header ── */}
        <View style={s.header}>
          <AppText variant="h2" style={{ color: COLORS.whiteSoft }}>Profile</AppText>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* ── Avatar + name ── */}
          <View style={s.avatarSection}>
            <View style={s.avatarWrap}>
              <LinearGradient
                colors={[COLORS.blue, COLORS.cyan]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.avatarGradient}
              >
                <AppText style={s.avatarInitials}>{initials}</AppText>
              </LinearGradient>
            </View>

            <AppText variant="h3" style={s.userName}>
              {user.name}
            </AppText>
            <View style={s.studentBadge}>
              <AppText style={s.studentBadgeText}>🎓 Student</AppText>
            </View>
          </View>

          {/* ── Info card ── */}
          <View style={s.infoCard}>
            <LinearGradient
              colors={[COLORS.blue, COLORS.cyan]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.cardAccentBar}
            />
            <AppText variant="label" style={{ marginBottom: 14, letterSpacing: 1 }}>
              Student Information
            </AppText>

            <InfoRow label="Full Name"   value={user.name}      />
            <View style={s.divider} />
            <InfoRow label="Student ID"  value={user.studentId} />
            <View style={s.divider} />
            <InfoRow label="Email"       value={user.email}     />
            <View style={s.divider} />
            <InfoRow label="Class"       value={user.class}     />
            <View style={s.divider} />
            <InfoRow label="Department"  value="School of Information Technology" />
          </View>

          {/* ── Biometrics card ── */}
          <View style={s.bioCard}>
            <View style={s.bioRow}>
              <AppText style={s.bioIcon}>🛡</AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="semi" color={COLORS.whiteSoft}>
                  Biometric Face Profile
                </AppText>
                <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 2 }}>
                  Used for exam identity verification
                </AppText>
              </View>
              <View style={s.registeredBadge}>
                <AppText style={s.registeredBadgeText}>✓ Active</AppText>
              </View>
            </View>

            <View style={s.divider} />

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => rootNav.navigate('FaceReRegistration')}
              style={s.reRegBtn}
            >
              <AppText style={s.reRegIcon}>🔄</AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="semi" color={COLORS.whiteSoft} style={{ fontSize: 13 }}>
                  Request Face Re-registration
                </AppText>
                <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 1 }}>
                  Submit a request if your face is not being recognized
                </AppText>
              </View>
              <AppText style={s.chevron}>›</AppText>
            </TouchableOpacity>
          </View>

          {/* ── Log out ── */}
          <Button
            label="Log Out"
            variant="ghost"
            onPress={logout}
            style={{ width: '100%', marginTop: 8 }}
          />

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },

  orb: { position: 'absolute', borderRadius: RADIUS.full },
  orb1: { width: 280, height: 280, top: -60, right: -70, backgroundColor: 'rgba(37,99,235,0.09)' },
  orb2: { width: 200, height: 200, bottom: 100, left: -60, backgroundColor: 'rgba(6,182,212,0.07)' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 8,
  },
  avatarWrap: {
    borderRadius: RADIUS.full,
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
    elevation: 12,
    marginBottom: 14,
  },
  avatarGradient: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    color: '#fff',
    letterSpacing: 1,
  },
  userName: {
    color: COLORS.whiteSoft,
    marginBottom: 8,
    textAlign: 'center',
  },
  studentBadge: {
    backgroundColor: 'rgba(37,99,235,0.12)',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.28)',
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  studentBadgeText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12,
    color: COLORS.blueBright,
  },

  // Info card
  infoCard: {
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    paddingTop: 22,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    gap: 12,
  },
  infoLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
    color: COLORS.muted,
    flexShrink: 0,
    width: 90,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  // Biometrics card
  bioCard: {
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 18,
  },
  bioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
  },
  bioIcon: { fontSize: 26 },
  registeredBadge: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  registeredBadgeText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
    color: COLORS.green,
  },
  reRegBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
  },
  reRegIcon: { fontSize: 20 },
  chevron: {
    fontSize: 22,
    color: COLORS.muted,
    marginLeft: 4,
  },
});
