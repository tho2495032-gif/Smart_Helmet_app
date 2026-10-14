import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Khai báo file index (Login) chạy đầu tiên */}
      <Stack.Screen name="index" />
      {/* Khai báo cụm (tabs) để Login xong chui vào */}
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}