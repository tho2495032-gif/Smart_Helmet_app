import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { onValue, ref } from 'firebase/database';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, realtimeDB } from '../../config/firebaseConfig';
import TelemetryCharts from '../../components/home/TelemetryCharts';


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type UserDevice = {
  id: string;
  name: string;
  color?: string;
  role?: string;
};

// Cáº¥u hÃ¬nh chart 30 Ä‘iá»ƒm
const CHART_POINTS = 30;
const emptyChartData = Array(CHART_POINTS).fill(0);
const emptyAccelData = Array(CHART_POINTS).fill(1); // Gia tá»‘c máº·c Ä‘á»‹nh 1g
// Label chá»‰ hiá»‡n 2 Ä‘iá»ƒm Ä‘áº§u cuá»‘i cho gá»n

export default function DashboardScreen() {
  const [isDark, setIsDark] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [userUid, setUserUid] = useState('');
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<UserDevice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [helmetData, setHelmetData] = useState({
    status: { alcohol_raw: 0, alcohol_detected: false, accel_mag_g: 1, gyro_mag_dps: 0, fall_accident_alert: false, is_sos_pressed: false, is_locked: true },
    current_location: { lat: 10.8231, lng: 106.6297 },
  });

  const [alcoholRawHistory, setAlcoholRawHistory] = useState([...emptyChartData]);
  const [accelHistory, setAccelHistory] = useState([...emptyAccelData]);
  const [gyroHistory, setGyroHistory] = useState([...emptyChartData]);

  const prevAlcoholRef = useRef<boolean>(false);
  const prevFallRef = useRef<boolean>(false);

  const isOwner = selectedDevice?.role === 'owner';

  // =========================================================================
  useEffect(() => {
    async function requestPermissions() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (Platform.OS === 'android' && status === 'granted') {
        await Notifications.setNotificationChannelAsync('smart_helmet_alerts', {
          name: 'Cáº£nh bÃ¡o Smart Helmet',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    }
    requestPermissions();
  }, []);
  const triggerSystemNotification = async (title: string, body: string) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true, priority: Notifications.AndroidNotificationPriority.MAX },
        trigger: null,
      });
    } catch (e) {}
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const loadProfileAndDevices = async () => {
        setIsLoading(true);
        const currentAuthUser = auth.currentUser;
        const uid = currentAuthUser?.uid || (await AsyncStorage.getItem('userUid')) || '';
        const email = currentAuthUser?.email || (await AsyncStorage.getItem('userEmail')) || '';

        if (!isMounted) return;
        setCurrentUserEmail(email);
        setUserUid(uid);

        const savedSettings = await AsyncStorage.getItem('appSettings');
        if (savedSettings && isMounted) {
          try {
            setIsDark(JSON.parse(savedSettings).darkMode);
          } catch (e) {}
        }

        if (!uid) {
          if (isMounted) {
            setDevices([]);
            setSelectedDevice(null);
            setIsLoading(false);
          }
          return;
        }

        const userDevicesRef = ref(realtimeDB, `Users/${uid}/devices`);
        onValue(userDevicesRef, (snapshot) => {
          if (!isMounted) return;
          const data = snapshot.val();
          if (data && typeof data === 'object' && Object.keys(data).length > 0) {
            const list: UserDevice[] = Object.keys(data).map((dk) => ({
              id: dk,
              name: data[dk].name || dk,
              color: data[dk].color || '#007AFF',
              role: data[dk].role || 'viewer',
            }));

            setDevices(list);

            AsyncStorage.getItem('helmetId').then((savedId) => {
              const cur = list.find((d) => d.id === savedId) || list[0];
              setSelectedDevice(cur);
              AsyncStorage.setItem('helmetId', cur.id);
              AsyncStorage.setItem('helmetName', cur.name);
              AsyncStorage.setItem('helmetRole', cur.role || 'viewer');
            });
          } else {
            setDevices([]);
            setSelectedDevice(null);
            AsyncStorage.removeItem('helmetId');
            AsyncStorage.removeItem('helmetName');
            AsyncStorage.removeItem('helmetRole');
          }
          setIsLoading(false);
        });
      };

      loadProfileAndDevices();
      return () => { isMounted = false; };
    }, [])
  );

  useEffect(() => {
    if (!selectedDevice) return;

    const deviceRef = ref(realtimeDB, `Devices/${selectedDevice.id}/telemetry`);
    const unsubscribe = onValue(deviceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) processTelemetryData(data);
    });

    return unsubscribe;
  }, [selectedDevice]);
  // =========================================================================
  // Xá»¬ LÃ Dá»® LIá»†U TELEMETRY (Cáº¬P NHáº¬T CHART 30 ÄIá»‚M)
  // =========================================================================
  const processTelemetryData = (data: any) => {
    const currentAlcoholRaw = Number(data.alcohol_raw ?? data.alcoholRaw ?? 0);
    const alcoholDetected = data.alcohol_detected === true || data.alcohol_detected === 1;
    const accelMagG = Number(data.accel_mag_g ?? data.accelMagG ?? 0);
    const gyroMagDps = Number(data.gyro_mag_dps ?? data.gyroMagDps ?? 0);
    const isFall = data.is_falling === true || data.fall === 1;
    const isSos = data.is_sos_pressed === true || data.sos === 1;
    const isLocked = data.is_locked !== false && data.lock !== 0;

    setHelmetData({
      status: {
        alcohol_raw: currentAlcoholRaw,
        alcohol_detected: alcoholDetected,
        accel_mag_g: accelMagG,
        gyro_mag_dps: gyroMagDps,
        fall_accident_alert: isFall,
        is_sos_pressed: isSos,
        is_locked: isLocked,
      },
      current_location: {
        lat: Number(data.lat) || 10.8231,
        lng: Number(data.lng) || 106.6297,
      },
    });

    // Cáº­p nháº­t 30 Ä‘iá»ƒm
    setAlcoholRawHistory((prev) => [...prev.slice(1), currentAlcoholRaw]);
    setAccelHistory((prev) => [...prev.slice(1), accelMagG]);
    setGyroHistory((prev) => [...prev.slice(1), gyroMagDps]);

    if (alcoholDetected && !prevAlcoholRef.current) {
      triggerSystemNotification('ðŸš¨ Cáº¢NH BÃO Ná»’NG Äá»˜ Cá»’N!', `Ná»“ng Ä‘á»™ cá»“n vÆ°á»£t má»©c! Xe Ä‘Ã£ bá»‹ khÃ³a tá»± Ä‘á»™ng.`);
      Alert.alert('ðŸš¨ PHÃT HIá»†N Ná»’NG Äá»˜ Cá»’N', `Alcohol Raw: ${currentAlcoholRaw}!\nRelay xe Ä‘Ã£ ngáº¯t.`);
    }
    prevAlcoholRef.current = alcoholDetected;

    if (isFall && !prevFallRef.current) {
      triggerSystemNotification('âš ï¸ BÃO Äá»˜NG TAI Náº N!', 'PhÃ¡t hiá»‡n mÅ© báº£o hiá»ƒm bá»‹ va cháº¡m máº¡nh!');
      Alert.alert('âš  BÃO Äá»˜NG TAI Náº N', 'PhÃ¡t hiá»‡n nÃ³n bá»‹ va Ä‘áº­p máº¡nh hoáº·c tÃ© ngÃ£!');
    }
    prevFallRef.current = isFall;
  };

  // =========================================================================
  const showDeviceLinkUnderDevelopment = () => {
    Alert.alert(
      '\u0110ang ph\u00e1t tri\u1ec3n',
      'Ch\u1ee9c n\u0103ng li\u00ean k\u1ebft thi\u1ebft b\u1ecb s\u1ebd c\u00f3 trong phi\u00ean b\u1ea3n sau.',
    );
  };

  const showControlUnderDevelopment = () => {
    Alert.alert(
      '\u0110ang ph\u00e1t tri\u1ec3n',
      'Ch\u1ee9c n\u0103ng \u0111i\u1ec1u khi\u1ec3n xe \u0111ang \u0111\u01b0\u1ee3c ph\u00e1t tri\u1ec3n.',
    );
  };
  const openGoogleMaps = () => {
    if (helmetData.current_location.lat !== 0) {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${helmetData.current_location.lat},${helmetData.current_location.lng}`
      );
    } else {
      Alert.alert('ThÃ´ng bÃ¡o', 'ChÆ°a cÃ³ tá»a Ä‘á»™ GPS.');
    }
  };

  const theme = {
    bg: isDark ? '#121212' : '#F5F5F5',
    card: isDark ? '#1E1E1E' : '#FFF',
    text: isDark ? '#FFF' : '#1A1A1A',
    subText: isDark ? '#AAA' : '#666',
    chartBg: isDark ? '#1E1E1E' : '#FFF',
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {devices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="shield-outline" size={60} color="#007AFF" />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>ChÆ°a cÃ³ thiáº¿t bá»‹ nÃ o</Text>

          <TouchableOpacity style={styles.linkDeviceBigBtn} onPress={showDeviceLinkUnderDevelopment}>
            <Ionicons name="add-circle" size={22} color="white" />
            <Text style={styles.linkDeviceText}>LIÃŠN Káº¾T NÃ“N NGAY</Text>
          </TouchableOpacity>

        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.headerTitle, { color: theme.text, marginBottom: 0 }]}>Há»† THá»NG GIÃM SÃT</Text>
            {isOwner && (

              <TouchableOpacity onPress={showControlUnderDevelopment}>
                <Ionicons name="bluetooth-outline" size={26} color="#AAA" />
              </TouchableOpacity>

            )}
          </View>

          <View style={styles.roleBadgeContainer}>
            <View style={[styles.roleBadge, { backgroundColor: isOwner ? '#E8F5E9' : '#FFF3E0' }]}>
              <Ionicons name={isOwner ? 'key' : 'eye'} size={16} color={isOwner ? '#4CAF50' : '#FF9800'} />
              <Text style={[styles.roleText, { color: isOwner ? '#4CAF50' : '#FF9800' }]}>
                {isOwner ? ' Quy\u1ec1n Ch\u1ee7 xe (\u0110ang Offline)' : ' Quy\u1ec1n Ng\u01b0\u1eddi theo d\u00f5i (Ch\u1ec9 xem)'}
              </Text>
            </View>
          </View>

          <View style={styles.deviceSelectorContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowButtons}>
              {devices.map((dev) => {
                const isActive = selectedDevice?.id === dev.id;
                return (
                  <TouchableOpacity
                    key={dev.id}
                    style={[styles.deviceBtn, { backgroundColor: theme.card, borderColor: isActive ? dev.color || '#007AFF' : '#555' }, isActive && { backgroundColor: dev.color || '#1A1A1A' }]}
                    onPress={() => { setSelectedDevice(dev); AsyncStorage.setItem('helmetId', dev.id); }}
                  >
                    <Ionicons name="hardware-chip-outline" size={18} color={isActive ? 'white' : theme.text} />
                    <Text style={[styles.deviceBtnText, { color: theme.text }, isActive && styles.deviceBtnTextActive]}>{dev.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 1. Äá»’ THá»Š ALCOHOL RAW (30 ÄIá»‚M) */}
          <TelemetryCharts
            status={helmetData.status}
            alcoholHistory={alcoholRawHistory}
            accelHistory={accelHistory}
            gyroHistory={gyroHistory}
            isDark={isDark}
            theme={theme}
          />

          <View style={styles.actionBtnGrid}>
            <View style={styles.actionBtnRow}>

              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: !isOwner ? '#B0BEC5' : '#4CAF50', flex: 1 }]} onPress={showControlUnderDevelopment} activeOpacity={0.8}>
                <Ionicons name="lock-open" size={17} color="white" />
                <Text style={styles.actionText}>Má»ž KHÃ“A (0x01)</Text>
              </TouchableOpacity>


              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: !isOwner ? '#B0BEC5' : '#607D8B', flex: 1 }]} onPress={showControlUnderDevelopment} activeOpacity={0.8}>
                <Ionicons name="lock-closed" size={17} color="white" />
                <Text style={styles.actionText}>KHÃ“A XE (0x00)</Text>
              </TouchableOpacity>

            </View>
            <View style={styles.actionBtnRow}>

              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FF9800', flex: 1 }]} onPress={openGoogleMaps} activeOpacity={0.8}>
                <Ionicons name="navigate" size={17} color="white" />
                <Text style={styles.actionText}>Vá»Š TRÃ GPS</Text>
              </TouchableOpacity>


              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: !isOwner ? '#B0BEC5' : '#D32F2F', flex: 1 }]} onPress={showControlUnderDevelopment} activeOpacity={0.8}>
                <Ionicons name="warning-outline" size={17} color="white" />
                <Text style={styles.actionText}>KHáº¨N Cáº¤P (0x02)</Text>
              </TouchableOpacity>

            </View>
          </View>
        </ScrollView>
      )}



    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContainer: { padding: 16, paddingBottom: 40 },
  headerTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  roleBadgeContainer: { alignItems: 'center', marginBottom: 15 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  roleText: { fontWeight: 'bold', fontSize: 13, marginLeft: 5 },
  deviceSelectorContainer: { marginBottom: 15 },
  rowButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deviceBtn: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 2, borderWidth: 1 },
  deviceBtnText: { fontWeight: 'bold', fontSize: 13, marginLeft: 5 },
  deviceBtnTextActive: { color: 'white' },
  actionBtnGrid: { flexDirection: 'column', gap: 10 },
  actionBtnRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  actionBtn: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, alignItems: 'center', elevation: 3 },
  actionText: { color: 'white', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  emptyIconCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#EAF3FF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 5 },
  emptyDesc: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  linkDeviceBigBtn: { backgroundColor: '#007AFF', flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 25, borderRadius: 14, marginTop: 25, gap: 8, elevation: 3 },
  linkDeviceText: { color: 'white', fontSize: 15, fontWeight: 'bold' },

});

