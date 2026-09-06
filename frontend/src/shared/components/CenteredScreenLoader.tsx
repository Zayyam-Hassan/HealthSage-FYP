import React from 'react';
import { View } from 'react-native';
import Loader from '@/components/Loader';

/** Full-width column with centered default Loader — common loading branch inside SafeAreaView. */
export function CenteredScreenLoader() {
  return (
    <View className="flex-1 items-center justify-center">
      <Loader />
    </View>
  );
}
