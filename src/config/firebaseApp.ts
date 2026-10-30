import { getApp, getApps, initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

const firebaseOptions = {
  apiKey: 'AIzaSyAhHmEQ5qWfpqfNi66oXUWGyY6ICJAzW8w',
  authDomain: 'smarthelmet-thesis.firebaseapp.com',
  projectId: 'smarthelmet-thesis',
  storageBucket: 'smarthelmet-thesis.firebasestorage.app',
  messagingSenderId: '185677616159',
  appId: '1:185677616159:web:b7410a9e90ec9f431c312a',
  databaseURL: 'https://smarthelmet-thesis-default-rtdb.asia-southeast1.firebasedatabase.app',
  measurementId: 'G-7K8RS4V9QL',
};

export const app = getApps().length ? getApp() : initializeApp(firebaseOptions);
export const realtimeDB = getDatabase(app);
export const firestoreDB = getFirestore(app);
