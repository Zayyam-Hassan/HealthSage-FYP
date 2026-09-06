import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface SelectProps {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  required?: boolean;
  error?: string;
  helperText?: string;
  className?: string;
}

const Select: React.FC<SelectProps> = ({
  label,
  value,
  options,
  onSelect,
  required = false,
  error,
  helperText,
  className = '',
}) => {
  return (
    <View className={`mb-4 ${className}`.trim()}>
      {label && (
        <Text className="text-sm font-medium text-text mb-2">
          {label}
          {required && <Text className="text-error"> *</Text>}
        </Text>
      )}
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => onSelect(option)}
            className={`px-4 py-3 rounded-lg border-2 ${
              value === option
                ? 'border-primary bg-primary/10'
                : 'border-border bg-background'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                value === option ? 'text-primary' : 'text-text'
              }`}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
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

export default Select;


