import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

type Props = {
  label: string;
  value: string;
  options: readonly string[];
  onSelect: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  className?: string;
};

/** Same visual shell as `Input` / `FormInput`: 12px radius, `colors.border.input`, `colors.input.surface`. */
export default function ClinicalDropdown({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select…',
  required = false,
  error,
  helperText,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);

  const display = value?.trim() ? value : placeholder;
  const hasValue = Boolean(value?.trim());

  return (
    <View className={`mb-4 ${className}`.trim()}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setOpen(true)}
        style={[styles.trigger, error ? styles.triggerError : null]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display}`}
      >
        <Text
          style={[styles.triggerText, !hasValue ? styles.triggerTextPlaceholder : null]}
          numberOfLines={1}
        >
          {display}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.text.secondary} />
      </TouchableOpacity>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setOpen(false)}>
          <Pressable
            className="max-h-[70%] rounded-t-3xl bg-white px-2 pb-6 pt-3"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-2 h-1 w-10 self-center rounded-full bg-border/80" />
            <Text className="mb-3 px-3 text-center text-base font-bold text-text">{label}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {options.map((opt) => {
                const active = value === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    className={`mx-2 mb-1 rounded-xl px-4 py-3.5 ${
                      active ? 'bg-coral-soft' : 'bg-bg-secondary/80'
                    }`}
                    activeOpacity={0.85}
                    onPress={() => {
                      onSelect(opt);
                      setOpen(false);
                    }}
                  >
                    <Text
                      className={`text-base font-semibold ${
                        active ? 'text-coral-ink' : 'text-text'
                      }`}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  required: {
    color: colors.status.error,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border.input,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.input.surface,
  },
  triggerError: {
    borderColor: colors.status.error,
  },
  triggerText: {
    flex: 1,
    marginRight: 8,
    fontSize: 16,
    fontWeight: '400',
    color: colors.text.primary,
  },
  triggerTextPlaceholder: {
    color: colors.text.tertiary,
  },
  errorText: {
    marginTop: 4,
    fontSize: 14,
    color: colors.status.error,
  },
  helperText: {
    marginTop: 4,
    fontSize: 14,
    color: colors.text.secondary,
  },
});
