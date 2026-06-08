import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User, signInWithRedirect, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, updateDoc, increment } from 'firebase/firestore';

interface UserProfile {
  name: string;
  dateJoined: string | any;
  credits: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
  deductCredits: (amount: number) => Promise<boolean>;
  addCredits: (amount: number) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signInWithGoogle: async () => {},
  logOut: async () => {},
  deductCredits: async () => false,
  addCredits: async () => false
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(userRef);
          
          if (!docSnap.exists()) {
            const newProfile = {
              name: firebaseUser.displayName || 'Anonymous User',
              dateJoined: serverTimestamp(),
              credits: 100 // Starting credits
            };
            await setDoc(userRef, newProfile);
          }

          unsubscribeSnapshot = onSnapshot(userRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
              setProfile(docSnapshot.data() as UserProfile);
            }
          });
        } catch (error) {
          console.error("Error fetching/creating user profile:", error);
        }
      } else {
        setProfile(null);
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    // The Google Web Client ID for this project is:
    // 1031833096595-0hi0222tkigr7qedg5eruo80lapsaeu2.apps.googleusercontent.com
    // Note: Firebase Auth handles this ID internally via the connected Firebase Console.
    try {
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("Google sign in error", error);
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error", error);
    }
  };

  const deductCredits = async (amount: number) => {
    if (!user) return false;
    // Note: profile.credits might be updating via snapshot, but reading from state could be slightly stale.
    // However, validation in firestore rules also prevents negative credits if set up that way.
    if (profile && profile.credits < amount) return false;

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        credits: increment(-amount)
      });
      return true;
    } catch (error) {
      console.error("Error deducting credits:", error);
      return false;
    }
  };

  const addCredits = async (amount: number) => {
    if (!user) return false;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        credits: increment(amount)
      });
      return true;
    } catch (error) {
      console.error("Error adding credits:", error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, logOut, deductCredits, addCredits }}>
      {children}
    </AuthContext.Provider>
  );
};
