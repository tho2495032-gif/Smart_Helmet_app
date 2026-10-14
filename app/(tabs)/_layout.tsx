import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; 

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, 
        tabBarActiveTintColor: '#FF3B30', 
        tabBarInactiveTintColor: 'gray',
      }}>
      
      {/* TAB 1: TRANG CHỦ */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      
      {/* TAB 2: BẢN ĐỒ */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Bản đồ',
          tabBarIcon: ({ color }) => <Ionicons name="map" size={24} color={color} />,
        }}
      />
      
      {/* TAB 3: LỊCH SỬ */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'Lịch sử',
          tabBarIcon: ({ color }) => <Ionicons name="time" size={24} color={color} />,
        }}
      />

      {/* TAB 4: TÀI KHOẢN (Chỉ khai báo 1 lần duy nhất ở đây) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Tài khoản',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}