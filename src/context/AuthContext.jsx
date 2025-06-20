import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  async function register(email, password, role, additionalData) {
    try {
      // First check if any extensions might be blocking Firebase
      if (typeof window !== 'undefined' && window.navigator && window.navigator.webdriver) {
        throw new Error('Browser extensions may be blocking Firebase requests. Please disable ad blockers for this site.');
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Save user data to Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email,
        role,
        ...additionalData,
        createdAt: serverTimestamp(),
        isActive: true
      });
      
      // Update display name in Firebase Auth if name is provided
      if (additionalData?.name) {
        await updateProfile(user, {
          displayName: additionalData.name
        });
      }
      
      return user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async function login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error('Account not found');
      }
      
      if (userDoc.data().isActive === false) {
        await signOut(auth);
        throw new Error('Account is disabled');
      }
      
      return userCredential;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async function disableUser(uid) {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isActive: false
      });
      return true;
    } catch (error) {
      console.error('Disable user error:', error);
      throw error;
    }
  }

  async function enableUser(uid) {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isActive: true
      });
      return true;
    } catch (error) {
      console.error('Enable user error:', error);
      throw error;
    }
  }

  async function logout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async function getUserRole(uid) {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data().role;
      }
      return null;
    } catch (error) {
      console.error("Error getting user role:", error);
      return null;
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().isActive !== false) {
            setCurrentUser(user);
            const role = await getUserRole(user.uid);
            setUserRole(role);
          } else {
            await signOut(auth);
            setCurrentUser(null);
            setUserRole(null);
          }
        } else {
          setCurrentUser(null);
          setUserRole(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    register,
    login,
    logout,
    loading,
    disableUser,
    enableUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}