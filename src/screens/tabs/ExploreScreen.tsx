import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createLeafletMapHtml } from '../../utils/mapHelpers';
import { useExploreMap } from '../../hooks/useExploreMap';
import { WebView } from 'react-native-webview';

export default function ExploreScreen() {
  const { isDark, activeHelmetId, activeHelmetName, location, webViewRef } = useExploreMap();

  const handleOpenGoogleMaps = () => {
    if (location.lat === 0 && location.lng === 0) {
      Alert.alert('Thông báo', 'Chưa có tọa độ GPS hợp lệ.');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Lỗi', 'Không thể mở ứng dụng Google Maps.');
    });
  };

  const theme = {
    bg: isDark ? '#121212' : '#F5F5F5',
    card: isDark ? '#1E1E1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1A1A',
    subText: isDark ? '#AAAAAA' : '#666666',
    border: isDark ? '#333333' : '#E0E0E0',
  };

  if (!activeHelmetId) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <Ionicons name="map-outline" size={70} color={theme.subText} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Chưa chọn thiết bị nào</Text>
        <Text style={[styles.emptySubtitle, { color: theme.subText }]}>
          Vui lòng vào Trang chủ để chọn hoặc liên kết nón cần theo dõi.
        </Text>
      </SafeAreaView>
    );
  }

  const mapHtml = createLeafletMapHtml(location.lat, location.lng, activeHelmetName, activeHelmetId);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.headerTitle, { color: theme.text }]}>
        ĐỊNH VỊ: {activeHelmetName.toUpperCase()}
      </Text>

      <View style={[styles.mapContainer, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          mixedContentMode="always"
        />
      </View>

      <View style={[styles.locationCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={22} color="#007AFF" />
          <View style={styles.locationTextContainer}>
            <Text style={[styles.locationTitle, { color: theme.text }]}>
              {activeHelmetName} ({activeHelmetId})
            </Text>
            <Text style={[styles.coordinateText, { color: theme.subText }]}>
              Tọa độ: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.navButton} onPress={handleOpenGoogleMaps} activeOpacity={0.8}>
        <Ionicons name="navigate-circle" size={28} color="white" />
        <Text style={styles.navButtonText}>CHỈ ĐƯỜNG ĐẾN {activeHelmetName.toUpperCase()}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { fontSize: 18, fontWeight: '800', marginTop: 8, marginBottom: 10 },
  mapContainer: { flex: 1, minHeight: 300, borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: '#EEEEEE' },
  locationCard: { marginTop: 10, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationTextContainer: { flex: 1, marginLeft: 10 },
  locationTitle: { fontSize: 14, fontWeight: '700' },
  coordinateText: { fontSize: 13, marginTop: 2 },
  navButton: {
    height: 52,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navButtonText: { color: 'white', fontSize: 14, fontWeight: '800' },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 15 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
