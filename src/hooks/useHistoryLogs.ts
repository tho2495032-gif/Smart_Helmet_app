import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { onValue, ref } from 'firebase/database';
import { useCallback, useState } from 'react';
import { realtimeDB } from '../config/firebaseConfig';
import { isPrivateMode } from '../config/privacyConfig';
import type { HistoryEvent } from '../types/history';

export function useHistoryLogs() {
  const [logs, setLogs] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [currentHelmetId, setCurrentHelmetId] = useState('Helmet_001');

  useFocusEffect(
    useCallback(() => {
      setLoading(true);

      AsyncStorage.getItem('helmetId').then((id) => {
        if (id) setCurrentHelmetId(id);
      });

      AsyncStorage.getItem('appSettings').then((saved) => {
        if (saved) {
          try {
            setIsDark(JSON.parse(saved).darkMode);
          } catch {}
        }
      });

      const eventsRef = ref(realtimeDB, 'Events');
      const unsubscribe = onValue(
        eventsRef,
        (snapshot) => {
          const data = snapshot.val();
          if (data && typeof data === 'object') {
            const events: HistoryEvent[] = [];

            Object.keys(data).forEach((helmetId) => {
              const helmetEvents = data[helmetId];
              if (helmetEvents && typeof helmetEvents === 'object') {
                Object.keys(helmetEvents).forEach((eventId) => {
                  const event: HistoryEvent & Record<string, unknown> = {
                    id: eventId,
                    helmet_id: helmetId,
                    ...helmetEvents[eventId],
                  };
                  if (isPrivateMode) {
                    delete event.value;
                    delete event.alcohol_raw;
                    delete event.alcoholRaw;
                    const description = `${event.sensor ?? ''} ${event.type ?? ''}`.toLowerCase();
                    const isMpuEvent = /mpu6050|imu_impact|fall_confirmed|té ngã|va đập|impact|fall/.test(description);
                    if (!isMpuEvent) {
                      delete event.lat;
                      delete event.lng;
                    }
                  }
                  events.push(event);
                });
              }
            });

            events.sort((first, second) => (second.timestamp || 0) - (first.timestamp || 0));
            setLogs(events);
          } else {
            setLogs([]);
          }
          setLoading(false);
        },
        () => {
          setLogs([]);
          setLoading(false);
        },
      );

      return () => unsubscribe();
    }, []),
  );

  return { logs, loading, isDark, currentHelmetId };
}
