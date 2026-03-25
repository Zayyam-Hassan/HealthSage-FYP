import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

type DialogAction = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
};

interface AppDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  actions?: DialogAction[];
}

const buttonStyles = {
  primary: 'bg-primary',
  secondary: 'bg-bg-secondary border border-border',
  danger: 'bg-error',
};

const textStyles = {
  primary: 'text-white',
  secondary: 'text-text',
  danger: 'text-white',
};

export default function AppDialog({
  visible,
  title,
  message,
  onClose,
  actions = [],
}: AppDialogProps) {
  const resolvedActions =
    actions.length > 0
      ? actions
      : [{ label: 'Close', onPress: onClose, variant: 'primary' as const }];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/45 px-6">
        <View className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
          <Text className="text-xl font-bold text-text mb-3">{title}</Text>
          <Text className="text-sm leading-6 text-text-secondary mb-6">{message}</Text>
          <View className="flex-row justify-end">
            {resolvedActions.map((action, index) => {
              const variant = action.variant ?? 'primary';
              return (
                <TouchableOpacity
                  key={`${action.label}-${index}`}
                  onPress={() => {
                    onClose();
                    action.onPress();
                  }}
                  activeOpacity={0.85}
                  className={`ml-3 rounded-2xl px-4 py-3 ${buttonStyles[variant]}`}
                >
                  <Text className={`text-sm font-semibold ${textStyles[variant]}`}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
