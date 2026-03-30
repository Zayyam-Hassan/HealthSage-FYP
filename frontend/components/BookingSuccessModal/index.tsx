import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

interface BookingSuccessModalProps {
  visible: boolean;
  doctorName: string;
  dateLine: string;
  timeLine: string;
  /** e.g. Confirmed / booked — shown after API success */
  statusLabel?: string;
  onDone: () => void;
  onEditAppointment?: () => void;
}

export default function BookingSuccessModal({
  visible,
  doctorName,
  dateLine,
  timeLine,
  statusLabel = 'Confirmed',
  onDone,
  onEditAppointment,
}: BookingSuccessModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View className="flex-1 items-center justify-center bg-black/55 px-6">
        <View className="w-full max-w-sm rounded-3xl bg-white px-6 py-8 shadow-xl">
          <View className="mb-5 items-center">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-coral-soft">
              <Ionicons name="thumbs-up" size={40} color={colors.coral.deep} />
            </View>
          </View>
          <View className="mb-3 items-center">
            <View className="rounded-full bg-success/15 px-4 py-1.5">
              <Text className="text-center text-xs font-bold uppercase tracking-wide text-success">
                Status: {statusLabel}
              </Text>
            </View>
          </View>
          <Text className="mb-1 text-center text-2xl font-bold text-text">Thank You!</Text>
          <Text className="mb-4 text-center text-base font-semibold text-text-secondary">
            Your appointment is confirmed
          </Text>
          <Text className="mb-8 text-center text-sm leading-6 text-text-secondary">
            You booked an appointment with {doctorName} on {dateLine} at {timeLine}.
          </Text>
          <TouchableOpacity
            onPress={onDone}
            className="mb-4 w-full items-center rounded-2xl bg-coral-deep py-4 active:opacity-90"
            activeOpacity={0.85}
          >
            <Text className="text-base font-bold text-white">Done</Text>
          </TouchableOpacity>
          {onEditAppointment ? (
            <TouchableOpacity onPress={onEditAppointment} className="items-center py-2">
              <Text className="text-sm font-semibold text-coral-deep">Edit your appointment</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
