import { getAuth } from 'firebase/auth';
import { app } from './firebaseApp';

// Expo resolves firebaseAuth.native.ts on native and this file on web.
export const auth = getAuth(app);
