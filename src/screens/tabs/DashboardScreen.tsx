import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { get, onValue, push, ref, runTransaction, set, update } from 'firebase/database';
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
import { isPrivateMode } from '../../config/privacyConfig';
import TelemetryCharts from '../../components/home/TelemetryCharts';
import BleDeviceModal from '../../components/home/BleDeviceModal';
import DeviceLinkModal from '../../components/home/DeviceLinkModal';
import useHelmetBle from '../../hooks/useHelmetBle';


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
  role: 'owner' | 'viewer';
};

type TelemetrySource = 'firebase' | 'bluetooth' | 'relay' | 'waiting';

// Cấu hình chart 30 điểm
const CHART_POINTS = 30;
const FIREBASE_STALE_MS = 20000;
const emptyChartData = Array(CHART_POINTS).fill(0);
const emptyAccelData = Array(CHART_POINTS).fill(1); // Gia tốc mặc định 1g
// Label chỉ hiện 2 điểm đầu cuối cho gọn

async function readTelemetryLocationOnEvent(deviceId: string) {
  const telemetryPath = `Devices/${deviceId}/telemetry`;
  const [latitudeSnapshot, longitudeSnapshot, gpsFixSnapshot] = await Promise.all([
    get(ref(realtimeDB, `${telemetryPath}/lat`)),
    get(ref(realtimeDB, `${telemetryPath}/lng`)),
    get(ref(realtimeDB, `${telemetryPath}/gps_fix`)),
  ]);
  const latitude = Number(latitudeSnapshot.val());
  const longitude = Number(longitudeSnapshot.val());
  const gpsFix = gpsFixSnapshot.val();

  if (
    gpsFix === false ||
    gpsFix === 0 ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }

  return { lat: latitude, lng: longitude };
}

