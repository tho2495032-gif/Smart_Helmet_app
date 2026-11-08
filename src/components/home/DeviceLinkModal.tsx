import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
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
  saving: boolean;
  theme: Theme;
  onSave: (deviceId: string, name: string) => void;
  onClose: () => void;
};

export default function DeviceLinkModal({ visible, saving, theme, onSave, onClose }: Props) {
  const [deviceId, setDeviceId] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!visible) {
      setDeviceId('');
      setName('');
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.heading}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={22} color="#007AFF" />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Liên kết nón bảo hiểm</Text>
          </View>
          <Text style={[styles.description, { color: theme.subText }]}>
            Nhập mã thiết bị đã được cấu hình trên Firebase. Hệ thống sẽ cấp quyền Chủ xe hoặc Người theo dõi theo chủ sở hữu hiện tại.
          </Text>

          <Text style={[styles.label, { color: theme.text }]}>Mã nón</Text>
          <TextInput
            value={deviceId}
            onChangeText={setDeviceId}
            placeholder="Ví dụ: Helmet_001"
            placeholderTextColor={theme.subText}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />

          <Text style={[styles.label, { color: theme.text }]}>Tên hiển thị (không bắt buộc)</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ví dụ: Nón của tôi"
            placeholderTextColor={theme.subText}
            editable={!saving}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} disabled={saving} onPress={onClose}>
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.disabledButton]}
              disabled={saving || !deviceId.trim()}
              onPress={() => onSave(deviceId.trim(), name.trim())}
            >
              {saving ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.saveText}>Liên kết</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'center', padding: 22 },
  card: { borderRadius: 20, padding: 20 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EAF3FF', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', flex: 1 },
  description: { fontSize: 13, lineHeight: 19, marginTop: 12, marginBottom: 15 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  input: { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelButton: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, backgroundColor: '#ECECEC' },
  cancelText: { color: '#333', fontWeight: '700' },
  saveButton: { minWidth: 100, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, backgroundColor: '#007AFF' },
  saveText: { color: 'white', fontWeight: '700' },
  disabledButton: { opacity: 0.55 },
});
