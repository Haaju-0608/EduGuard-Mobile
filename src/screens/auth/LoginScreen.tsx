import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../navigation/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Input, EyeToggle } from '../../components/ui/Input';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

function MailIcon() {
  return <AppText style={s.icon}>✉</AppText>;
}
function LockIcon() {
  return <AppText style={s.icon}>🔒</AppText>;
}
function ShieldLogo() {
  return (
    <View style={s.shield}>
      <LinearGradient
        colors={['#2563EB', '#06B6D4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.shieldGradient}
      >
        <AppText style={s.shieldEmoji}>🛡</AppText>
      </LinearGradient>
    </View>
  );
}

function BackgroundOrbs() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[s.orb, s.orb1]} />
      <View style={[s.orb, s.orb2]} />
      <View style={[s.orb, s.orb3]} />
    </View>
  );
}

function FeaturePill({ label }: { label: string }) {
  return (
    <View style={s.pill}>
      <AppText style={s.pillText}>{label}</AppText>
    </View>
  );
}

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loginError, setLoginError] = useState('');

  const validate = () => {
    let valid = true;
    setEmailError('');
    setPasswordError('');
    setLoginError('');

    if (!email.trim()) {
      setEmailError('Please enter your email.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Invalid email format.');
      valid = false;
    }
    if (!password) {
      setPasswordError('Please enter your password.');
      valid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      valid = false;
    }
    return valid;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setLoginError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <BackgroundOrbs />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Header / Logo ── */}
            <View style={s.header}>
              <ShieldLogo />
              <View style={{ marginLeft: 12 }}>
                <AppText variant="h2" style={{ color: COLORS.whiteSoft, letterSpacing: -0.5 }}>
                  EduGuard
                </AppText>
              </View>
            </View>

            {/* ── Hero text ── */}
            <View style={s.heroSection}>
              <AppText variant="h1" style={s.heroTitle}>
                Welcome back 👋
              </AppText>
              <AppText variant="body-sm" color={COLORS.muted} style={{ marginTop: 6, lineHeight: 20 }}>
                Sign in to view your schedule, attendance, and academic progress.
              </AppText>
            </View>

            {/* ── Feature pills ── */}
            <View style={s.pillRow}>
              {['📋 Attendance', '📅 Schedule', '📊 Results'].map((p) => (
                <FeaturePill key={p} label={p} />
              ))}
            </View>

            {/* ── Login form card ── */}
            <View style={s.formCard}>
              <LinearGradient
                colors={['#2563EB', '#06B6D4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.cardAccentBar}
              />

              <AppText variant="h3" style={{ marginBottom: 4, marginTop: 4 }}>
                Sign In
              </AppText>
              <AppText variant="body-sm" color={COLORS.muted} style={{ marginBottom: 20 }}>
                Enter your credentials to continue.
              </AppText>

              <Input
                label="Email"
                icon={<MailIcon />}
                value={email}
                onChangeText={(t) => { setEmail(t); setEmailError(''); setLoginError(''); }}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={emailError}
              />

              <View style={{ height: 14 }} />

              <Input
                label="Password"
                icon={<LockIcon />}
                value={password}
                onChangeText={(t) => { setPassword(t); setPasswordError(''); setLoginError(''); }}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                rightElement={
                  <EyeToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />
                }
                error={passwordError}
              />

              {/* Remember & Forgot */}
              <View style={s.rememberRow}>
                <TouchableOpacity
                  onPress={() => setRememberMe(!rememberMe)}
                  style={s.checkboxRow}
                  activeOpacity={0.7}
                >
                  <View style={[s.checkbox, rememberMe && s.checkboxChecked]}>
                    {rememberMe && <AppText style={{ fontSize: 10, color: '#fff' }}>✓</AppText>}
                  </View>
                  <AppText variant="body-sm" color={COLORS.muted}>
                    Remember me
                  </AppText>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7}>
                  <AppText style={{ fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.blueBright }}>
                    Forgot password?
                  </AppText>
                </TouchableOpacity>
              </View>

              {loginError ? (
                <View style={s.errorBox}>
                  <AppText style={s.errorText}>{loginError}</AppText>
                </View>
              ) : null}

              <View style={{ marginTop: 20 }}>
                <Button
                  label={loading ? '' : 'Sign In'}
                  onPress={handleLogin}
                  loading={loading}
                  style={{ width: '100%' }}
                />
              </View>
            </View>

            <View style={{ height: 32 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },

  orb: {
    position: 'absolute',
    borderRadius: RADIUS.full,
  },
  orb1: {
    width: 340,
    height: 340,
    top: -120,
    right: -100,
    backgroundColor: 'rgba(37,99,235,0.13)',
  },
  orb2: {
    width: 250,
    height: 250,
    bottom: 80,
    left: -80,
    backgroundColor: 'rgba(6,182,212,0.10)',
  },
  orb3: {
    width: 160,
    height: 160,
    top: '40%',
    right: 20,
    backgroundColor: 'rgba(37,99,235,0.07)',
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  shield: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  shieldGradient: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  shieldEmoji: {
    fontSize: 26,
  },

  heroSection: {
    marginBottom: 18,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 32,
  },

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  pill: {
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
  },

  formCard: {
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    paddingTop: 24,
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

  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },

  errorBox: {
    marginTop: 14,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    color: '#F87171',
    lineHeight: 18,
  },

  icon: {
    fontSize: 15,
    color: COLORS.muted,
  },
});
