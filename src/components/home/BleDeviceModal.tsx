import { Ionicons } from '@expo/vector-icons';
import type { Device } from 'react-native-ble-plx';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Theme = {
  card: string;
  text: string;
  subText: string;
  border: string;
};

type Props = {
  visible: boolean;
  devices: Device[];
  scanning: boolean;
  connecting: boolean;
  error: string | null;
  theme: Theme;
  onConnect: (device: Device) => void;
  onScan: () => void;
  onClose: () => void;
};

export default function BleDeviceModal({
  visible,
  devices,
  scanning,
  connecting,
  error,
  theme,
  onConnect,
  onScan,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.header}>
            <View style={styles.titleGroup}>
              <Ionicons name="bluetooth" size={22} color="#007AFF" />
              <Text style={[styles.title, { color: theme.text }]}>Kết nối Helmet Node</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Đóng cửa sổ Bluetooth">
              <Ionicons name="close" size={24} color={theme.subText} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.description, { color: theme.subText }]}>
            Dùng Bluetooth để nhận dữ liệu trực tiếp khi nón không gửi được dữ liệu lên Firebase.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {scanning || connecting ? (
            <View style={styles.progress}>
              <ActivityIndicator color="#007AFF" />
              <Text style={[styles.progressText, { color: theme.subText }]}>
                {connecting ? 'Đang kết nối với nón…' : 'Đang quét thiết bị…'}
              </Text>
            </View>
          ) : null}

          {!scanning && devices.length === 0 ? (
            <Text style={[styles.empty, { color: theme.subText }]}>
              Chưa tìm thấy Helmet Node. Hãy bật nón và thử quét lại.
            </Text>
          ) : null}

          <ScrollView style={styles.deviceList} keyboardShouldPersistTaps="handled">
            {devices.map((device) => (
              <TouchableOpacity
                key={device.id}
                style={[styles.deviceRow, { borderBottomColor: theme.border }]}
                disabled={connecting}
                onPress={() => onConnect(device)}
              >
                <Ionicons name="hardware-chip-outline" size={24} color="#007AFF" />
                <View style={styles.deviceDetails}>
                  <Text style={[styles.deviceName, { color: theme.text }]}>{device.name}</Text>
                  <Text style={[styles.deviceId, { color: theme.subText }]}>{device.id}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.subText} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.scanButton} onPress={onScan} disabled={scanning || connecting}>
              <Ionicons name="search" size={17} color="white" />
              <Text style={styles.scanText}>Quét lại</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'center', padding: 22 },
  card: { borderRadius: 20, padding: 18, maxHeight: '78%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontWeight: '800' },
  description: { marginTop: 10, fontSize: 13, lineHeight: 19 },
  error: { color: '#D32F2F', fontSize: 13, marginTop: 10 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16 },
  progressText: { fontSize: 13 },
  empty: { textAlign: 'center', marginVertical: 24, lineHeight: 20 },
  deviceList: { marginTop: 8, maxHeight: 270 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1 },
  deviceDetails: { flex: 1, marginLeft: 10 },
  deviceName: { fontSize: 15, fontWeight: '700' },
  deviceId: { fontSize: 11, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  scanButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 12, borderRadius: 10, backgroundColor: '#007AFF' },
  scanText: { color: 'white', fontWeight: '700' },
  closeButton: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 22, borderRadius: 10, backgroundColor: '#E8E8E8' },
  closeText: { color: '#333', fontWeight: '700' },
});
