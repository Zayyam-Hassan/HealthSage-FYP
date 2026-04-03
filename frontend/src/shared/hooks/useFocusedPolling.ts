import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useEffect, useRef } from 'react';

export function useFocusedPolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useFocusEffect(
    React.useCallback(() => {
      if (!enabled || intervalMs <= 0) {
        return undefined;
      }

      const intervalId = setInterval(() => {
        void callbackRef.current();
      }, intervalMs);

      return () => {
        clearInterval(intervalId);
      };
    }, [enabled, intervalMs]),
  );
}
