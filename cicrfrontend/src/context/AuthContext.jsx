import React, { createContext, useContext, useEffect, useState } from 'react';
import { getMe } from '../api';

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  loading: true,
  refreshUser: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const { data } = await getMe();
      const userData = data?.result || data;
      if (userData) {
        setUser(userData);
        // Safely sync to localStorage for any lingering old components
        localStorage.setItem('profile', JSON.stringify(userData));
      } else {
        setUser(null);
        localStorage.removeItem('profile');
      }
    } catch (error) {
      console.error('Failed to authenticate user session:', error);
      setUser(null);
      localStorage.removeItem('profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    refreshUser: fetchUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
