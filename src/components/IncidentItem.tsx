import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Khuôn mẫu (Interface) định nghĩa các dữ liệu mà thẻ này sẽ nhận vào
interface IncidentProps {
  time: string;
  lat: number;
  lng: number;
  status: string;
}

export default function IncidentItem({ time, lat, lng, status }: IncidentProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.timeText}>🕒 Thời gian: {time}</Text>
      <Text style={styles.locationText}>📍 Tọa độ: {lat}, {lng}</Text>
      <Text style={[
        styles.statusText, 
        // Đổi màu chữ linh hoạt theo trạng thái
        { color: status === 'Chưa xử lý' ? 'red' : 'green' }
      ]}>
        Trạng thái: {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 5,
    borderLeftColor: '#FF3B30', // Vạch đỏ cảnh báo bên trái thẻ
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  timeText: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  locationText: { fontSize: 14, color: '#555', marginBottom: 5 },
  statusText: { fontSize: 14, fontWeight: '600' },
});