import React, { useState } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { AppText } from './AppText';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  error?: string;
}

export function Input({ label, icon, rightElement, error, style, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && (
        <AppText variant="semi" style={styles.label} color={COLORS.muted}>
          {label}
        </AppText>
      )}

      <View
        style={[
          styles.container,
          focused && styles.containerFocused,
          error ? styles.containerError : undefined,
        ]}
      >
        {icon && <View style={styles.iconWrap}>{icon}</View>}

        <TextInput
          style={[styles.input, style]}
          placeholderTextColor="rgba(241,245,255,0.35)"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />

        {rightElement && <View style={styles.rightWrap}>{rightElement}</View>}
      </View>

      {error && (
        <AppText variant="caption" color={COLORS.red} style={styles.errorText}>
          {error}
        </AppText>
      )}
    </View>
  );
}

// Convenience toggle button for password show/hide
export function EyeToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <AppText style={{ fontSize: 18, color: COLORS.muted }}>
        {visible ? '🙈' : '👁'}
      </AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    marginBottom: 2,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  containerFocused: {
    borderColor: 'rgba(59,130,246,0.5)',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  containerError: {
    borderColor: 'rgba(239,68,68,0.5)',
  },
  input: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.whiteSoft,
    padding: 0,
    margin: 0,
  },
  iconWrap: {
    width: 18,
    alignItems: 'center',
  },
  rightWrap: {
    marginLeft: 4,
  },
  errorText: {
    marginTop: 4,
  },
});
