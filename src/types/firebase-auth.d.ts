import 'firebase/auth';

declare module 'firebase/auth' {
  /** Available from Firebase's React Native entry point. */
  export function getReactNativePersistence(
    storage: import('firebase/auth').ReactNativeAsyncStorage,
  ): import('firebase/auth').Persistence;
}
