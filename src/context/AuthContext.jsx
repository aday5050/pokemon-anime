import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
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
      const result = await signInWithPopup(auth, googleProvider);
      console.log("Login exitoso:", result.user);
    } catch (error) {
      console.error("Error logging in with Google:", error);
      if (error.code === 'auth/popup-blocked') {
        alert("⚠️ TU NAVEGADOR HA BLOQUEADO EL INICIO DE SESIÓN ⚠️\n\nPor favor, busca el icono de 'Ventana emergente bloqueada' en la barra de direcciones (arriba a la derecha), haz clic en él y selecciona 'Permitir siempre'. Luego vuelve a intentarlo.");
      } else {
        alert("Error al iniciar sesión: " + error.message);
      }
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
