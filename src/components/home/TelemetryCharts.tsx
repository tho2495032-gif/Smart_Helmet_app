import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const chartWidth = Dimensions.get('window').width - 60;
const chartLabels = Array(30).fill('');
chartLabels[0] = '-30s';
chartLabels[chartLabels.length - 1] = 'Now';

type Status = {
  alcohol_raw: number;
  alcohol_detected: boolean;
  accel_mag_g: number;
  gyro_mag_dps: number;
  fall_accident_alert: boolean;
  is_sos_pressed: boolean;
};

type Props = {
  status: Status;
  alcoholRawAvailable: boolean;
  alcoholHistory: number[];
  accelHistory: number[];
  gyroHistory: number[];
  isDark: boolean;
  theme: { card: string; chartBg: string; text: string; subText: string };
};

export default function TelemetryCharts({
  status,
  alcoholRawAvailable,
  alcoholHistory,
  accelHistory,
  gyroHistory,
  isDark,
  theme,
}: Props) {
  const labelColor = (opacity = 1) =>
    isDark ? `rgba(200, 200, 200, ${opacity})` : `rgba(102, 102, 102, ${opacity})`;

  return (
    <>
      <View style={[styles.chartCard, { backgroundColor: theme.card }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.chartTitle, { color: theme.text }]}>Alcohol Raw (MQ-3)</Text>
          <Text
            style={[
              styles.currentAlcohol,
              {
                color: alcoholRawAvailable
                  ? status.alcohol_detected
                    ? '#FF3B30'
                    : '#4CAF50'
                  : theme.subText,
              },
            ]}
          >
            {alcoholRawAvailable ? status.alcohol_raw : 'ẨN'}
          </Text>
        </View>
        {alcoholRawAvailable ? (
          <LineChart
            data={{ labels: chartLabels, datasets: [{ data: alcoholHistory }] }}
            width={chartWidth}
            height={150}
            withDots={false}
            chartConfig={{
              backgroundColor: theme.chartBg,
              backgroundGradientFrom: theme.chartBg,
              backgroundGradientTo: theme.chartBg,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(255, 59, 48, ${opacity})`,
              labelColor,
            }}
            bezier
            style={styles.chart}
          />
        ) : (
          <Text style={[styles.chartHint, { color: theme.subText }]}>
            Giá trị raw đang được ẩn hoặc không có dữ liệu.
          </Text>
        )}
        {alcoholRawAvailable && <Text style={[styles.chartHint, { color: theme.subText }]}>Raw ADC dùng để phân loại cồn.</Text>}
      </View>

      <View style={[styles.chartCard, { backgroundColor: theme.card }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.chartTitle, { color: theme.text }]}>MPU6050 (Gia tốc & Gyro)</Text>
        </View>
        <LineChart
          data={{
            labels: chartLabels,
            legend: ['Gia tốc (g)', 'TĐQ (dps ÷ 10)'],
            datasets: [
              { data: accelHistory, color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`, strokeWidth: 2 },
              { data: gyroHistory.map((value) => value / 10), color: (opacity = 1) => `rgba(156, 39, 176, ${opacity})`, strokeWidth: 2 },
            ],
          }}
          width={chartWidth}
          height={170}
          withDots={false}
          chartConfig={{
            backgroundColor: theme.chartBg,
            backgroundGradientFrom: theme.chartBg,
            backgroundGradientTo: theme.chartBg,
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            labelColor,
          }}
          bezier
          style={styles.chart}
        />
        <View style={styles.metricsRow}>
          <Text style={styles.accelValue}>{status.accel_mag_g.toFixed(2)} g</Text>
          <Text style={styles.gyroValue}>{status.gyro_mag_dps.toFixed(1)} dps</Text>
        </View>
      </View>

      <View style={[styles.statusCard, { backgroundColor: theme.card, borderLeftColor: status.fall_accident_alert || status.is_sos_pressed ? '#FF3B30' : '#4CAF50' }]}>
        <Text style={[styles.statusLabel, { color: theme.subText }]}>🚨 Cảm biến va đập / MPU6050:</Text>
        <Text style={[styles.statusValue, { color: status.fall_accident_alert || status.is_sos_pressed ? '#FF3B30' : '#4CAF50' }]}>
          {status.fall_accident_alert ? 'PHÁT HIỆN TÉ NGÃ!' : status.is_sos_pressed ? 'BÁO ĐỘNG SOS!' : 'An toàn - Bình thường'}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  chartCard: { padding: 15, borderRadius: 15, marginBottom: 15, elevation: 3 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 8 },
  currentAlcohol: { fontSize: 17, fontWeight: '900' },
  chartHint: { fontSize: 11, marginTop: -2, marginBottom: 4 },
  chart: { marginVertical: 8, borderRadius: 16, marginLeft: -10 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  accelValue: { color: '#007AFF', fontSize: 12, fontWeight: 'bold' },
  gyroValue: { color: '#9C27B0', fontSize: 12, fontWeight: 'bold' },
  statusCard: { padding: 16, borderRadius: 14, marginBottom: 15, elevation: 3, borderLeftWidth: 5 },
  statusLabel: { fontSize: 13, marginBottom: 4 },
  statusValue: { fontSize: 17, fontWeight: 'bold' },
});
