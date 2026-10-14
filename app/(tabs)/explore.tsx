import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { onValue, ref } from 'firebase/database';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { realtimeDB } from '../../src/config/firebaseConfig';

export default function ExploreScreen() {
  const [isDark, setIsDark] = useState(false);
  const [activeHelmetId, setActiveHelmetId] = useState<string | null>(null);
  const [activeHelmetName, setActiveHelmetName] = useState('Nón bảo hiểm');
  const [location, setLocation] = useState({ lat: 10.8231, lng: 106.6297, timestamp: 0 });
  const webViewRef = useRef<WebView>(null);

  // Đồng bộ nón đang chọn bên Trang chủ
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('helmetId').then((id) => {
        setActiveHelmetId(id);
      });
      AsyncStorage.getItem('helmetName').then((name) => {
        if (name) setActiveHelmetName(name);
      });
      AsyncStorage.getItem('appSettings').then((saved) => {
        if (saved) {
          try {
            setIsDark(JSON.parse(saved).darkMode === true);
          } catch (e) {}
        }
      });
    }, [])
  );

  // SỬA LẠI ĐƯỜNG DẪN: Lắng nghe nhánh Telemetry phẳng
  useEffect(() => {
    if (!activeHelmetId) return;

    // Trỏ thẳng đến: Root/Devices/{ID}/telemetry
    const helmetRef = ref(realtimeDB, `Devices/${activeHelmetId}/telemetry`);
    const unsubscribe = onValue(helmetRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
        const newLoc = {
          lat: data.lat,
          lng: data.lng,
          timestamp: data.last_update || Date.now(), // Sử dụng field last_update của cấu trúc mới
        };
        setLocation(newLoc);

        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            if (window.updateLocation) {
              window.updateLocation(${newLoc.lat}, ${newLoc.lng});
            }
            true;
          `);
        }
      }
    });

    return () => unsubscribe();
  }, [activeHelmetId]);

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

  const mapHtml = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #eeeeee; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${location.lat}, ${location.lng}], 16);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      minZoom: 2
    }).addTo(map);

    var marker = L.marker([${location.lat}, ${location.lng}]).addTo(map);
    marker.bindPopup("<b>${activeHelmetName}</b><br>ID: ${activeHelmetId}").openPopup();

    window.updateLocation = function(lat, lng) {
      marker.setLatLng([lat, lng]);
      map.panTo([lat, lng], { animate: true, duration: 0.8 });
    };
  </script>
</body>
</html>
  `;

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