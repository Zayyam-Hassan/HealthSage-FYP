import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { InputProps } from './types';

const Input: React.FC<InputProps> = ({
  type = 'text',
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
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const shouldShowPassword = isPassword && showPassword;

  const getKeyboardType = () => {
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
  };

  const borderColor = error
    ? 'border-error'
    : isFocused
    ? 'border-primary'
    : 'border-border';

  return (
    <View className={`mb-4 ${className}`.trim()}>
      {label && (
        <Text className="text-sm font-medium text-text mb-2">
          {label}
          {required && <Text className="text-error"> *</Text>}
        </Text>
      )}
      <View
        className={`
          flex-row
          items-center
          border-2
          ${borderColor}
          rounded-xl
          px-4
          py-3
          bg-background
          ${disabled ? 'opacity-50' : ''}
          ${isFocused ? 'shadow-sm border-primary' : ''}
        `.trim().replace(/\s+/g, ' ')}
      >
        {icon && <View className="mr-3">{icon}</View>}
        <TextInput
          className="flex-1 text-base text-text"
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          keyboardType={getKeyboardType()}
          autoCapitalize={type === 'email' ? 'none' : 'sentences'}
          autoCorrect={type === 'email' || type === 'password' ? false : true}
          secureTextEntry={isPassword && !shouldShowPassword}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          returnKeyType={multiline ? 'default' : 'done'}
          blurOnSubmit={!multiline}
          {...(Platform.OS === 'android' && { autoComplete: 'off' as any, importantForAutofill: 'no' as any })}
          {...(Platform.OS === 'ios' && { textContentType: 'none' as any })}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            className="ml-2"
          >
            <Text className="text-primary text-sm font-medium">
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text className="text-error text-sm mt-1">{error}</Text>
      )}
      {helperText && !error && (
        <Text className="text-text-secondary text-sm mt-1">{helperText}</Text>
      )}
    </View>
  );
};

export default Input;
