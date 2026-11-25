import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { useAppLocale } from './i18n/app-locale';

export function useCopy() {
  return useAppLocale().t;
}
export function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text>{label}</Text>
      <TextInput accessibilityLabel={label} style={styles.input} {...props} />
    </View>
  );
}
export function Screen({ children }: PropsWithChildren) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.screen}>
      {children}
    </ScrollView>
  );
}
export function Heading({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}
export function Notice({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
      {children}
    </Text>
  );
}
export const styles = StyleSheet.create({
  screen: {
    padding: 24,
    paddingTop: 56,
    gap: 16,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  heading: { fontSize: 24, fontWeight: '700', color: '#123b32' },
  button: { backgroundColor: '#17624e', padding: 14, minHeight: 48, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#74857e',
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
    color: '#172c25',
  },
  field: { gap: 8 },
  notice: { color: '#87341e', fontSize: 16 },
  card: { padding: 16, gap: 12, borderWidth: 1, borderColor: '#c6d3cc', borderRadius: 8 },
});
