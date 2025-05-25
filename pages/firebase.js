import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCQkmsPAJ0EVd1fOTcTIzEBtj197o1Rdlc",
  authDomain: "authentication-215cb.firebaseapp.com",
  projectId: "authentication-215cb",
  storageBucket: "authentication-215cb.firebasestorage.app",
  messagingSenderId: "988966492862",
  appId: "1:988966492862:web:f8d4faddbfecc8f2c51cef",
  measurementId: "G-Q485FWL12Y"
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;