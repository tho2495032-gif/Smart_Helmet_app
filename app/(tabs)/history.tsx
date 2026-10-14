import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { onValue, ref } from 'firebase/database';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { realtimeDB } from '../../src/config/firebaseConfig';

const getEventColor = (type?: string, severity?: string) => {
  if (severity === 'critical' || severity === 'danger') return '#FF3B30';
  if (type?.toLowerCase().includes('cồn')) return '#FF9500';
  if (type?.toLowerCase().includes('ngã') || type?.toLowerCase().includes('va đập')) return '#FF3B30';
  return '#007AFF';
};

export default function HistoryScreen() {
  const [logs, setLogs] = useState<any[]>([]);
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
          } catch (e) {}
        }
      });

      // SỬA ĐƯỜNG DẪN: Trỏ thẳng vào nhánh Events/ của thiết bị hiện tại
      const eventsRef = ref(realtimeDB, `Events`);
      const unsubscribe = onValue(
        eventsRef,
        (snapshot) => {
          const data = snapshot.val();
          if (data && typeof data === 'object') {
            const list: any[] = [];

            // Lặp qua từng Helmet ID trong nhánh Events
            Object.keys(data).forEach((helmetId) => {
              const helmetEvents = data[helmetId];
              if (typeof helmetEvents === 'object') {
                // Lặp qua từng sự kiện của Helmet đó
                Object.keys(helmetEvents).forEach((eventId) => {
                  list.push({ id: eventId, helmet_id: helmetId, ...helmetEvents[eventId] });
                });
              }
            });

            // Sắp xếp theo thời gian mới nhất (timestamp lớn nhất)
            list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            setLogs(list);
          } else {
            setLogs([]);
          }
          setLoading(false);
        },
        () => {
          setLogs([]);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    }, [])
  );

  const theme = {
    bg: isDark ? '#121212' : '#F5F5F5',
    card: isDark ? '#1E1E1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1A1A',
    subText: isDark ? '#AAAAAA' : '#666666',
  };

  const openMap = (lat: any, lng: any) => {
    if (lat === undefined || lat === null || lng === undefined || lng === null) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch(() => {});
  };

  const renderItem = ({ item }: { item: any }) => {
    const isDanger = item.severity === 'danger' || item.severity === 'critical';
    const accentColor = getEventColor(item.type, item.severity);

    const timestamp = item.timestamp
      ? new Date(item.timestamp).toLocaleString('vi-VN')
      : 'Không có thời gian';

    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderLeftColor: accentColor }]}>
        <View style={styles.personRow}>
          <View style={[styles.colorDot, { backgroundColor: accentColor }]} />
          <Text style={[styles.personName, { color: theme.subText }]}>
            {item.helmet_id === currentHelmetId ? `Đang chọn (${item.helmet_id})` : item.helmet_id}
          </Text>
        </View>

        <View style={styles.cardHeader}>
          <Ionicons
            name={isDanger ? 'alert-circle' : 'warning'}
            size={22}
            color={accentColor}
          />
          <Text style={[styles.statusText, { color: accentColor }]}>
            {item.type || 'Sự cố an toàn'}
          </Text>
        </View>

        {/* Ô THÔNG SỐ: CĂN CHỈNH CO GIÃN TỰ NHIÊN, KHÔNG BỊ ĐÈ CHỮ */}
        {(item.impact_force || item.value || item.sensor || item.message) && (
          <View style={styles.metricRow}>
            {item.message && (
              <View style={styles.badgeDangerBox}>
                <Text style={styles.badgeDangerText}>{item.message}</Text>
              </View>
            )}
            {item.value && (
              <View style={styles.badgeDangerBox}>
                <Text style={styles.badgeDangerText}>Nồng độ: {item.value}</Text>
              </View>
            )}
            {item.impact_force && (
              <View style={styles.badgeDangerBox}>
                <Text style={styles.badgeDangerText}>Lực va đập: {item.impact_force}</Text>
              </View>
            )}
            {item.sensor && (
              <View style={styles.badgeSensorBox}>
                <Text style={styles.badgeSensorText}>Cảm biến: {item.sensor}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={15} color={theme.subText} />
          <Text style={[styles.timeText, { color: theme.subText }]}>{timestamp}</Text>
        </View>

        {item.lat !== undefined && item.lng !== undefined && (
          <TouchableOpacity
            style={styles.mapLinkBtn}
            onPress={() => openMap(item.lat, item.lng)}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={17} color="#007AFF" />
            <Text style={styles.locationText}>Chỉ đường đến vị trí sự cố</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>LỊCH SỬ CẢNH BÁO</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3B30" />
          <Text style={[styles.loadingText, { color: theme.subText }]}>Đang tải lịch sử...</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={55} color={theme.subText} />
              <Text style={[styles.emptyText, { color: theme.subText }]}>
                Chưa có sự cố nào được ghi nhận.
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={logs.length === 0 ? styles.emptyList : styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 15, marginBottom: 15 },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  listContent: { paddingBottom: 30 },
  emptyList: { flexGrow: 1 },
  loadingContainer: { alignItems: 'center', marginTop: 30 },
  loadingText: { marginTop: 10, fontSize: 14 },
  card: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderLeftWidth: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  personRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  personName: { fontWeight: '700', fontSize: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  statusText: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },

  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  badgeDangerBox: {
    backgroundColor: '#FFEAEA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeDangerText: {
    color: '#D32F2F',
    fontSize: 13,
    fontWeight: '700',
  },
  badgeSensorBox: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeSensorText: {
    color: '#333333',
    fontSize: 13,
    fontWeight: '600',
  },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  timeText: { fontSize: 13, fontWeight: '500' },
  mapLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,122,255,0.1)',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  locationText: { fontSize: 13, color: '#007AFF', fontWeight: 'bold', marginLeft: 6 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', marginTop: 15, fontSize: 15 },
});