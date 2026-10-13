import React, { createContext, useState, useEffect } from 'react';
import { api } from '../api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Inicializar estado desde localStorage
  useEffect(() => {
    const token = localStorage.getItem('TAKANA_TOKEN');
    const rol = localStorage.getItem('TAKANA_USER_ROL');
    const username = localStorage.getItem('TAKANA_USERNAME');

    if (token && rol && username) {
      setUser({ token, rol, username });
    }
    setLoading(false);

    // Escuchar el evento de sesión expirada emitido por api.js
    const handleAuthExpired = () => {
      setUser(null);
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  const login = async (username, password) => {
    try {
      // El endpoint de FastAPI OAuth2 espera Content-Type application/json o x-www-form-urlencoded
      // Nuestro backend lo espera como JSON gracias al schema UsuarioCreate
      const response = await api.post('/api/auth/login', { username, password, rol: '' });
      
      localStorage.setItem('TAKANA_TOKEN', response.access_token);
      localStorage.setItem('TAKANA_USER_ROL', response.rol);
      localStorage.setItem('TAKANA_USERNAME', response.username);
      
      setUser({
        token: response.access_token,
        rol: response.rol,
        username: response.username
      });
      return true;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('TAKANA_TOKEN');
    localStorage.removeItem('TAKANA_USER_ROL');
    localStorage.removeItem('TAKANA_USERNAME');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
