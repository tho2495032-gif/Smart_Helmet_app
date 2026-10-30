import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { HistoryEvent } from '../../types/history';
import { getEventColor } from '../../utils/eventHelpers';

type Props = {
  event: HistoryEvent;
  currentHelmetId: string;
  theme: { card: string; text: string; subText: string };
  onOpenMap: (latitude: number, longitude: number) => void;
};

export default function HistoryEventCard({ event, currentHelmetId, theme, onOpenMap }: Props) {
  const isDanger = event.severity === 'danger' || event.severity === 'critical';
  const accentColor = getEventColor(event.type, event.severity);
  const timestamp = event.timestamp
    ? new Date(event.timestamp).toLocaleString('vi-VN')
    : 'KhÃ´ng cÃ³ thá»i gian';

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderLeftColor: accentColor }]}>
      <View style={styles.personRow}>
        <View style={[styles.colorDot, { backgroundColor: accentColor }]} />
        <Text style={[styles.personName, { color: theme.subText }]}>
          {event.helmet_id === currentHelmetId
            ? `Äang chá»n (${event.helmet_id})`
            : event.helmet_id}
        </Text>
      </View>

      <View style={styles.cardHeader}>
        <Ionicons name={isDanger ? 'alert-circle' : 'warning'} size={22} color={accentColor} />
        <Text style={[styles.statusText, { color: accentColor }]}>
          {event.type || 'Sá»± cá»‘ an toÃ n'}
        </Text>
      </View>

      {(event.impact_force || event.value || event.sensor || event.message) && (
        <View style={styles.metricRow}>
          {event.message && <Badge text={event.message} />}
          {event.value && <Badge text={`Ná»“ng Ä‘á»™: ${event.value}`} />}
          {event.impact_force && <Badge text={`Lá»±c va Ä‘áº­p: ${event.impact_force}`} />}
          {event.sensor && <Badge text={`Cáº£m biáº¿n: ${event.sensor}`} sensor />}
        </View>
      )}

      <View style={styles.timeRow}>
        <Ionicons name="time-outline" size={15} color={theme.subText} />
        <Text style={[styles.timeText, { color: theme.subText }]}>{timestamp}</Text>
      </View>

      {event.lat !== undefined && event.lng !== undefined && (
        <TouchableOpacity
          style={styles.mapLinkBtn}
          onPress={() => onOpenMap(event.lat!, event.lng!)}
          activeOpacity={0.8}
        >
          <Ionicons name="map-outline" size={17} color="#007AFF" />
          <Text style={styles.locationText}>Chá»‰ Ä‘Æ°á»ng Ä‘áº¿n vá»‹ trÃ­ sá»± cá»‘</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Badge({ text, sensor = false }: { text: string; sensor?: boolean }) {
  return (
    <View style={sensor ? styles.badgeSensorBox : styles.badgeDangerBox}>
      <Text style={sensor ? styles.badgeSensorText : styles.badgeDangerText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' },
  badgeDangerBox: { backgroundColor: '#FFEAEA', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  badgeDangerText: { color: '#D32F2F', fontSize: 13, fontWeight: '700' },
  badgeSensorBox: { backgroundColor: '#F0F0F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  badgeSensorText: { color: '#333333', fontSize: 13, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  timeText: { fontSize: 13, fontWeight: '500' },
  mapLinkBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,122,255,0.1)', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  locationText: { fontSize: 13, color: '#007AFF', fontWeight: 'bold', marginLeft: 6 },
});
