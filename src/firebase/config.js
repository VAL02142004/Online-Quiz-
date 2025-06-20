import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDZ3yhK1dWFk3b0cu6M1E23dVHIiOMbBgI", // Removed extra 0
  authDomain: "quiz-4d2ad.firebaseapp.com",
  projectId: "quiz-4d2ad",
  storageBucket: "quiz-4d2ad.appspot.com", // Changed to standard format
  messagingSenderId: "246176922248",
  appId: "1:246176922248:web:224a35fd8f6ac0f4f8bd3d",
  measurementId: "G-J62JMSVZX5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };