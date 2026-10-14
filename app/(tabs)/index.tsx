import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { PermissionsAndroid, Platform, AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { get, onValue, push, ref, set, update } from 'firebase/database';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, realtimeDB } from '../../src/config/firebaseConfig';
import { BleManager, Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

const screenWidth = Dimensions.get('window').width;

const BLE_SERVICE_UUID = '0000FFE0-0000-1000-8000-00805F9B34FB';
const BLE_CMD_UUID = '0000FFE1-0000-1000-8000-00805F9B34FB';
const BLE_TELEMETRY_UUID = '0000FFE2-0000-1000-8000-00805F9B34FB';

const bleManager = new BleManager();

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

// Cấu hình chart 30 điểm
const CHART_POINTS = 30;
const emptyChartData = Array(CHART_POINTS).fill(0);
const emptyAccelData = Array(CHART_POINTS).fill(1); // Gia tốc mặc định 1g
// Label chỉ hiện 2 điểm đầu cuối cho gọn
const chartLabels = Array(CHART_POINTS).fill('');
chartLabels[0] = '-30s';
chartLabels[CHART_POINTS - 1] = 'Now';

export default function DashboardScreen() {
  const [isDark, setIsDark] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [userUid, setUserUid] = useState('');
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<UserDevice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- BLE STATES ---
  const [connectedBleDevice, setConnectedBleDevice] = useState<Device | null>(null);
  const [isScanningBle, setIsScanningBle] = useState(false);
  const [isConnectingBle, setIsConnectingBle] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<Device[]>([]);
  const [scanModalVisible, setScanModalVisible] = useState(false);

  const bleMonitorRef = useRef<any>(null);
  const bleDisconnectRef = useRef<any>(null);
  const bleConnectingRef = useRef(false);
  const appState = useRef(AppState.currentState);

  const [helmetData, setHelmetData] = useState({
    status: { alcohol_raw: 0, alcohol_detected: false, accel_mag_g: 1, gyro_mag_dps: 0, fall_accident_alert: false, is_sos_pressed: false, is_locked: true },
    current_location: { lat: 10.8231, lng: 106.6297 },
  });

  const [alcoholRawHistory, setAlcoholRawHistory] = useState([...emptyChartData]);
  const [accelHistory, setAccelHistory] = useState([...emptyAccelData]);
  const [gyroHistory, setGyroHistory] = useState([...emptyChartData]);

  const prevAlcoholRef = useRef<boolean>(false);
  const prevFallRef = useRef<boolean>(false);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const isOwner = selectedDevice?.role === 'owner';

  // =========================================================================
  // APP STATE HANDLER: Phục hồi BLE khi quay lại từ Google Maps
  // =========================================================================
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App quay lại Foreground -> Kiểm tra trạng thái BLE');
        if (connectedBleDevice) {
          try {
            const isConn = await connectedBleDevice.isConnected();
            if (!isConn) {
              console.log('Phát hiện mất kết nối BLE trong lúc Background');
              handleBleDisconnectCleanup();
            }
          } catch (e) {
            handleBleDisconnectCleanup();
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [connectedBleDevice]);

  // Hàm dọn dẹp dùng chung
  const handleBleDisconnectCleanup = () => {
    try { bleMonitorRef.current?.remove?.(); } catch {}
    bleMonitorRef.current = null;
    try { bleDisconnectRef.current?.remove?.(); } catch {}
    bleDisconnectRef.current = null;
    setConnectedBleDevice(null);
    bleConnectingRef.current = false;
    setIsConnectingBle(false);
  };

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

    return () => {
      console.log('Dashboard unmount: Dọn dẹp BLE listeners');
      try { bleManager.stopDeviceScan(); } catch {}
      handleBleDisconnectCleanup();
    };
  }, []);

  const triggerSystemNotification = async (title: string, body: string) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true, priority: Notifications.AndroidNotificationPriority.MAX },
        trigger: null,
      });
    } catch (e) {}
  };

  const pushIncidentEvent = async (type: string, sensor: string, severity: string, extraData: any = {}) => {
    if (!selectedDevice) return;
    try {
      const helmetId = selectedDevice.id;
      const eventsRef = ref(realtimeDB, `Events/${helmetId}`); 
      const newEvtRef = push(eventsRef);

      const payload = {
        type,
        sensor,
        severity,
        lat: helmetData.current_location.lat || 10.8231,
        lng: helmetData.current_location.lng || 106.6297,
        timestamp: Date.now(),
        ...extraData,
      };

      await set(newEvtRef, payload);
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

    let firebaseUnsubscribe = () => {};

    if (!isOwner) {
      const deviceRef = ref(realtimeDB, `Devices/${selectedDevice.id}/telemetry`);
      firebaseUnsubscribe = onValue(deviceRef, (snapshot) => {
        const data = snapshot.val();
        if (data) processTelemetryData(data, false);
      });
    }

    return () => {
      firebaseUnsubscribe();
    };
  }, [selectedDevice]);

  // =========================================================================
  // XỬ LÝ DỮ LIỆU TELEMETRY (CẬP NHẬT CHART 30 ĐIỂM)
  // =========================================================================
  const processTelemetryData = async (data: any, isFromLocal: boolean) => {
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

    // Cập nhật 30 điểm
    setAlcoholRawHistory((prev) => [...prev.slice(1), currentAlcoholRaw]);
    setAccelHistory((prev) => [...prev.slice(1), accelMagG]);
    setGyroHistory((prev) => [...prev.slice(1), gyroMagDps]);

    if (isFromLocal && selectedDevice) {
      try {
        const timestamp = Date.now();
        const telemetryRef = ref(realtimeDB, `Devices/${selectedDevice.id}/telemetry`);
        const firebaseTelemetry = {
          alcohol_raw: currentAlcoholRaw,
          alcohol_detected: alcoholDetected,
          accel_mag_g: accelMagG,
          gyro_mag_dps: gyroMagDps,
          is_falling: isFall,
          is_sos_pressed: isSos,
          lat: Number(data.lat ?? 0),
          lng: Number(data.lng ?? 0),
          gps_fix: data.gps_fix === true,
          satellites: Number(data.satellites ?? 0),
          helmet_connected: data.helmet_connected === true,
          lock: data.lock === true,
          is_locked: isLocked,
          last_update: timestamp,
        };

        await update(telemetryRef, firebaseTelemetry);

        if ((isFall && !prevFallRef.current) || (alcoholDetected && !prevAlcoholRef.current)) {
          await pushIncidentEvent(
            isFall ? 'Phát hiện té ngã / va đập' : 'Cảnh báo nồng độ cồn',
            isFall ? 'MPU6050' : 'MQ-3',
            'high',
            { value: currentAlcoholRaw }
          );
        }
      } catch (e) {
        console.log('>>> FIREBASE UPDATE ERROR <<<', e);
      }
    }

    if (alcoholDetected && !prevAlcoholRef.current) {
      triggerSystemNotification('🚨 CẢNH BÁO NỒNG ĐỘ CỒN!', `Nồng độ cồn vượt mức! Xe đã bị khóa tự động.`);
      Alert.alert('🚨 PHÁT HIỆN NỒNG ĐỘ CỒN', `Alcohol Raw: ${currentAlcoholRaw}!\nRelay xe đã ngắt.`);
    }
    prevAlcoholRef.current = alcoholDetected;

    if (isFall && !prevFallRef.current) {
      triggerSystemNotification('⚠️ BÁO ĐỘNG TAI NẠN!', 'Phát hiện mũ bảo hiểm bị va chạm mạnh!');
      Alert.alert('⚠ BÁO ĐỘNG TAI NẠN', 'Phát hiện nón bị va đập mạnh hoặc té ngã!');
    }
    prevFallRef.current = isFall;
  };

  // =========================================================================
  // BLE LUỒNG MỚI: QUÉT -> CHỌN -> KẾT NỐI
  // =========================================================================
  const startBleScan = async () => {
    if (isScanningBle || bleConnectingRef.current) return;

    if (Platform.OS === 'android') {
      try {
        const requested = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        const scanGranted = requested[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
        const connectGranted = requested[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
        const locationGranted = requested[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;

        const permissionsOk = Platform.Version >= 31 ? scanGranted && connectGranted : locationGranted;

        if (!permissionsOk) {
          Alert.alert('Chưa cấp quyền', 'Hãy cấp quyền Bluetooth cho ứng dụng rồi thử lại.');
          return;
        }
      } catch (e) {
        Alert.alert('Lỗi', 'Không thể kiểm tra quyền Bluetooth.');
        return;
      }
    }

    setScannedDevices([]);
    setScanModalVisible(true);
    setIsScanningBle(true);

    try { bleManager.stopDeviceScan(); } catch {}

    bleManager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        console.log('SCAN ERR:', error);
        return;
      }
      if (device && (device.name === 'SMART_BIKE_C3' || device.name === 'SMART_BIKE_S3')) {
        setScannedDevices(prev => {
          if (!prev.find(d => d.id === device.id)) return [...prev, device];
          return prev;
        });
      }
    });

    setTimeout(() => {
      try { bleManager.stopDeviceScan(); } catch {}
      setIsScanningBle(false);
    }, 10000);
  };

  const connectToBleDevice = async (device: Device) => {
    try { bleManager.stopDeviceScan(); } catch {}
    setIsScanningBle(false);
    setScanModalVisible(false);
    setIsConnectingBle(true);
    bleConnectingRef.current = true;

    try {
      console.log('BLE: Đang connect tới', device.id);
      const connected = await device.connect({ timeout: 10000 });

      if (Platform.OS === 'android') {
        try { await connected.requestMTU(247); } catch {}
      }

      await connected.discoverAllServicesAndCharacteristics();

      // Kiểm tra FFE1 và FFE2
      const chars = await connected.characteristicsForService(BLE_SERVICE_UUID);
      const telemetry = chars.find((c) => c.uuid.toLowerCase() === BLE_TELEMETRY_UUID.toLowerCase());
      const command = chars.find((c) => c.uuid.toLowerCase() === BLE_CMD_UUID.toLowerCase());

      if (!command || !telemetry) {
        throw new Error('Không tìm thấy đầy đủ cổng FFE1/FFE2');
      }

      handleBleDisconnectCleanup(); // Clear old listeners if any

      bleMonitorRef.current = connected.monitorCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_TELEMETRY_UUID,
        (monitorError, characteristic) => {
          if (monitorError || !characteristic?.value) return;
          try {
            const jsonStr = Buffer.from(characteristic.value, 'base64').toString('utf-8');
            const data = JSON.parse(jsonStr);
            processTelemetryData(data, true);
          } catch (e) {}
        },
      );

      bleDisconnectRef.current = connected.onDisconnected((error, disconnectedDevice) => {
        console.log('BLE Bị ngắt kết nối:', disconnectedDevice?.id);
        handleBleDisconnectCleanup();
      });

      setConnectedBleDevice(connected);
      console.log('>>> BLE READY & VERIFIED <<<');
    } catch (err) {
      console.log('BLE CONNECT LỖI:', err);
      try { await bleManager.cancelDeviceConnection(device.id); } catch {}
      handleBleDisconnectCleanup();
      Alert.alert('Kết nối thất bại', 'Không thể kết nối hoặc xác thực BikeNode.');
    } finally {
      setIsConnectingBle(false);
      bleConnectingRef.current = false;
    }
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

  const sendControlCommand = async (cmdHex: number, cmdName: string) => {
    if (!selectedDevice) return;
    
    if (!connectedBleDevice) {
      Alert.alert("MẤT KẾT NỐI", "Bạn cần kết nối Bluetooth với xe bằng nút ở góc trên bên phải.");
      return;
    }

    try {
      const base64Cmd = Buffer.from([cmdHex]).toString('base64');
      await connectedBleDevice.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID, 
        BLE_CMD_UUID, 
        base64Cmd
      );

      console.log(`Đã gửi lệnh BLE ${cmdName} (0x0${cmdHex}) xuống xe.`);

      await update(ref(realtimeDB, `Devices/${selectedDevice.id}/control`), {
        lock: cmdHex === 0x00,
        emergency_unlock: cmdHex === 0x02,
        last_command: cmdHex
      });
    } catch (e) {
      Alert.alert("LỖI", "Không thể gửi lệnh xuống mạch, vui lòng thử lại.");
    }
  };

  const handleLockCommand = async () => {
    if (!isOwner) {
      Alert.alert('TỪ CHỐI QUYỀN', 'Chỉ Chủ xe mới có quyền thao tác.');
      return;
    }
    Alert.alert('Khóa xe an toàn', `Ngắt động cơ xe ${selectedDevice?.name}?`, [
      { text: 'Hủy' }, { text: 'Đồng ý', onPress: () => sendControlCommand(0x00, "KHÓA XE") }
    ]);
  };

  const handleUnlockCommand = async () => {
    if (!isOwner) {
      Alert.alert('TỪ CHỐI QUYỀN', 'Chỉ Chủ xe mới có quyền mở xe.');
      return;
    }
    if (helmetData.status.alcohol_detected) {
      Alert.alert('TỪ CHỐI KHỞI ĐỘNG', `Phát hiện có cồn! Bạn không đủ điều kiện lái xe an toàn.`);
      return;
    }
    Alert.alert('Mở khóa xe', `Cho phép khởi động xe ${selectedDevice?.name} an toàn?`, [
      { text: 'Hủy' }, { text: 'Đồng ý', onPress: () => sendControlCommand(0x01, "MỞ AN TOÀN") }
    ]);
  };

  const handleEmergencyUnlock = async () => {
    if (!isOwner) return;
    Alert.alert('CẢNH BÁO MỞ KHẨN CẤP ⚠️', 'Mở khóa bỏ qua trạng thái nón bảo hiểm. Bạn cam kết chịu trách nhiệm an toàn.', [
      { text: 'HỦY BỎ', style: 'cancel' },
      { text: 'XÁC NHẬN MỞ', style: 'destructive', onPress: async () => {
          await sendControlCommand(0x02, "MỞ KHẨN CẤP");
          pushIncidentEvent('Kích hoạt mở xe khẩn cấp', 'BLE App', 'critical', { note: 'Bỏ qua tín hiệu nón' });
      }}
    ]);
  };

  const handleAddNewDevice = async () => {
    // ... Logic thêm thiết bị giữ nguyên như cũ
    const id = newDeviceId.trim();
    const name = newDeviceName.trim() || id;

    if (!id) {
      Alert.alert('Lỗi', 'Vui lòng nhập ID nón (Ví dụ: Helmet_001)');
      return;
    }

    const currentUid = auth.currentUser?.uid || userUid;
    if (!currentUid) return;

    try {
      setIsAdding(true);
      const ownerRef = ref(realtimeDB, `Devices/${id}/info/owner_uid`);
      const ownerSnap = await get(ownerRef);
      const ownerUidDb = ownerSnap.val();

      let assignedRole: 'owner' | 'viewer' = 'owner';
      if (ownerUidDb && ownerUidDb !== currentUid) {
        assignedRole = 'viewer';
      }

      const userDevRef = ref(realtimeDB, `Users/${currentUid}/devices/${id}`);
      await set(userDevRef, {
        name, color: id === 'Helmet_001' ? '#007AFF' : '#34C759', role: assignedRole, added_at: Date.now(),
      });

      if (assignedRole === 'owner') {
        await set(ownerRef, currentUid);
        Alert.alert('Thành công', `Bạn đã trở thành CHỦ XE của ${id}!`);
      } else {
        Alert.alert('Đã tham gia theo dõi', `Thiết bị ${id} đã có chủ. Bạn được cấp quyền theo dõi!`);
      }

      setAddModalVisible(false);
      setNewDeviceId('');
      setNewDeviceName('');
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể liên kết thiết bị.');
    } finally {
      setIsAdding(false);
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
          <TouchableOpacity style={styles.linkDeviceBigBtn} onPress={() => setAddModalVisible(true)}>
            <Ionicons name="add-circle" size={22} color="white" />
            <Text style={styles.linkDeviceText}>LIÊN KẾT NÓN NGAY</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Nút Kết nối Bluetooth thủ công (Cho Chủ Xe) */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.headerTitle, { color: theme.text, marginBottom: 0 }]}>HỆ THỐNG GIÁM SÁT</Text>
            {isOwner && (
              <TouchableOpacity onPress={connectedBleDevice ? () => Alert.alert('Đã kết nối', 'Bạn đang điều khiển xe trực tiếp') : startBleScan} disabled={isConnectingBle}>
                {isConnectingBle ? (
                  <ActivityIndicator size="small" color="#FF9800" />
                ) : (
                  <Ionicons name={connectedBleDevice ? "bluetooth" : "bluetooth-outline"} size={26} color={connectedBleDevice ? "#4CAF50" : "#AAA"} />
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.roleBadgeContainer}>
            <View style={[styles.roleBadge, { backgroundColor: isOwner ? '#E8F5E9' : '#FFF3E0' }]}>
              <Ionicons name={isOwner ? 'key' : 'eye'} size={16} color={isOwner ? '#4CAF50' : '#FF9800'} />
              <Text style={[styles.roleText, { color: isOwner ? '#4CAF50' : '#FF9800' }]}>
                {isOwner ? (connectedBleDevice ? ' Quyền Chủ xe (Trực tiếp)' : ' Quyền Chủ xe (Đang Offline)') : ' Quyền Người theo dõi (Chỉ xem)'}
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

          {/* 1. ĐỒ THỊ ALCOHOL RAW (30 ĐIỂM) */}
          <View style={[styles.chartCard, { backgroundColor: theme.card }]}>
            <View style={styles.titleRow}>
              <Text style={[styles.chartTitle, { color: theme.text }]}>Alcohol Raw (MQ-3)</Text>
              <Text style={[styles.currentAlcohol, { color: helmetData.status.alcohol_detected ? '#FF3B30' : '#4CAF50' }]}>
                {helmetData.status.alcohol_raw}
              </Text>
            </View>
            <LineChart
              data={{ labels: chartLabels, datasets: [{ data: alcoholRawHistory }] }}
              width={screenWidth - 60}
              height={150}
              withDots={false} // Tắt chấm tròn để mượt với 30 điểm
              chartConfig={{
                backgroundColor: theme.chartBg, backgroundGradientFrom: theme.chartBg, backgroundGradientTo: theme.chartBg,
                decimalPlaces: 0, color: (opacity = 1) => `rgba(255, 59, 48, ${opacity})`,
                labelColor: (opacity = 1) => (isDark ? `rgba(200, 200, 200, ${opacity})` : `rgba(102, 102, 102, ${opacity})`),
              }}
              bezier
              style={{ marginVertical: 8, borderRadius: 16, marginLeft: -10 }}
            />
            <Text style={[styles.chartHint, { color: theme.subText }]}>Raw ADC dùng để phân loại cồn.</Text>
          </View>

          {/* 2. ĐỒ THỊ MPU6050 (30 ĐIỂM) */}
          <View style={[styles.chartCard, { backgroundColor: theme.card }]}>
            <View style={styles.titleRow}>
              <Text style={[styles.chartTitle, { color: theme.text }]}>MPU6050 (Gia tốc & Gyro)</Text>
            </View>
            <LineChart
              data={{
                labels: chartLabels,
                legend: ['Gia tốc (g)', 'Tốc độ quay (dps ÷ 10)'],
                datasets: [
                  { data: accelHistory, color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`, strokeWidth: 2 },
                  { data: gyroHistory.map(v => v / 10), color: (opacity = 1) => `rgba(156, 39, 176, ${opacity})`, strokeWidth: 2 }
                ],
              }}
              width={screenWidth - 60}
              height={170}
              withDots={false} // Tắt chấm tròn để mượt với 30 điểm
              chartConfig={{
                backgroundColor: theme.chartBg, backgroundGradientFrom: theme.chartBg, backgroundGradientTo: theme.chartBg,
                decimalPlaces: 1, color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) => (isDark ? `rgba(200, 200, 200, ${opacity})` : `rgba(102, 102, 102, ${opacity})`),
              }}
              bezier
              style={{ marginVertical: 8, borderRadius: 16, marginLeft: -10 }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ color: '#007AFF', fontSize: 12, fontWeight: 'bold' }}>{helmetData.status.accel_mag_g.toFixed(2)} g</Text>
              <Text style={{ color: '#9C27B0', fontSize: 12, fontWeight: 'bold' }}>{helmetData.status.gyro_mag_dps.toFixed(1)} dps</Text>
            </View>
          </View>

          {/* 3. TRẠNG THÁI CẢNH BÁO */}
          <View style={[styles.card, { backgroundColor: theme.card, borderLeftWidth: 5, borderLeftColor: helmetData.status.fall_accident_alert || helmetData.status.is_sos_pressed ? '#FF3B30' : '#4CAF50' }]}>
            <Text style={[styles.label, { color: theme.subText }]}>🚨 Cảm biến va đập / MPU6050:</Text>
            <Text style={[styles.value, { color: helmetData.status.fall_accident_alert || helmetData.status.is_sos_pressed ? '#FF3B30' : '#4CAF50' }]}>
              {helmetData.status.fall_accident_alert ? 'PHÁT HIỆN TÉ NGÃ!' : helmetData.status.is_sos_pressed ? 'BÁO ĐỘNG SOS!' : 'An toàn - Bình thường'}
            </Text>
          </View>

          {/* HÀNG NÚT THAO TÁC */}
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

      {/* MODAL QUÉT BLE THỦ CÔNG */}
      <Modal visible={scanModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, maxHeight: '70%' }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Tìm kiếm Bike Node</Text>
            {isScanningBle && <ActivityIndicator size="small" color="#007AFF" style={{ marginBottom: 15 }} />}
            
            {scannedDevices.length === 0 && !isScanningBle ? (
              <Text style={{ textAlign: 'center', color: theme.subText, marginVertical: 20 }}>Không tìm thấy xe nào ở gần.</Text>
            ) : (
              <ScrollView style={{ width: '100%', marginBottom: 15 }}>
                {scannedDevices.map(device => (
                  <TouchableOpacity 
                    key={device.id} 
                    style={styles.bleDeviceRow}
                    onPress={() => connectToBleDevice(device)}
                  >
                    <Ionicons name="bluetooth" size={24} color="#007AFF" />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={{ fontWeight: 'bold', color: theme.text, fontSize: 16 }}>{device.name}</Text>
                      <Text style={{ color: theme.subText, fontSize: 12 }}>{device.id}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.modalCancelButton} onPress={() => { try { bleManager.stopDeviceScan(); } catch {}; setIsScanningBle(false); setScanModalVisible(false); }}>
              <Text style={styles.modalCancelText}>HỦY & ĐÓNG</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  chartCard: { padding: 15, borderRadius: 15, marginBottom: 15, elevation: 3 },
  chartTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 8 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartHint: { fontSize: 11, marginTop: -2, marginBottom: 4 },
  currentAlcohol: { fontSize: 17, fontWeight: '900' },
  card: { padding: 16, borderRadius: 14, marginBottom: 15, elevation: 3 },
  label: { fontSize: 13, marginBottom: 4 },
  value: { fontSize: 17, fontWeight: 'bold' },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
  modalCard: { width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25, elevation: 6 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15, textAlign: 'center' },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  nameInput: { height: 46, borderWidth: 1, borderColor: '#CCC', borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  modalButtons: { flexDirection: 'row', marginTop: 18, gap: 10 },
  modalCancelButton: { height: 48, backgroundColor: '#EEE', borderRadius: 12, justifyContent: 'center', alignItems: 'center', width: '100%' },
  modalCancelText: { fontWeight: '800', color: '#666', fontSize: 15 },
  modalSaveButton: { flex: 1, height: 44, backgroundColor: '#007AFF', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  modalSaveText: { fontWeight: '700', color: '#FFF' },
  bleDeviceRow: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: 'rgba(0,122,255,0.05)', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,122,255,0.2)' }
});