import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Modal } from 'react-native';

interface SuccessPopupProps {
  visible: boolean;
  message: string;
  onClose: () => void;
  duration?: number;
}

const SuccessPopup: React.FC<SuccessPopupProps> = ({
  visible,
  message,
  onClose,
  duration = 3000,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      backdropOpacity.setValue(0);
      iconScale.setValue(0);
      iconRotation.setValue(0);

      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      Animated.sequence([
        Animated.spring(iconScale, {
          toValue: 1.2,
          useNativeDriver: true,
          tension: 50,
          friction: 3,
        }),
        Animated.spring(iconScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 5,
        }),
      ]).start();

      Animated.timing(iconRotation, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }

    scaleAnim.setValue(0);
    opacityAnim.setValue(0);
    backdropOpacity.setValue(0);
    iconScale.setValue(0);
    iconRotation.setValue(0);
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const iconRotationInterpolate = iconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['-180deg', '0deg'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Animated.View
        style={{
          opacity: backdropOpacity,
        }}
        className="flex-1 items-center justify-center bg-black/50 px-6"
      >
        <Animated.View
          style={{
            transform: [
              { scale: scaleAnim },
              {
                translateY: scaleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }),
              },
            ],
            opacity: opacityAnim,
          }}
          className="w-full max-w-sm items-center rounded-3xl border border-primary/10 bg-white p-8 shadow-2xl"
        >
          <Animated.View
            style={{
              transform: [
                { scale: iconScale },
                { rotate: iconRotationInterpolate },
              ],
            }}
            className="mb-6 h-24 w-24 items-center justify-center rounded-full bg-primary/20 shadow-lg"
          >
            <View className="h-20 w-20 items-center justify-center rounded-full bg-primary/15">
              <Text className="text-4xl font-bold text-primary">OK</Text>
            </View>
          </Animated.View>

          <Text className="mb-3 text-center text-2xl font-bold text-text">
            Success!
          </Text>

          <Text className="mb-8 px-2 text-center text-base leading-6 text-text-secondary">
            {message}
          </Text>

          <TouchableOpacity
            onPress={handleClose}
            className="w-full items-center rounded-2xl bg-primary px-10 py-4 shadow-lg active:opacity-80"
            activeOpacity={0.8}
            style={{
              shadowColor: '#faad9e',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Text className="text-base font-bold text-white">Got it!</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default SuccessPopup;
