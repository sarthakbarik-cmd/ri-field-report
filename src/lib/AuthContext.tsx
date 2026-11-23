import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import {
  loginWithGoogle,
  logoutUser,
  syncUserProfile,
  getUserProfile,
} from '../services/cloudSyncService';
import { saveRIProfile } from '../utils/storage';
import { UserProfile } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: () => Promise<FirebaseUser | null>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  isCloudSynced: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  login: async () => null,
  logout: async () => {},
  updateProfile: async () => {},
  isCloudSynced: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  function applyCloudProfile(profile: UserProfile, uid: string) {
    saveRIProfile({
      riName: profile.name,
      riCircle: profile.riCircle || '',
      tahasil: profile.tahasil,
      district: profile.district,
      designation: profile.designation,
      officeName: profile.officeName,
      letterNoPrefix: profile.letterNoPrefix,
      phone: profile.phone,
    }, uid);
    setUserProfile(profile);
  }

  useEffect(() => {
    let revision = 0;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const request = ++revision;
      setUser(currentUser);
      setUserProfile(null);
      setLoading(!!currentUser);
      if (!currentUser) return;
      try {
        const profile = (await getUserProfile(currentUser.uid)) ?? (await syncUserProfile(currentUser));
        if (request === revision) applyCloudProfile(profile, currentUser.uid);
      } catch (err) {
        console.error('Failed to load user profile from cloud:', err);
      } finally {
        if (request === revision) setLoading(false);
      }
    });
    return () => {
      revision++;
      unsubscribe();
    };
  }, []);

  const login = async () => {
    setLoading(true);
    try {
      return await loginWithGoogle();
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await logoutUser();
      setUser(null);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user || auth.currentUser?.uid !== user.uid) throw new Error('Sign in again before saving your profile.');
    const updated = await syncUserProfile(user, data);
    if (auth.currentUser?.uid !== user.uid) throw new Error('Your account changed while saving.');
    applyCloudProfile(updated, user.uid);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        login,
        logout,
        updateProfile,
        isCloudSynced: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