export default function DashboardScreen() {
  const [isDark, setIsDark] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [userUid, setUserUid] = useState('');
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<UserDevice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLinkModalVisible, setIsLinkModalVisible] = useState(false);
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [telemetrySource, setTelemetrySource] = useState<TelemetrySource>('waiting');

  const [helmetData, setHelmetData] = useState({
    status: { alcohol_raw: 0, alcohol_detected: false, accel_mag_g: 1, gyro_mag_dps: 0, fall_accident_alert: false, is_sos_pressed: false, is_locked: true },
    current_location: isPrivateMode ? { lat: 0, lng: 0 } : { lat: 10.8231, lng: 106.6297 },
  });

  const [alcoholRawAvailable, setAlcoholRawAvailable] = useState(!isPrivateMode);
  const [alcoholRawHistory, setAlcoholRawHistory] = useState([...emptyChartData]);
  const [accelHistory, setAccelHistory] = useState([...emptyAccelData]);
  const [gyroHistory, setGyroHistory] = useState([...emptyChartData]);

  const prevAlcoholRef = useRef<boolean>(false);
  const prevFallRef = useRef<boolean>(false);
  const lastFirebaseUpdateRef = useRef(0);
  const previousSelectedDeviceIdRef = useRef<string | null>(null);
  const processTelemetryRef = useRef<(data: any, source: TelemetrySource, isLiveBleSample?: boolean) => void>(() => undefined);

  const handleBleTelemetry = useCallback((data: Record<string, unknown>) => {
    const firebaseIsFresh = Date.now() - lastFirebaseUpdateRef.current < FIREBASE_STALE_MS;
    if (firebaseIsFresh) return;
    processTelemetryRef.current(data, 'bluetooth', true);
  }, []);
  const ble = useHelmetBle(handleBleTelemetry);

  useEffect(() => {
    const nextDeviceId = selectedDevice?.id ?? null;
    const previousDeviceId = previousSelectedDeviceIdRef.current;
    if (previousDeviceId && nextDeviceId !== previousDeviceId && ble.connectedDevice) {
      void ble.disconnect();
    }
    previousSelectedDeviceIdRef.current = nextDeviceId;
  }, [selectedDevice?.id, ble.connectedDevice, ble.disconnect]);

  const isOwner = selectedDevice?.role === 'owner';

  // =========================================================================
  useEffect(() => {
    async function requestPermissions() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (Platform.OS === 'android' && status === 'granted') {
        await Notifications.setNotificationChannelAsync('smart_helmet_alerts', {
          name: 'Cảnh báo Smart Helmet',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    }
    requestPermissions();
  }, []);

  useEffect(() => onValue(ref(realtimeDB, '.info/connected'), (snapshot) => {
    setIsFirebaseConnected(snapshot.val() === true);
  }), []);

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
    if (!selectedDevice) {
      setTelemetrySource('waiting');
      lastFirebaseUpdateRef.current = 0;
      return;
    }

    lastFirebaseUpdateRef.current = 0;
    const telemetryPath = `Devices/${selectedDevice.id}/telemetry`;
    const processCloudSnapshot = (data: Record<string, unknown> | null) => {
      if (!data) return;

      const rawTimestamp = Number(data.last_update ?? data.updated_at ?? 0);
      const timestamp = rawTimestamp > 0 && rawTimestamp < 1_000_000_000_000
        ? rawTimestamp * 1000
        : rawTimestamp;
      const helmetReportsWifiConnected = data.wifi_connected === true || data.wifi_connected === 1;
      const helmetReportsFirebaseConnected = data.firebase_connected === true || data.firebase_connected === 1;

      if (data.source === 'ble_fallback' && !helmetReportsWifiConnected && !helmetReportsFirebaseConnected) {
        const relayDataIsStale = timestamp > 0 && Date.now() - timestamp > FIREBASE_STALE_MS;
        if (relayDataIsStale) {
          lastFirebaseUpdateRef.current = 0;
          setTelemetrySource('waiting');
        } else if (!ble.connectedDevice) {
          lastFirebaseUpdateRef.current = Date.now();
          processTelemetryRef.current(data, 'relay');
        } else {
          lastFirebaseUpdateRef.current = 0;
        }
        return;
      }

      const helmetReportsNoWifi = data.wifi_connected === false || data.wifi_connected === 0;
      const helmetReportsNoFirebase = data.firebase_connected === false || data.firebase_connected === 0;
      const cloudDataIsStale = helmetReportsNoWifi || helmetReportsNoFirebase ||
        (timestamp > 0 && Date.now() - timestamp > FIREBASE_STALE_MS);

      if (cloudDataIsStale) {
        lastFirebaseUpdateRef.current = 0;
        setTelemetrySource('waiting');
        return;
      }

      lastFirebaseUpdateRef.current = Date.now();
      processTelemetryRef.current(data, 'firebase');
    };

    if (!isPrivateMode) {
      const unsubscribe = onValue(ref(realtimeDB, telemetryPath), (snapshot) => {
        const data = snapshot.val();
        if (!data || typeof data !== 'object') return;
        processCloudSnapshot(data as Record<string, unknown>);
      });
      return unsubscribe;
    }

    // RTDB listeners are per path. Read only the live status fields in private
    // mode so neither alcohol_raw nor the continuous GPS fields are downloaded.
    const privateTelemetryFields = [
      'last_update',
      'updated_at',
      'wifi_connected',
      'firebase_connected',
      'source',
      'alcohol_detected',
      'accel_mag_g',
      'gyro_mag_dps',
      'is_falling',
      'fall',
      'is_sos_pressed',
      'sos',
      'is_locked',
      'lock',
    ];
    const telemetryData: Record<string, unknown> = {};
    const initializedFields = new Set<string>();
    const unsubscribeFields = privateTelemetryFields.map((field) =>
      onValue(ref(realtimeDB, `${telemetryPath}/${field}`), (snapshot) => {
        const value = snapshot.val();
        if (value === null) delete telemetryData[field];
        else telemetryData[field] = value;
        initializedFields.add(field);
        if (initializedFields.size === privateTelemetryFields.length) {
          processCloudSnapshot({ ...telemetryData });
        }
      }),
    );

    return () => unsubscribeFields.forEach((unsubscribe) => unsubscribe());
  }, [selectedDevice, ble.connectedDevice]);
  // =========================================================================
  // XỬ LÝ DỮ LIỆU TELEMETRY (CẬP NHẬT CHART 30 ĐIỂM)
  // =========================================================================
  const processTelemetryData = (data: any, source: TelemetrySource, isLiveBleSample = false) => {
    const rawAlcoholValue = data.alcohol_raw ?? data.alcoholRaw;
    const currentAlcoholRaw = rawAlcoholValue == null ? 0 : Number(rawAlcoholValue);
    const hasAlcoholRaw = !isPrivateMode;
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
      current_location: isPrivateMode
        ? helmetData.current_location
        : {
            lat: Number(data.lat) || 10.8231,
            lng: Number(data.lng) || 106.6297,
          },
    });
    setAlcoholRawAvailable(hasAlcoholRaw);
    setTelemetrySource(source);

    // Cập nhật 30 điểm
    setAlcoholRawHistory((prev) =>
      hasAlcoholRaw ? [...prev.slice(1), currentAlcoholRaw] : [...emptyChartData],
    );
    setAccelHistory((prev) => [...prev.slice(1), accelMagG]);
    setGyroHistory((prev) => [...prev.slice(1), gyroMagDps]);

    if (source === 'bluetooth' && isLiveBleSample && isOwner && selectedDevice && isFirebaseConnected) {
      const timestamp = Date.now();
      const relayData = {
        ...(!isPrivateMode ? { alcohol_raw: currentAlcoholRaw } : {}),
        alcohol_detected: alcoholDetected,
        accel_mag_g: accelMagG,
        gyro_mag_dps: gyroMagDps,
        is_falling: isFall,
        is_sos_pressed: isSos,
        ...(!isPrivateMode
          ? {
              lat: Number(data.lat ?? 0),
              lng: Number(data.lng ?? 0),
              gps_fix: data.gps_fix === true,
              satellites: Number(data.satellites ?? 0),
            }
          : {}),
        helmet_connected: data.helmet_connected === true,
        lock: isLocked,
        is_locked: isLocked,
        source: 'ble_fallback',
        last_update: timestamp,
      };
      void update(ref(realtimeDB, `Devices/${selectedDevice.id}/telemetry`), relayData).catch(() => undefined);

      if (alcoholDetected && !prevAlcoholRef.current) {
        void pushIncidentEvent(
          'Cảnh báo nồng độ cồn',
          'MQ-3',
          'high',
          hasAlcoholRaw ? { value: currentAlcoholRaw } : {},
        ).catch(() => undefined);
      }
    }

    if (alcoholDetected && !prevAlcoholRef.current) {
      triggerSystemNotification('🚨 CẢNH BÁO NỒNG ĐỘ CỒN!', `Nồng độ cồn vượt mức! Xe đã bị khóa tự động.`);
      Alert.alert(
        '🚨 PHÁT HIỆN NỒNG ĐỘ CỒN',
        hasAlcoholRaw
          ? `Alcohol Raw: ${currentAlcoholRaw}!\nRelay xe đã ngắt.`
          : 'Nồng độ cồn vượt ngưỡng. Relay xe đã ngắt.',
      );
    }
    prevAlcoholRef.current = alcoholDetected;

    if (isFall && !prevFallRef.current) {
      triggerSystemNotification('⚠️ BÁO ĐỘNG TAI NẠN!', 'Phát hiện mũ bảo hiểm bị va chạm mạnh!');
      Alert.alert('⚠ BÁO ĐỘNG TAI NẠN', 'Phát hiện nón bị va đập mạnh hoặc té ngã!');
      const isOwnerBleEvent =
        source === 'bluetooth' && isLiveBleSample && isOwner && selectedDevice && isFirebaseConnected;
      if (isPrivateMode && selectedDevice && isFirebaseConnected) {
        void readTelemetryLocationOnEvent(selectedDevice.id).then((location) => {
          if (location) {
            setHelmetData((current) => ({ ...current, current_location: location }));
          }
          if (isOwnerBleEvent) {
            return pushIncidentEvent(
              'Phát hiện té ngã / va đập',
              'MPU6050',
              'high',
              {},
              location ?? undefined,
            );
          }
        }).catch(() => undefined);
      } else if (isOwnerBleEvent) {
        void pushIncidentEvent('Phát hiện té ngã / va đập', 'MPU6050', 'high').catch(() => undefined);
      }
    }
    prevFallRef.current = isFall;
  };
  processTelemetryRef.current = processTelemetryData;

  useEffect(() => {
    if (ble.connectedDevice || telemetrySource !== 'bluetooth') return;
    setTelemetrySource('waiting');
  }, [ble.connectedDevice, telemetrySource]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (
        (telemetrySource === 'firebase' || telemetrySource === 'relay') &&
        lastFirebaseUpdateRef.current > 0 &&
        Date.now() - lastFirebaseUpdateRef.current > FIREBASE_STALE_MS
      ) {
        setTelemetrySource('waiting');
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [telemetrySource]);

  const handleAddNewDevice = async (deviceId: string, deviceName: string) => {
    const id = deviceId.trim();
    const name = deviceName.trim() || id;
    const currentUser = auth.currentUser;
    const currentUid = currentUser?.uid || userUid;

    const hasInvalidFirebaseKeyCharacter = ['.', '#', '$', '[', ']', '/'].some((character) => id.includes(character));
    if (!id || hasInvalidFirebaseKeyCharacter) {
      Alert.alert('Mã nón không hợp lệ', 'Mã không được chứa các ký tự . # $ [ ] hoặc /.');
      return;
    }
    if (!currentUid) {
      Alert.alert('Chưa đăng nhập', 'Vui lòng đăng nhập lại rồi thử liên kết nón.');
      return;
    }

    try {
      setIsAddingDevice(true);
      const ownerRef = ref(realtimeDB, `Devices/${id}/info/owner_uid`);
      const ownerTransaction = await runTransaction(ownerRef, (currentOwnerUid) => currentOwnerUid || currentUid);
      const ownerUid = ownerTransaction.snapshot.val() as string | null;
      const role: UserDevice['role'] = ownerUid === currentUid ? 'owner' : 'viewer';
      const now = Date.now();
      const updates: Record<string, unknown> = {
        [`Users/${currentUid}/devices/${id}`]: {
          name,
          color: id === 'Helmet_001' ? '#007AFF' : '#34C759',
          role,
          added_at: now,
        },
      };

      if (role === 'viewer') {
        updates[`Devices/${id}/viewers/${currentUid}`] = {
          email: currentUser?.email || currentUserEmail || '',
          name: currentUser?.displayName || '',
          added_at: now,
        };
      }

      await update(ref(realtimeDB), updates);
      setIsLinkModalVisible(false);
      Alert.alert(
        role === 'owner' ? 'Liên kết thành công' : 'Đã tham gia theo dõi',
        role === 'owner'
          ? `Bạn là Chủ xe của ${name}.`
          : `${name} đã có chủ, tài khoản của bạn được cấp quyền chỉ xem.`,
      );
    } catch {
      Alert.alert('Lỗi', 'Không thể liên kết thiết bị. Hãy kiểm tra mã nón và kết nối Firebase.');
    } finally {
      setIsAddingDevice(false);
    }
  };

  const pushIncidentEvent = async (
    type: string,
    sensor: string,
    severity: string,
    extraData: Record<string, unknown> = {},
    eventLocation?: { lat: number; lng: number },
  ) => {
    if (!selectedDevice || !isFirebaseConnected) return;
    const eventRef = push(ref(realtimeDB, `Events/${selectedDevice.id}`));
    const location = eventLocation ?? (isPrivateMode ? undefined : helmetData.current_location);
    await set(eventRef, {
      type,
      sensor,
      severity,
      ...(location ? { lat: location.lat, lng: location.lng } : {}),
      timestamp: Date.now(),
      ...extraData,
    });
  };

  const sendControlCommand = async (command: number, commandName: string) => {
    if (!selectedDevice) return false;
    if (!ble.connectedDevice) {
      Alert.alert('Chưa kết nối Bluetooth', 'Hãy kết nối với Helmet Node ở biểu tượng Bluetooth trước.');
      return false;
    }

    try {
      await ble.sendCommand(command);
      Alert.alert('Đã gửi lệnh', `Lệnh ${commandName} đã được gửi tới Helmet Node.`);
      if (isFirebaseConnected) {
        try {
          await update(ref(realtimeDB, `Devices/${selectedDevice.id}/control`), {
            lock: command === 0x00,
            emergency_unlock: command === 0x02,
            last_command: command,
            last_command_at: Date.now(),
          });
        } catch {
          // BLE control remains successful if the cloud is unreachable during fallback mode.
        }
      }
      return true;
    } catch {
      Alert.alert('Lỗi Bluetooth', 'Không thể gửi lệnh tới Helmet Node. Hãy kết nối lại rồi thử lại.');
      return false;
    }
  };

  const handleLockCommand = () => {
    if (!isOwner) {
      Alert.alert('Từ chối quyền', 'Chỉ Chủ xe mới có quyền khóa xe.');
      return;
    }
    Alert.alert('Khóa xe an toàn', `Ngắt động cơ xe ${selectedDevice?.name}?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đồng ý', style: 'destructive', onPress: () => void sendControlCommand(0x00, 'khóa xe') },
    ]);
  };

  const handleUnlockCommand = () => {
    if (!isOwner) {
      Alert.alert('Từ chối quyền', 'Chỉ Chủ xe mới có quyền mở khóa xe.');
      return;
    }
    if (helmetData.status.alcohol_detected) {
      Alert.alert('Từ chối khởi động', 'Phát hiện có cồn. Không thể mở khóa xe an toàn.');
      return;
    }
    Alert.alert('Mở khóa xe', `Cho phép khởi động xe ${selectedDevice?.name}?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đồng ý', onPress: () => void sendControlCommand(0x01, 'mở khóa an toàn') },
    ]);
  };

  const handleEmergencyUnlock = () => {
    if (!isOwner) {
      Alert.alert('Từ chối quyền', 'Chỉ Chủ xe mới có quyền mở khóa khẩn cấp.');
      return;
    }
    Alert.alert(
      'Cảnh báo mở khẩn cấp',
      'Lệnh này bỏ qua trạng thái an toàn của nón. Bạn xác nhận chịu trách nhiệm?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận mở',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const commandSent = await sendControlCommand(0x02, 'mở khẩn cấp');
              if (!commandSent) return;
              try {
                await pushIncidentEvent('Kích hoạt mở xe khẩn cấp', 'BLE App', 'critical', {
                  note: 'Bỏ qua tín hiệu nón',
                });
              } catch {
                // Keep the local BLE fallback usable when Firebase is offline.
              }
            })();
          },
        },
      ],
    );
  };
  const openGoogleMaps = () => {
    if (helmetData.current_location.lat !== 0) {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${helmetData.current_location.lat},${helmetData.current_location.lng}`
      );
    } else {
      Alert.alert('Thông báo', 'Chưa có tọa độ GPS.');
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
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Chưa có thiết bị nào</Text>

          <TouchableOpacity style={styles.linkDeviceBigBtn} onPress={() => setIsLinkModalVisible(true)}>
            <Ionicons name="add-circle" size={22} color="white" />
            <Text style={styles.linkDeviceText}>LIÊN KẾT NÓN NGAY</Text>
          </TouchableOpacity>

        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.headerTitle, { color: theme.text, marginBottom: 0 }]}>HỆ THỐNG GIÁM SÁT</Text>
            {isOwner && (

              <TouchableOpacity
                onPress={() => {
                  if (ble.connectedDevice) {
                    Alert.alert('Bluetooth đang kết nối', `Đã kết nối ${ble.connectedDevice.name || 'Helmet Node'}.`, [
                      { text: 'Đóng', style: 'cancel' },
                      { text: 'Ngắt kết nối', style: 'destructive', onPress: () => void ble.disconnect() },
                    ]);
                  } else {
                    void ble.startScan();
                  }
                }}
                disabled={ble.isConnecting}
              >
                {ble.isConnecting ? (
                  <ActivityIndicator size="small" color="#FF9800" />
                ) : (
                  <Ionicons
                    name={ble.connectedDevice ? 'bluetooth' : 'bluetooth-outline'}
                    size={26}
                    color={ble.connectedDevice ? '#4CAF50' : '#AAA'}
                  />
                )}
              </TouchableOpacity>

            )}
          </View>

          <View style={styles.roleBadgeContainer}>
            <View style={[styles.roleBadge, { backgroundColor: isOwner ? '#E8F5E9' : '#FFF3E0' }]}>
              <Ionicons name={isOwner ? 'key' : 'eye'} size={16} color={isOwner ? '#4CAF50' : '#FF9800'} />
              <Text style={[styles.roleText, { color: isOwner ? '#4CAF50' : '#FF9800' }]}>
                {isOwner ? ' Quy\u1ec1n Ch\u1ee7 xe (\u0110i\u1ec1u khi\u1ec3n)' : ' Quy\u1ec1n Ng\u01b0\u1eddi theo d\u00f5i (Ch\u1ec9 xem)'}
              </Text>
            </View>
          </View>

          <View style={styles.sourceBadge}>
            <Ionicons
              name={telemetrySource === 'bluetooth' ? 'bluetooth' : telemetrySource === 'firebase' ? 'cloud-done-outline' : 'cloud-offline-outline'}
              size={14}
              color={telemetrySource === 'bluetooth' ? '#007AFF' : telemetrySource === 'firebase' ? '#2E7D32' : '#888'}
            />
            <Text style={[styles.sourceText, { color: theme.subText }]}>
              {telemetrySource === 'bluetooth'
                ? 'Dữ liệu trực tiếp qua Bluetooth (dự phòng)'
                : telemetrySource === 'firebase'
                  ? 'Dữ liệu trực tuyến từ Firebase'
                  : telemetrySource === 'relay'
                    ? 'Dữ liệu Bluetooth đã được APP đồng bộ lên Firebase'
                    : 'Đang chờ dữ liệu từ Firebase hoặc Bluetooth'}
            </Text>
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

          {/* 1. ĐỒ THỊ ALCOHOL RAW (30 ĐIỂM) */}
          <TelemetryCharts
            status={helmetData.status}
            alcoholRawAvailable={alcoholRawAvailable}
            alcoholHistory={alcoholRawHistory}
            accelHistory={accelHistory}
            gyroHistory={gyroHistory}
            isDark={isDark}
            theme={theme}
          />

          <View style={styles.actionBtnGrid}>
            <View style={styles.actionBtnRow}>

              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: !isOwner ? '#B0BEC5' : '#4CAF50', flex: 1 }]} onPress={handleUnlockCommand} activeOpacity={0.8}>
                <Ionicons name="lock-open" size={17} color="white" />
                <Text style={styles.actionText}>MỞ KHÓA (0x01)</Text>
              </TouchableOpacity>


              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: !isOwner ? '#B0BEC5' : '#607D8B', flex: 1 }]} onPress={handleLockCommand} activeOpacity={0.8}>
                <Ionicons name="lock-closed" size={17} color="white" />
                <Text style={styles.actionText}>KHÓA XE (0x00)</Text>
              </TouchableOpacity>

            </View>
            <View style={styles.actionBtnRow}>

              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FF9800', flex: 1 }]} onPress={openGoogleMaps} activeOpacity={0.8}>
                <Ionicons name="navigate" size={17} color="white" />
                <Text style={styles.actionText}>VỊ TRÍ GPS</Text>
              </TouchableOpacity>


              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: !isOwner ? '#B0BEC5' : '#D32F2F', flex: 1 }]} onPress={handleEmergencyUnlock} activeOpacity={0.8}>
                <Ionicons name="warning-outline" size={17} color="white" />
                <Text style={styles.actionText}>KHẨN CẤP (0x02)</Text>
              </TouchableOpacity>

            </View>
          </View>
        </ScrollView>
      )}

      <DeviceLinkModal
        visible={isLinkModalVisible}
        saving={isAddingDevice}
        theme={theme}
        onSave={handleAddNewDevice}
        onClose={() => setIsLinkModalVisible(false)}
      />
      <BleDeviceModal
        visible={ble.isDeviceModalVisible}
        devices={ble.scannedDevices}
        scanning={ble.isScanning}
        connecting={ble.isConnecting}
        error={ble.error}
        theme={theme}
        onConnect={(device) => void ble.connectToDevice(device)}
        onScan={() => void ble.startScan()}
        onClose={ble.closeDeviceModal}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContainer: { padding: 16, paddingBottom: 40 },
  headerTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  roleBadgeContainer: { alignItems: 'center', marginBottom: 15 },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, marginTop: -7, marginBottom: 14 },
  sourceText: { fontSize: 12 },
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

