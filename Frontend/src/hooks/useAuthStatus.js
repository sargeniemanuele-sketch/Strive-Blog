import { useEffect, useState } from "react";
import { isAdmin } from "../utils/token";
import { clearAuthToken, getAuthToken } from "../utils/api";

/**
 * Ritorna true se il token JWT è scaduto (o malformato).
 * Legge il campo `exp` dal payload senza verificare la firma —
 * la verifica firma avviene lato server ad ogni richiesta protetta.
 */
const isTokenExpired = (token) => {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1]))
    return exp * 1000 < Date.now()
  } catch {
    return true  // token malformato → trattalo come scaduto
  }
}

/**
 * Snapshot dell'autenticazione corrente — funzione pura, nessun side-effect.
 * Ritorna isAuthenticated: false se il token non esiste o è scaduto.
 */
const getAuthSnapshot = () => {
  const token = getAuthToken()
  if (!token || isTokenExpired(token)) {
    return { isAuthenticated: false, isAdminUser: false }
  }
  return {
    isAuthenticated: true,
    isAdminUser: isAdmin()
  }
}

const useAuthStatus = () => {
  const [authState, setAuthState] = useState(getAuthSnapshot);

  useEffect(() => {
    // Pulizia al mount: rimuovi subito il token se scaduto,
    // così l'UI non mostra l'utente come autenticato con un token inutilizzabile.
    const token = getAuthToken()
    if (token && isTokenExpired(token)) {
      clearAuthToken()  // dispatcha 'auth-changed' → sync() si riesegue
    }

    const sync = () => setAuthState(getAuthSnapshot())
    window.addEventListener("storage", sync)
    window.addEventListener("auth-changed", sync)
    window.addEventListener("focus", sync)  // ri-controlla quando il tab torna in primo piano

    sync()

    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("auth-changed", sync)
      window.removeEventListener("focus", sync)
    }
  }, [])

  return authState
}

export default useAuthStatus;
