import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAaCrETjLPHWlZTodSQ-vvslg7sTEB2l-w",
  authDomain: "stealthpdf-f4564.firebaseapp.com",
  projectId: "stealthpdf-f4564",
  storageBucket: "stealthpdf-f4564.firebasestorage.app",
  messagingSenderId: "1031833096595",
  appId: "1:1031833096595:web:cf791539d959231aa69866",
  measurementId: "G-8Y17Q7LQ6Y"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
