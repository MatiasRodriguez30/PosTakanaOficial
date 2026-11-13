import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getApiUrl, setApiUrl } from '../api';
import { User, Lock, Settings, Sun, Moon, Check } from 'lucide-react';

const Login = ({ temaOscuro, onAlternarTema }) => {
  const { login } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [mostrarServidor, setMostrarServidor] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState(() => getApiUrl());
  const [servidorGuardado, setServidorGuardado] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión. Revisá tus datos e intentá de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const guardarServidor = (e) => {
    e.preventDefault();
    setApiUrl(apiUrlInput);
    setServidorGuardado(true);
    setTimeout(() => setServidorGuardado(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 relative">
      {onAlternarTema && (
        <button
          type="button"
          onClick={onAlternarTema}
          aria-label={temaOscuro ? 'Cambiar a tema claro' : 'Cambiar a modo oscuro'}
          className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          {temaOscuro ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      )}

      <div className="w-full max-w-sm space-y-4">
        <div className="surface-card p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-11 h-11 rounded-lg bg-brand-700 text-white flex items-center justify-center font-bold text-xl mb-3 select-none">
              T
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Takana Mascota
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">
              Terminal de Punto de Venta
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-usuario" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <User size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
                <input
                  id="login-usuario"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-base h-11 pl-10"
                  placeholder="Ingresá tu usuario"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" />
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base h-11 pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="text-red-800 dark:text-red-200 text-xs font-medium bg-red-50 dark:bg-red-950/50 px-3 py-2.5 rounded-lg border border-red-300 dark:border-red-800"
              >
                {error}
              </div>
            )}

            <button type="submit" disabled={isLoading} className="w-full min-h-[46px] btn-brand text-sm">
              {isLoading ? 'Conectando...' : 'Entrar al sistema'}
            </button>
          </form>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setMostrarServidor((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 py-1 px-2"
          >
            <Settings size={13} />
            Configurar dirección del servidor
          </button>

          {mostrarServidor && (
            <form onSubmit={guardarServidor} className="mt-2 surface-card p-3.5 text-left space-y-2">
              <label htmlFor="api-url-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Dirección del servidor (API)
              </label>
              <div className="flex gap-2">
                <input
                  id="api-url-input"
                  type="url"
                  value={apiUrlInput}
                  onChange={(e) => setApiUrlInput(e.target.value)}
                  placeholder="https://posapi.takana.online"
                  className="input-base h-9 flex-1 font-mono text-xs"
                />
                <button type="submit" className="btn-secondary px-3 h-9 text-xs shrink-0 inline-flex items-center gap-1">
                  {servidorGuardado ? <Check size={14} className="text-green-700" /> : null}
                  {servidorGuardado ? 'Guardado' : 'Guardar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
