import { icons } from "@/constants/icons";
import { colors } from "@/constants/colors";
import React, { useState } from "react";
import { Image, TextInput, View, TouchableOpacity, Text, Platform } from "react-native";

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (text: string) => void;
  value?: string;
  onChangeText?: (text: string) => void;
  className?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Search...",
  onSearch,
  value: controlledValue,
  onChangeText: controlledOnChangeText,
  className = "",
}) => {
  const [searchText, setSearchText] = useState("");

  const value = controlledValue !== undefined ? controlledValue : searchText;
  const handleChangeText = (text: string) => {
    if (controlledOnChangeText) {
      controlledOnChangeText(text);
    } else {
      setSearchText(text);
    }
  };

  const handleSearch = () => {
    if (onSearch) {
      onSearch(value);
    }
  };

  return (
    <View
      className={`flex-row items-center bg-bg-secondary rounded-2xl border border-border/60 px-4 py-3.5 shadow-sm ${className}`.trim()}
    >
      <Image
        source={icons.search}
        className="w-5 h-5"
        resizeMode="contain"
        tintColor={colors.primary.main}
      />
      <TextInput
        placeholder={placeholder}
        value={value}
        onChangeText={handleChangeText}
        placeholderTextColor={colors.text.tertiary}
        className="flex-1 ml-3 text-base text-text"
        returnKeyType="search"
        onSubmitEditing={handleSearch}
        {...(Platform.OS === 'android' && { autoComplete: 'off' as any, importantForAutofill: 'no' as any })}
        {...(Platform.OS === 'ios' && { textContentType: 'none' as any })}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => handleChangeText("")} className="ml-2">
          <Text className="text-text-secondary text-sm">x</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default SearchBar;
