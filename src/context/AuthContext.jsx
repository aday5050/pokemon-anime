import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithRedirect, signOut, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loginWithGoogle() {
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      console.error("Error logging in with Google:", error);
    }
  }

  async function logout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  }

  useEffect(() => {
    // Verificar si venimos de un redirect de Google
    getRedirectResult(auth).then((result) => {
      if (result) {
        console.log("Login successful:", result.user);
      }
    }).catch((error) => {
      console.error("Error en el redirect:", error);
      alert("Error al iniciar sesión: " + error.message);
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loginWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
