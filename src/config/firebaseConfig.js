import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
// Đổi getAuth thành initializeAuth và thêm getReactNativePersistence
import { initializeAuth, getReactNativePersistence } from 'firebase/auth'; 
import { getDatabase } from 'firebase/database'; // Dùng cho dữ liệu GPS realtime
import { getFirestore } from 'firebase/firestore'; // Dùng lưu lịch sử
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAhHmEQ5qWfpqfNi66oXUWGyY6ICJAzW8w",
  authDomain: "smarthelmet-thesis.firebaseapp.com",
  projectId: "smarthelmet-thesis",
  storageBucket: "smarthelmet-thesis.firebasestorage.app",
  messagingSenderId: "185677616159",
  appId: "1:185677616159:web:b7410a9e90ec9f431c312a",
  databaseURL: "https://smarthelmet-thesis-default-rtdb.asia-southeast1.firebasedatabase.app",
  measurementId: "G-7K8RS4V9QL"
};

const app = initializeApp(firebaseConfig);

// Khởi tạo Auth có kèm chức năng lưu trạng thái đăng nhập
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const realtimeDB = getDatabase(app);
export const firestoreDB = getFirestore(app);