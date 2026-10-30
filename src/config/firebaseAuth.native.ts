import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { app } from './firebaseApp';

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
