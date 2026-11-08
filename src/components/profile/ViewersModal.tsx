import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type ProfileViewer = { uid: string; email: string; name?: string };
type Theme = { card: string; text: string; subText: string; border: string };

type Props = {
  visible: boolean;
  deviceId?: string;
  loading: boolean;
  viewers: ProfileViewer[];
  theme: Theme;
  onRemove: (viewer: ProfileViewer) => void;
  onClose: () => void;
};

export default function ViewersModal({ visible, deviceId, loading, viewers, theme, onRemove, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>Người đang theo dõi {deviceId}</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>
            Chủ xe có toàn quyền thu hồi quyền theo dõi của tài khoản khác
          </Text>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color="#007AFF" />
          ) : viewers.length === 0 ? (
            <Text style={[styles.empty, { color: theme.subText }]}>Chưa có tài khoản nào theo dõi nón này.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 250, marginVertical: 10 }}>
              {viewers.map((viewer) => (
                <View key={viewer.uid} style={[styles.viewerRow, { borderBottomColor: theme.border }]}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.email, { color: theme.text }]} numberOfLines={1}>{viewer.email}</Text>
                    {viewer.name && <Text style={[styles.viewerName, { color: theme.subText }]}>{viewer.name}</Text>}
                  </View>
                  <TouchableOpacity style={styles.removeButton} onPress={() => onRemove(viewer)}>
                    <Ionicons name="person-remove" size={15} color="white" />
                    <Text style={styles.removeText}>ĐÁ RA</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>ĐÓNG</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', borderRadius: 18, padding: 20, elevation: 6 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 12, textAlign: 'center', marginBottom: 12 },
  empty: { textAlign: 'center', marginVertical: 15 },
  viewerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  email: { fontSize: 14, fontWeight: '600' },
  viewerName: { fontSize: 12 },
  removeButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FF3B30', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  removeText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  closeButton: { height: 44, backgroundColor: '#EEE', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  closeText: { fontWeight: '700', color: '#555' },
});
