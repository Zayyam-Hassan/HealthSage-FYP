import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { colors } from '@/constants/colors';
import { InputProps } from './types';

const COLORS = {
  background: colors.input.surface,
  border: colors.border.input,
  primary: colors.primary.main,
  error: colors.status.error,
  text: colors.text.primary,
  textSecondary: colors.text.secondary,
  placeholder: colors.text.tertiary,
};

const Input: React.FC<InputProps> = ({
  type = 'text',
  passwordMode = 'current',
  usernameField = false,
  label,
  placeholder,
  value,
  onChangeText,
  error,
  helperText,
  icon,
  required = false,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  className = '',
  secureTextEntry,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password' || secureTextEntry;
  const shouldHidePassword = isPassword && !showPassword;

  const keyboardType = useMemo(() => {
    switch (type) {
      case 'email':
        return 'email-address';
      case 'phone':
        return 'phone-pad';
      case 'number':
        return 'numeric';
      default:
        return 'default';
    }
  }, [type]);

  const nativeAutofill = useMemo((): Pick<
    TextInputProps,
    'autoComplete' | 'textContentType' | 'importantForAutofill'
  > => {
    const androidImportant: Pick<TextInputProps, 'importantForAutofill'> =
      Platform.OS === 'android' ? { importantForAutofill: 'yes' } : {};

    if (type === 'email') {
      return {
        autoComplete: 'email',
        textContentType: 'emailAddress',
        ...androidImportant,
      };
    }

    if (isPassword) {
      if (passwordMode === 'new') {
        return {
          autoComplete: 'password-new',
          textContentType: 'newPassword',
          ...androidImportant,
        };
      }
      return {
        autoComplete: 'password',
        textContentType: 'password',
        ...androidImportant,
      };
    }

    if (usernameField) {
      return {
        autoComplete: 'username',
        textContentType: 'username',
        ...androidImportant,
      };
    }

    return {};
  }, [type, isPassword, passwordMode, usernameField]);

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          error ? styles.inputContainerError : null,
          disabled ? styles.inputContainerDisabled : null,
        ]}
      >
        {icon ? <View style={styles.icon}>{icon}</View> : null}

        <TextInput
          style={[
            styles.input,
            multiline ? styles.multilineInput : null,
            disabled ? styles.inputDisabled : null,
          ]}
          placeholder={placeholder}
          placeholderTextColor={COLORS.placeholder}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={type === 'email' || usernameField ? 'none' : 'sentences'}
          autoCorrect={type === 'email' || isPassword || usernameField ? false : true}
          secureTextEntry={shouldHidePassword}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          returnKeyType={multiline ? 'default' : type === 'email' ? 'next' : 'done'}
          blurOnSubmit={!multiline}
          {...nativeAutofill}
        />

        {isPassword ? (
          <Pressable
            onPress={() => setShowPassword((current) => !current)}
            style={styles.passwordToggle}
          >
            <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  required: {
    color: COLORS.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.background,
  },
  inputContainerError: {
    borderColor: COLORS.error,
  },
  inputContainerDisabled: {
    opacity: 0.5,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 16,
    color: COLORS.text,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    color: COLORS.textSecondary,
  },
  passwordToggle: {
    marginLeft: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  passwordToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  errorText: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.error,
  },
  helperText: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export default Input;
