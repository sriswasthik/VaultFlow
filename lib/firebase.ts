
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD-fxvOZc-3wfWQjeVj0M_wGcqTU7EgnTc",
  authDomain: "voltflow-688c8.firebaseapp.com",
  projectId: "voltflow-688c8",
  storageBucket: "voltflow-688c8.firebasestorage.app",
  messagingSenderId: "395327012815",
  appId: "1:395327012815:web:608d1fa63628167a35dcba"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Storage
export const storage = getStorage(app);
