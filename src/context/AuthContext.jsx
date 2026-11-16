import { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';

const AuthContext = createContext();

// The hook and provider share a single context and are intentionally exported together.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  async function loginWithGoogle() {
    if (!auth) return;
    try {
      await signInWithPopup(auth, googleProvider);
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
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  }

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    isConfigured: isFirebaseConfigured,
    loginWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
