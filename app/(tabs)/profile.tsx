import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { onValue, ref, remove, update } from 'firebase/database';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, realtimeDB } from '../../src/config/firebaseConfig';

type HelmetDevice = {
  id: string;
  name: string;
  color?: string;
  role?: string;
};

type ViewerItem = {
  uid: string;
  email: string;
  name?: string;
};

export default function ProfileScreen() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState('');
  const [userUid, setUserUid] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const [isDark, setIsDark] = useState(false);
  const [inAppAlertEnabled, setInAppAlertEnabled] = useState(true);
  const [backgroundPushEnabled, setBackgroundPushEnabled] = useState(true);

  const [devices, setDevices] = useState<HelmetDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDevice, setEditingDevice] = useState<HelmetDevice | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const [viewersModalVisible, setViewersModalVisible] = useState(false);
  const [managingDevice, setManagingDevice] = useState<HelmetDevice | null>(null);
  const [viewersList, setViewersList] = useState<ViewerItem[]>([]);
  const [isLoadingViewers, setIsLoadingViewers] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadProfileAndSettings = async () => {
        try {
          setIsLoading(true);
          const currentEmail = auth.currentUser?.email || (await AsyncStorage.getItem('userEmail')) || '';
          const currentUid = auth.currentUser?.uid || (await AsyncStorage.getItem('userUid')) || '';
          setUserEmail(currentEmail);
          setUserUid(currentUid);

          if (currentEmail) {
            const savedAvatar = await AsyncStorage.getItem(`avatar_${currentEmail}`);
            if (savedAvatar) setAvatarUri(savedAvatar);
          }

          const savedSettings = await AsyncStorage.getItem('appSettings');
          if (savedSettings) {
            try {
              const parsed = JSON.parse(savedSettings);
              setIsDark(parsed.darkMode === true);
              if (parsed.inAppAlert !== undefined) setInAppAlertEnabled(parsed.inAppAlert);
              if (parsed.backgroundPush !== undefined) setBackgroundPushEnabled(parsed.backgroundPush);
            } catch (e) {}
          }
        } catch (error) {
        } finally {
          setIsLoading(false);
        }
      };

      loadProfileAndSettings();
    }, [])
  );

  useEffect(() => {
    if (!userUid) return;

    // SỬA ĐƯỜNG DẪN TẠI ĐÂY: Root/Users/...
    const userDevicesRef = ref(realtimeDB, `Users/${userUid}/devices`);
    const unsubscribe = onValue(userDevicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        const list: HelmetDevice[] = Object.keys(data).map((k) => ({
          id: k,
          name: data[k].name || k,
          color: data[k].color || '#007AFF',
          role: data[k].role || 'viewer',
        }));
        setDevices(list);
      } else {
        setDevices([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userUid]);

  const saveAppSettings = async (newSettings: {
    darkMode?: boolean;
    inAppAlert?: boolean;
    backgroundPush?: boolean;
  }) => {
    try {
      const saved = await AsyncStorage.getItem('appSettings');
      let cur = saved ? JSON.parse(saved) : {};
      const updated = { ...cur, ...newSettings };
      await AsyncStorage.setItem('appSettings', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleToggleDarkMode = (val: boolean) => {
    setIsDark(val);
    saveAppSettings({ darkMode: val });
  };

  const handleToggleInAppAlert = (val: boolean) => {
    setInAppAlertEnabled(val);
    saveAppSettings({ inAppAlert: val });
  };

  const handleToggleBackgroundPush = (val: boolean) => {
    setBackgroundPushEnabled(val);
    saveAppSettings({ backgroundPush: val });
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập bộ sưu tập ảnh để đổi avatar!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      if (userEmail) {
        await AsyncStorage.setItem(`avatar_${userEmail}`, uri);
      }
      Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện mới!');
    }
  };

  const handleChangePassword = async () => {
    if (!userEmail) {
      Alert.alert('Lỗi', 'Không tìm thấy địa chỉ email tài khoản.');
      return;
    }

    Alert.alert(
      'Đổi mật khẩu',
      `Hệ thống sẽ gửi liên kết tạo mật khẩu mới đến:\n${userEmail}\n\nBạn có muốn tiếp tục không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gửi liên kết',
          onPress: async () => {
            try {
              await sendPasswordResetEmail(auth, userEmail);
              Alert.alert('Đã gửi email ✉️', 'Vui lòng mở Gmail để thiết lập mật khẩu mới.');
            } catch (e: any) {
              Alert.alert('Thất bại', 'Không thể gửi yêu cầu đổi mật khẩu.');
            }
          },
        },
      ]
    );
  };

  const handleSaveDeviceName = async () => {
    if (!editingDevice || !userUid) return;
    const name = editingName.trim();
    if (!name) return;

    try {
      setIsSavingName(true);
      // SỬA ĐƯỜNG DẪN TẠI ĐÂY: Root/Users/...
      const r = ref(realtimeDB, `Users/${userUid}/devices/${editingDevice.id}`);
      await update(r, { name });
      setEditModalVisible(false);
      setEditingDevice(null);
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể đổi tên thiết bị.');
    } finally {
      setIsSavingName(false);
    }
  };

  // Hủy liên kết nón: Tức thì dọn sạch dữ liệu
  const handleUnlinkDevice = (device: HelmetDevice) => {
    Alert.alert(
      'Hủy liên kết',
      `Bạn có chắc muốn gỡ bỏ "${device.name}" (${device.id}) khỏi tài khoản?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gỡ bỏ',
          style: 'destructive',
          onPress: async () => {
            try {
              // SỬA ĐƯỜNG DẪN TẠI ĐÂY: Root/Users/... và Root/Devices/...
              await remove(ref(realtimeDB, `Users/${userUid}/devices/${device.id}`));
              if (device.role === 'owner') {
                // Sửa thành nhánh info/owner_uid theo cấu trúc mới
                await remove(ref(realtimeDB, `Devices/${device.id}/info/owner_uid`));
              } else {
                // Sửa thành nhánh viewers theo cấu trúc mới
                await remove(ref(realtimeDB, `Devices/${device.id}/viewers/${userUid}`));
              }

              const savedId = await AsyncStorage.getItem('helmetId');
              if (savedId === device.id) {
                await AsyncStorage.removeItem('helmetId');
                await AsyncStorage.removeItem('helmetName');
                await AsyncStorage.removeItem('helmetRole');
              }
              Alert.alert('Thành công', 'Đã hủy liên kết thiết bị!');
            } catch (e) {
              Alert.alert('Lỗi', 'Không thể hủy liên kết.');
            }
          },
        },
      ]
    );
  };

  const handleOpenViewersModal = (device: HelmetDevice) => {
    setManagingDevice(device);
    setViewersModalVisible(true);
    setIsLoadingViewers(true);

    // SỬA ĐƯỜNG DẪN TẠI ĐÂY: Root/Devices/...
    const viewersRef = ref(realtimeDB, `Devices/${device.id}/viewers`);
    onValue(viewersRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        const list: ViewerItem[] = Object.keys(data).map((vUid) => ({
          uid: vUid,
          email: data[vUid].email || 'Người dùng ẩn',
          name: data[vUid].name,
        }));
        setViewersList(list);
      } else {
        setViewersList([]);
      }
      setIsLoadingViewers(false);
    }, { onlyOnce: true });
  };

  // CHỦ XE ĐÁ VIEWER RA KHỎI NÓN
  const handleKickViewer = (viewer: ViewerItem) => {
    if (!managingDevice) return;

    Alert.alert(
      'Thu hồi quyền',
      `Bạn có chắc muốn chặn quyền theo dõi của tài khoản ${viewer.email}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa quyền',
          style: 'destructive',
          onPress: async () => {
            try {
              // SỬA ĐƯỜNG DẪN TẠI ĐÂY: Root/Devices/... và Root/Users/...
              await remove(ref(realtimeDB, `Devices/${managingDevice.id}/viewers/${viewer.uid}`));
              await remove(ref(realtimeDB, `Users/${viewer.uid}/devices/${managingDevice.id}`));
              setViewersList((prev) => prev.filter((v) => v.uid !== viewer.uid));
              Alert.alert('Thành công', `Đã xóa quyền theo dõi của ${viewer.email}.`);
            } catch (e) {
              Alert.alert('Lỗi', 'Không thể xóa quyền.');
            }
          },
        },
      ]
    );
  };

  const handleClearCache = async () => {
    Alert.alert('Xóa bộ nhớ đệm', 'Làm mới các cài đặt tạm thời và tải lại giao diện?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Làm mới',
        onPress: async () => {
          await AsyncStorage.removeItem('appSettings');
          setIsDark(false);
          setInAppAlertEnabled(true);
          setBackgroundPushEnabled(true);
          Alert.alert('Đã làm mới', 'Đã khôi phục cài đặt mặc định thành công.');
        },
      },
    ]);
  };

  const handleLogout = async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            await AsyncStorage.clear();
            router.replace('/login');
          } catch (e) {
            Alert.alert('Lỗi', 'Không thể đăng xuất.');
          }
        },
      },
    ]);
  };

  const theme = {
    bg: isDark ? '#121212' : '#F5F5F5',
    card: isDark ? '#1E1E1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1A1A',
    subText: isDark ? '#AAAAAA' : '#666666',
    border: isDark ? '#2C2C2C' : '#EEEEEE',
    iconBoxBg: isDark ? '#2A2A2A' : '#F1F6FF',
    tagBg: isDark ? '#2A2A2A' : '#EBF4FF',
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* HEADER & AVATAR */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatarTouchable}
            onPress={handlePickAvatar}
            activeOpacity={0.8}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.iconBoxBg }]}>
                <Ionicons name="person" size={46} color="#007AFF" />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color="white" />
            </View>
          </TouchableOpacity>

          <Text style={[styles.headerEmail, { color: theme.text }]} numberOfLines={1}>
            {userEmail || 'Chưa đăng nhập'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.subText }]}>
            Hệ thống giám sát Smart Helmet
          </Text>
        </View>

        {/* 1. DANH SÁCH NÓN */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.subText }]}>THIẾT BỊ LIÊN KẾT</Text>

          {devices.length === 0 ? (
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.emptyCard}>
                <Ionicons name="shield-outline" size={38} color="#AAA" />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Chưa có thiết bị nào</Text>
                <Text style={[styles.emptyText, { color: theme.subText }]}>
                  Vào Trang chủ để liên kết nón của bạn.
                </Text>
              </View>
            </View>
          ) : (
            devices.map((device) => {
              const isOwner = device.role === 'owner';
              return (
                <View key={device.id} style={[styles.deviceCard, { backgroundColor: theme.card }]}>
                  <View style={[styles.colorDot, { backgroundColor: device.color || '#007AFF' }]} />
                  <View style={styles.deviceContent}>
                    <Text style={[styles.deviceName, { color: theme.text }]}>{device.name}</Text>
                    <Text style={[styles.deviceId, { color: theme.subText }]}>
                      ID: {device.id} • {isOwner ? '🔑 Chủ xe' : '👁️ Người theo dõi'}
                    </Text>

                    {isOwner && (
                      <TouchableOpacity
                        style={[styles.viewersBadgeBtn, { backgroundColor: theme.tagBg }]}
                        onPress={() => handleOpenViewersModal(device)}
                      >
                        <Ionicons name="people-outline" size={13} color="#007AFF" />
                        <Text style={styles.viewersBadgeText}>Quản lý người theo dõi</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: theme.iconBoxBg }]}
                      onPress={() => {
                        setEditingDevice(device);
                        setEditingName(device.name);
                        setEditModalVisible(true);
                      }}
                    >
                      <Ionicons name="create-outline" size={19} color="#007AFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: '#FFF0F0' }]}
                      onPress={() => handleUnlinkDevice(device)}
                    >
                      <Ionicons name="trash-outline" size={19} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* 2. CÀI ĐẶT GIAO DIỆN & THÔNG BÁO */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.subText }]}>TÙY CHỌN & CÀI ĐẶT</Text>

          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {/* DARK MODE */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.iconBoxBg }]}>
                  <Ionicons name={isDark ? "moon" : "sunny"} size={22} color={isDark ? "#AF52DE" : "#FF9500"} />
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Chế độ nền tối (Dark Mode)</Text>
                  <Text style={[styles.settingSub, { color: theme.subText }]}>
                    {isDark ? 'Giao diện ban đêm dễ chịu' : 'Giao diện ban ngày sáng rõ'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={handleToggleDarkMode}
                trackColor={{ false: '#D1D1D6', true: '#81B9FF' }}
                thumbColor={isDark ? '#007AFF' : '#F4F3F4'}
              />
            </View>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            {/* IN-APP ALERT */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.iconBoxBg }]}>
                  <Ionicons name="alert-circle-outline" size={22} color="#FF3B30" />
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Hộp thoại sự cố (In-App)</Text>
                  <Text style={[styles.settingSub, { color: theme.subText }]}>
                    Bật popup khẩn cấp khi đang mở app
                  </Text>
                </View>
              </View>
              <Switch
                value={inAppAlertEnabled}
                onValueChange={handleToggleInAppAlert}
                trackColor={{ false: '#D1D1D6', true: '#81B9FF' }}
                thumbColor={inAppAlertEnabled ? '#007AFF' : '#F4F3F4'}
              />
            </View>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            {/* PUSH NOTIFICATION */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.iconBoxBg }]}>
                  <Ionicons name="notifications-outline" size={22} color="#007AFF" />
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Thông báo nền (Notification Bar)</Text>
                  <Text style={[styles.settingSub, { color: theme.subText }]}>
                    Rung chuông & banner đỉnh máy
                  </Text>
                </View>
              </View>
              <Switch
                value={backgroundPushEnabled}
                onValueChange={handleToggleBackgroundPush}
                trackColor={{ false: '#D1D1D6', true: '#81B9FF' }}
                thumbColor={backgroundPushEnabled ? '#007AFF' : '#F4F3F4'}
              />
            </View>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            {/* ĐỔI MẬT KHẨU QUA GMAIL */}
            <TouchableOpacity style={styles.settingRow} onPress={handleChangePassword} activeOpacity={0.7}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.iconBoxBg }]}>
                  <Ionicons name="key-outline" size={22} color="#007AFF" />
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Đổi mật khẩu</Text>
                  <Text style={[styles.settingSub, { color: theme.subText }]}>
                    Gửi liên kết tạo mật khẩu mới qua Gmail
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.subText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. THÔNG TIN PHẦN CỨNG IOT (ĐÃ FIX TRÀN CHỮ MỤC NODE CỤM NÓN) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.subText }]}>THÔNG TIN HỆ THỐNG PHẦN CỨNG</Text>

          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.subText }]}>Phiên bản phần mềm</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>v1.0.0 (Release Build)</Text>
            </View>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            {/* MỤC NODE CỤM NÓN: TỰ XUỐNG DÒNG GỌN GÀNG, KHÔNG BỊ TRÀN KHỎI MÀN HÌNH */}
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.subText }]}>Node Cụm Nón (Sensor)</Text>
              <Text style={[styles.infoValueWrap, { color: theme.text }]}>
                ESP32-S3{'\n'}(MPU6050 + MQ3 + GPS)
              </Text>
            </View>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.subText }]}>Node Cụm Xe (Relay)</Text>
              <Text style={[styles.infoValueWrap, { color: theme.text }]}>
                ESP32-C3{'\n'}(ESP-NOW + BLE)
              </Text>
            </View>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.subText }]}>Máy chủ đám mây</Text>
              <View style={styles.statusOnlineTag}>
                <View style={styles.onlineDot} />
                <Text style={styles.statusOnlineText}>Firebase Realtime Online</Text>
              </View>
            </View>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <TouchableOpacity style={styles.clearCacheRow} onPress={handleClearCache} activeOpacity={0.7}>
              <Text style={{ color: '#007AFF', fontWeight: '600', fontSize: 14 }}>Khôi phục cài đặt mặc định</Text>
              <Ionicons name="refresh-outline" size={18} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* NÚT ĐĂNG XUẤT */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
          <Text style={styles.logoutText}>ĐĂNG XUẤT TÀI KHOẢN</Text>
        </TouchableOpacity>

        <Text style={[styles.footerText, { color: theme.subText }]}>
          Smart Helmet Safety System • 2026
        </Text>
      </ScrollView>

      {/* MODAL QUẢN LÝ NGƯỜI THEO DÕI */}
      <Modal visible={viewersModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Người đang theo dõi {managingDevice?.id}
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.subText }]}>
              Chủ xe có toàn quyền thu hồi quyền theo dõi của tài khoản khác
            </Text>

            {isLoadingViewers ? (
              <ActivityIndicator style={{ marginVertical: 20 }} color="#007AFF" />
            ) : viewersList.length === 0 ? (
              <Text style={[styles.noViewersText, { color: theme.subText }]}>
                Chưa có tài khoản nào theo dõi nón này.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 250, marginVertical: 10 }}>
                {viewersList.map((viewer) => (
                  <View key={viewer.uid} style={[styles.viewerItemRow, { borderBottomColor: theme.border }]}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.viewerEmail, { color: theme.text }]} numberOfLines={1}>
                        {viewer.email}
                      </Text>
                      {viewer.name && <Text style={[styles.viewerSub, { color: theme.subText }]}>{viewer.name}</Text>}
                    </View>
                    <TouchableOpacity
                      style={styles.kickBtn}
                      onPress={() => handleKickViewer(viewer)}
                    >
                      <Ionicons name="person-remove" size={15} color="white" />
                      <Text style={styles.kickBtnText}>ĐÁ RA</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setViewersModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>ĐÓNG</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL SỬA TÊN THIẾT BỊ */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Đổi tên nón</Text>
            <TextInput
              style={[
                styles.nameInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? '#2A2A2A' : '#FAFAFA' },
              ]}
              value={editingName}
              onChangeText={setEditingName}
              placeholder="Tên mới..."
              placeholderTextColor="#888"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>HỦY</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveDeviceName}
                disabled={isSavingName}
              >
                {isSavingName ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalSaveText}>LƯU</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 35 },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 22 },
  avatarTouchable: { position: 'relative', marginBottom: 12 },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerEmail: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  headerSubtitle: { fontSize: 13, marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: 16, padding: 16, elevation: 2 },
  deviceCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  deviceContent: { flex: 1 },
  deviceName: { fontSize: 15, fontWeight: '700' },
  deviceId: { fontSize: 12, marginTop: 2 },
  viewersBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  viewersBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#007AFF' },
  actionRow: { flexDirection: 'row', gap: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  settingLabel: { fontSize: 14, fontWeight: '700' },
  settingSub: { fontSize: 12, marginTop: 2 },
  separator: { height: 1, marginVertical: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  infoLabel: { fontSize: 13, flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '600' },
  infoValueWrap: { fontSize: 12, fontWeight: '600', textAlign: 'right', flexShrink: 1, lineHeight: 18 },
  statusOnlineTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2E7D32' },
  statusOnlineText: { fontSize: 12, fontWeight: 'bold', color: '#2E7D32' },
  clearCacheRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 },
  logoutButton: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: { color: '#FF3B30', fontSize: 14, fontWeight: '800', marginLeft: 8 },
  footerText: { textAlign: 'center', marginTop: 18, fontSize: 12 },
  emptyCard: { alignItems: 'center', paddingVertical: 15 },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: 8 },
  emptyText: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', borderRadius: 18, padding: 20, elevation: 6 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { fontSize: 12, textAlign: 'center', marginBottom: 12 },
  noViewersText: { textAlign: 'center', marginVertical: 15 },
  viewerItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  viewerEmail: { fontSize: 14, fontWeight: '600' },
  viewerSub: { fontSize: 12 },
  kickBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FF3B30', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  kickBtnText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  modalCloseBtn: { height: 44, backgroundColor: '#EEE', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  modalCloseText: { fontWeight: '700', color: '#555' },
  nameInput: { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  modalButtons: { flexDirection: 'row', marginTop: 18, gap: 10 },
  modalCancelButton: { flex: 1, height: 44, backgroundColor: '#EEE', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  modalCancelText: { fontWeight: '700', color: '#666' },
  modalSaveButton: { flex: 1, height: 44, backgroundColor: '#007AFF', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  modalSaveText: { fontWeight: '700', color: '#FFF' },
});