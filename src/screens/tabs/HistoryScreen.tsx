import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HistoryEventCard from '../../components/history/HistoryEventCard';
import { useHistoryLogs } from '../../hooks/useHistoryLogs';
import type { HistoryEvent } from '../../types/history';


export default function HistoryScreen() {
  const { logs, loading, isDark, currentHelmetId } = useHistoryLogs();

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

  const renderItem = ({ item }: { item: HistoryEvent }) => (
    <HistoryEventCard event={item} currentHelmetId={currentHelmetId} theme={theme} onOpenMap={openMap} />
  );

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
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', marginTop: 15, fontSize: 15 },
});
