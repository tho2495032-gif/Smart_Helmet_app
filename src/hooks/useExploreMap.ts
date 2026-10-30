import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { onValue, ref } from 'firebase/database';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WebView } from 'react-native-webview';
import { realtimeDB } from '../config/firebaseConfig';

export function useExploreMap() {
  const [isDark, setIsDark] = useState(false);
  const [activeHelmetId, setActiveHelmetId] = useState<string | null>(null);
  const [activeHelmetName, setActiveHelmetName] = useState('NÃ³n báº£o hiá»ƒm');
  const [location, setLocation] = useState({ lat: 10.8231, lng: 106.6297, timestamp: 0 });
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

    const helmetRef = ref(realtimeDB, `Devices/${activeHelmetId}/telemetry`);
    const unsubscribe = onValue(helmetRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
        const newLocation = {
          lat: data.lat,
          lng: data.lng,
          timestamp: data.last_update || Date.now(),
        };
        setLocation(newLocation);

        webViewRef.current?.injectJavaScript(`
          if (window.updateLocation) {
            window.updateLocation(${newLocation.lat}, ${newLocation.lng});
          }
          true;
        `);
      }
    });

    return unsubscribe;
  }, [activeHelmetId]);

  return { isDark, activeHelmetId, activeHelmetName, location, webViewRef };
}
