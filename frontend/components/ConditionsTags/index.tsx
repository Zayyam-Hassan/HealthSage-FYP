import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import Badge from '@/components/Badge';

interface ConditionsTagsProps {
  label: string;
  conditions: string[];
  onChange: (conditions: string[]) => void;
  error?: string;
  className?: string;
}

const ConditionsTags: React.FC<ConditionsTagsProps> = ({
  label,
  conditions,
  onChange,
  error,
  className = '',
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleAddCondition = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !conditions.includes(trimmed)) {
      onChange([...conditions, trimmed]);
      setInputValue('');
    }
  };

  const handleRemoveCondition = (conditionToRemove: string) => {
    onChange(conditions.filter((c) => c !== conditionToRemove));
  };

  const handleSubmitEditing = () => {
    handleAddCondition();
  };

  return (
    <View className={`mb-4 ${className}`.trim()}>
      {label && (
        <Text className="text-sm font-medium text-text mb-2">
          {label}
        </Text>
      )}
      
      {/* Input for adding new condition */}
      <View className="flex-row gap-2 mb-3">
        <View className="flex-1 border-2 border-border rounded-lg px-4 py-3 bg-background">
          <TextInput
            className="text-base text-text"
            placeholder="Enter condition (e.g., Hypertension)"
            placeholderTextColor="#9CA3AF"
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={handleSubmitEditing}
            returnKeyType="done"
          />
        </View>
        <TouchableOpacity
          onPress={handleAddCondition}
          className="px-4 py-3 bg-primary rounded-lg items-center justify-center"
        >
          <Text className="text-white font-semibold">Add</Text>
        </TouchableOpacity>
      </View>

      {/* Display existing conditions as tags */}
      {conditions.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {conditions.map((condition, index) => (
            <View key={index} className="flex-row items-center">
              <Badge variant="warning" size="sm" className="mr-1">
                {condition}
              </Badge>
              <TouchableOpacity
                onPress={() => handleRemoveCondition(condition)}
                className="ml-1"
              >
                <Text className="text-error text-sm">✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {error && (
        <Text className="text-error text-sm mt-1">{error}</Text>
      )}
    </View>
  );
};

export default ConditionsTags;


