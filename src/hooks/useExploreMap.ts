import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { onValue, ref } from 'firebase/database';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WebView } from 'react-native-webview';
import { realtimeDB } from '../config/firebaseConfig';
import { isPrivateMode } from '../config/privacyConfig';

export function useExploreMap() {
  const [isDark, setIsDark] = useState(false);
  const [activeHelmetId, setActiveHelmetId] = useState<string | null>(null);
  const [activeHelmetName, setActiveHelmetName] = useState('Nón bảo hiểm');
  const [location, setLocation] = useState(() =>
    isPrivateMode
      ? { lat: 0, lng: 0, timestamp: 0 }
      : { lat: 10.8231, lng: 106.6297, timestamp: 0 },
  );
  const webViewRef = useRef<WebView>(null);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('helmetId').then(setActiveHelmetId);
      AsyncStorage.getItem('helmetName').then((name) => {
        if (name) setActiveHelmetName(name);
      });
      AsyncStorage.getItem('appSettings').then((saved) => {
        if (saved) {
          try {
            setIsDark(JSON.parse(saved).darkMode === true);
          } catch {}
        }
      });
    }, []),
  );

  useEffect(() => {
    if (!activeHelmetId) return;

    const locationRef = isPrivateMode
      ? ref(realtimeDB, `Events/${activeHelmetId}`)
      : ref(realtimeDB, `Devices/${activeHelmetId}/telemetry`);
    const unsubscribe = onValue(locationRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== 'object') return;

      let newLocation: { lat: number; lng: number; timestamp: number } | null = null;
      if (isPrivateMode) {
        const crashEvents = Object.values(data as Record<string, any>)
          .filter((event) => {
            if (!event || typeof event !== 'object') return false;
            const description = `${event.sensor ?? ''} ${event.type ?? ''} ${event.event ?? ''} ${event.source_event ?? ''}`.toLowerCase();
            return /mpu6050|imu_impact|fall_confirmed|té ngã|va đập|impact|fall/.test(description);
          })
          .sort((first, second) => Number(second.timestamp ?? 0) - Number(first.timestamp ?? 0));

        const latestCrash = crashEvents.find((event) => {
          const lat = Number(event.lat);
          const lng = Number(event.lng);
          return Number.isFinite(lat) && Number.isFinite(lng) &&
            Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
        });
        if (latestCrash) {
          newLocation = {
            lat: Number(latestCrash.lat),
            lng: Number(latestCrash.lng),
            timestamp: Number(latestCrash.timestamp ?? Date.now()),
          };
        }
      } else if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        newLocation = {
          lat: data.lat,
          lng: data.lng,
          timestamp: data.last_update || Date.now(),
        };
      }

      if (!newLocation) return;
      setLocation(newLocation);

      webViewRef.current?.injectJavaScript(`
        if (window.updateLocation) {
          window.updateLocation(${newLocation.lat}, ${newLocation.lng});
        }
        true;
      `);
    });

    return unsubscribe;
  }, [activeHelmetId]);

  return { isDark, activeHelmetId, activeHelmetName, location, webViewRef };
}
