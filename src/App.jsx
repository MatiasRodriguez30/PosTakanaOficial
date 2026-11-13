import React, { useContext, useEffect, useState } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Login from './components/Login';
import POS from './components/POS';
import Historial from './components/Historial';
import Productos from './components/Productos';
import Catalogos from './components/Catalogos';
import ConsultaPrecio from './components/ConsultaPrecio';
import ConsultaIA from './components/ConsultaIA';
import EstadoConexion from './components/EstadoConexion';
import { leerVentasPendientes } from './sinConexion';
import { leerSonidoEscaneo, guardarSonidoEscaneo } from './formato';
import {
  Store,
  Package,
  Tag,
  History,
  LogOut,
  User,
  Search,
  Bot,
  Sun,
  Moon,
  Volume2,
  VolumeX,
} from 'lucide-react';

const MarcaTakana = () => (
  <div className="w-8 h-8 rounded-lg bg-brand-700 text-white flex items-center justify-center shrink-0 font-bold text-base select-none">
    T
  </div>
);

const MainLayout = () => {
  const { user, loading, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('pos');
  const [temaOscuro, setTemaOscuro] = useState(() => {
    try {
      return localStorage.getItem('TAKANA_THEME') === 'dark';
    } catch {
      return false;
    }
  });
  const [sonidoActivo, setSonidoActivo] = useState(() => leerSonidoEscaneo());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', temaOscuro);
    try {
      localStorage.setItem('TAKANA_THEME', temaOscuro ? 'dark' : 'light');
    } catch {
      // ignorar
    }
  }, [temaOscuro]);

  const alternarSonido = () => {
    setSonidoActivo((prev) => {
      const siguiente = !prev;
      guardarSonidoEscaneo(siguiente);
      return siguiente;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 gap-3">
        <div className="w-8 h-8 border-2 border-brand-700 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Cargando sistema...</p>
      </div>
    );
  }

  if (!user) return <Login temaOscuro={temaOscuro} onAlternarTema={() => setTemaOscuro((v) => !v)} />;

  const menuItems = [
    { id: 'pos', label: 'Terminal POS', shortLabel: 'Terminal', icon: Store, roles: ['admin', 'vendedor'] },
    { id: 'consulta', label: 'Consultar Precio', shortLabel: 'Precios', icon: Search, roles: ['admin', 'vendedor', 'invitado'] },
    { id: 'historial', label: 'Historial de Ventas', shortLabel: 'Historial', icon: History, roles: ['admin', 'vendedor'] },
    { id: 'productos', label: 'Productos', shortLabel: 'Productos', icon: Package, roles: ['admin'] },
    { id: 'catalogos', label: 'Catálogos', shortLabel: 'Catálogos', icon: Tag, roles: ['admin'] },
    { id: 'ia', label: 'Asistente IA', shortLabel: 'IA', icon: Bot, roles: ['admin'] },
  ];

  const allowedItems = menuItems.filter((item) => item.roles.includes(user.rol));
  const currentTab = allowedItems.some((item) => item.id === activeTab)
    ? activeTab
    : (allowedItems[0]?.id || 'consulta');

  // Las ventas sin enviar quedan guardadas en el equipo y se envían cuando este
  // usuario vuelva a entrar: avisar antes de cerrar sesión.
  const salir = () => {
    const pendientes = leerVentasPendientes().filter((v) => v.usuario === user.username).length;
    if (
      pendientes > 0 &&
      !window.confirm(
        `Hay ${pendientes === 1 ? '1 venta' : `${pendientes} ventas`} sin enviar. Quedan guardadas en este equipo ` +
          'y se envían cuando vuelvas a entrar con este usuario y haya conexión.\n\n¿Cerrar sesión igual?'
      )
    ) {
      return;
    }
    logout();
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Barra superior (solo móvil) */}
      <header className="md:hidden flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-20 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <MarcaTakana />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
              Takana Mascota
            </h2>
            <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
              <User size={11} className="shrink-0" />
              <span className="truncate">{user.username}</span>
              <span>·</span>
              <span className="capitalize">{user.rol}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={alternarSonido}
            aria-label={sonidoActivo ? 'Silenciar sonido de escaneo' : 'Activar sonido de escaneo'}
            title={sonidoActivo ? 'Sonido de escaneo activado' : 'Sonido de escaneo silenciado'}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {sonidoActivo ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setTemaOscuro((v) => !v)}
            aria-label={temaOscuro ? 'Cambiar a tema claro' : 'Cambiar a modo oscuro'}
            title={temaOscuro ? 'Tema claro' : 'Modo oscuro'}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {temaOscuro ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            onClick={salir}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Riel lateral (escritorio y tablet) */}
      <aside className="hidden md:flex w-60 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-col z-20 shrink-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <MarcaTakana />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Takana Mascota
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">Punto de Venta</p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <User size={13} className="text-slate-500 dark:text-slate-400 shrink-0" />
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{user.username}</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium capitalize bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 shrink-0">
              {user.rol}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1" aria-label="Navegación principal">
          {allowedItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg transition-colors text-sm font-medium border ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-800 dark:text-brand-300 border-brand-200 dark:border-brand-800 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border-transparent'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-brand-700 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-2.5 border-t border-slate-200 dark:border-slate-700 space-y-1">
          <button
            type="button"
            onClick={alternarSonido}
            className="w-full flex items-center justify-between px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
          >
            <span className="flex items-center gap-2.5">
              {sonidoActivo ? <Volume2 size={16} className="text-brand-700 dark:text-brand-400" /> : <VolumeX size={16} className="text-slate-400" />}
              Sonido de escáner
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${sonidoActivo ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
              {sonidoActivo ? 'Sí' : 'No'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTemaOscuro((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
          >
            <span className="flex items-center gap-2.5">
              {temaOscuro ? <Sun size={16} className="text-amber-500" /> : <Moon size={16} className="text-slate-500" />}
              {temaOscuro ? 'Tema claro' : 'Modo oscuro'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {temaOscuro ? 'Oscuro' : 'Claro'}
            </span>
          </button>

          <button
            type="button"
            onClick={salir}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-lg transition-colors text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 flex flex-col relative z-10 overflow-hidden min-h-0">
        <EstadoConexion />
        {currentTab === 'pos' && <POS />}
        {currentTab === 'consulta' && <ConsultaPrecio />}
        {currentTab === 'historial' && <Historial />}
        {currentTab === 'productos' && <Productos />}
        {currentTab === 'catalogos' && <Catalogos />}
        {currentTab === 'ia' && <ConsultaIA />}
      </main>

      {/* Navegación inferior (solo móvil) */}
      <nav
        aria-label="Navegación móvil"
        className="md:hidden flex items-stretch justify-around bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-20 shrink-0 pb-[env(safe-area-inset-bottom)]"
      >
        {allowedItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[52px] py-1.5 text-[11px] font-medium border-t-2 transition-colors ${
                isActive
                  ? 'border-brand-700 dark:border-brand-400 text-brand-700 dark:text-brand-300 bg-brand-50/50 dark:bg-brand-950/30 font-semibold'
                  : 'border-transparent text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon size={19} />
              <span className="truncate max-w-[64px]">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <MainLayout />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
