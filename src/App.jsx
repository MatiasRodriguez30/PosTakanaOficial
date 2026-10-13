import React, { useContext, useState } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Login from './components/Login';
import POS from './components/POS';
import Historial from './components/Historial';
import Productos from './components/Productos';
import Catalogos from './components/Catalogos';
import ConsultaPrecio from './components/ConsultaPrecio';
import ConsultaIA from './components/ConsultaIA';
import { Store, Package, Tag, History, LogOut, User, Search, Bot } from 'lucide-react';

const MainLayout = () => {
  const { user, loading, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('pos');

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0f19] gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm">Cargando...</p>
      </div>
    );
  }

  if (!user) return <Login />;

  const menuItems = [
    { id: 'pos',         label: 'Terminal POS',       icon: Store,   roles: ['admin', 'vendedor'] },
    { id: 'consulta',    label: 'Consultar Precio',   icon: Search,  roles: ['admin', 'vendedor', 'invitado'] },
    { id: 'historial',  label: 'Registros de Venta',  icon: History, roles: ['admin', 'vendedor'] },
    { id: 'productos',  label: 'Productos',            icon: Package, roles: ['admin'] },
    { id: 'catalogos',  label: 'Catálogos',            icon: Tag,     roles: ['admin'] },
    { id: 'ia',         label: 'Asistente IA',         icon: Bot,     roles: ['admin'] },
  ];

  const allowedItems = menuItems.filter(item => item.roles.includes(user.rol));

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#0b0f19] text-slate-100 overflow-hidden">
      {/* Barra superior (solo mobile) */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 glass-panel border-b border-slate-700/50 z-20 shrink-0">
        <div>
          <h2 className="text-base font-bold text-slate-100">
            Takana Mascota
          </h2>
          <div className="flex items-center gap-1.5">
            <User size={11} className="text-slate-500" />
            <p className="text-xs text-slate-400">{user.username}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="p-2 rounded-lg text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/50"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-60 glass-panel border-r border-slate-700/50 flex-col z-20">
        <div className="p-5 border-b border-slate-700/50">
          <h2 className="text-lg font-bold text-slate-100">
            Takana Mascota
          </h2>
          <div className="flex items-center gap-1.5 mt-2">
            <User size={12} className="text-slate-500" />
            <p className="text-xs text-slate-400">{user.username}</p>
            <span className="text-slate-600">·</span>
            <p className="text-xs text-slate-500 capitalize">{user.rol}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {allowedItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Icon size={17} className={isActive ? 'text-indigo-400' : ''} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-700/50">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/50"
          >
            <LogOut size={17} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 flex flex-col relative z-10 overflow-hidden min-h-0">
        {activeTab === 'pos'        && <POS />}
        {activeTab === 'consulta'   && <ConsultaPrecio />}
        {activeTab === 'historial'  && <Historial />}
        {activeTab === 'productos'  && <Productos />}
        {activeTab === 'catalogos'  && <Catalogos />}
        {activeTab === 'ia'         && <ConsultaIA />}
      </main>

      {/* Navegación inferior (solo mobile) */}
      <nav className="md:hidden flex items-stretch justify-around glass-panel border-t border-slate-700/50 z-20 shrink-0 pb-[env(safe-area-inset-bottom)]">
        {allowedItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-all ${
                isActive ? 'text-indigo-400' : 'text-slate-500'
              }`}
            >
              <Icon size={19} />
              {item.label.split(' ')[0]}
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


