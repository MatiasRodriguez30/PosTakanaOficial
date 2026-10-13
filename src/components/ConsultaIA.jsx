import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { Bot, Send, User, Code2, Loader2, Sparkles } from 'lucide-react';

const SUGERENCIAS = [
  '¿Cuántos productos tengo cargados?',
  '¿Cuál fue el total facturado hoy?',
  '¿Cuáles son los 5 productos más vendidos?',
  '¿Qué medio de pago se usa más?',
];

// Asistente de IA (Gemini) para hacer preguntas en lenguaje natural sobre toda
// la base de datos. Es de solo consulta: el backend nunca ejecuta nada que no
// sea un SELECT, así que esta pantalla no puede modificar ni borrar datos.
export default function ConsultaIA() {
  const [mensajes, setMensajes] = useState([]); // { rol: 'user'|'ia', texto, sql?, error? }
  const [pregunta, setPregunta] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, loading]);

  const enviar = async (textoPregunta) => {
    const texto = (textoPregunta ?? pregunta).trim();
    if (!texto || loading) return;

    setMensajes(prev => [...prev, { rol: 'user', texto }]);
    setPregunta('');
    setLoading(true);

    try {
      const data = await api.post('/api/ai/consulta', { pregunta: texto });
      setMensajes(prev => [...prev, { rol: 'ia', texto: data.respuesta, sql: data.sql }]);
    } catch (e) {
      setMensajes(prev => [...prev, { rol: 'ia', texto: e.message || 'Ocurrió un error al consultar la IA', error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    enviar();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 border-b border-slate-700/50 shrink-0">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
          <Bot className="text-indigo-400" size={26} /> Asistente IA
        </h1>
        <p className="text-slate-400 text-sm mt-1">Preguntá en lenguaje natural sobre productos, ventas, categorías, etc. Solo consulta: nunca modifica datos.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {mensajes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-600 gap-4">
            <Sparkles size={48} className="opacity-30" />
            <p>Probá con alguna de estas preguntas</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGERENCIAS.map(s => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="px-3 py-1.5 rounded-full text-xs bg-slate-800/60 border border-slate-700 text-slate-300 hover:border-indigo-500/60 hover:text-indigo-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensajes.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.rol === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.rol === 'ia' && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <Bot size={16} className="text-indigo-400" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
              m.rol === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : m.error
                  ? 'bg-red-950/40 border border-red-900/50 text-red-300 rounded-tl-sm'
                  : 'glass-panel border border-slate-700/50 text-slate-200 rounded-tl-sm'
            }`}>
              {m.texto}
              {m.sql && (
                <details className="mt-2 pt-2 border-t border-slate-700/50">
                  <summary className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                    <Code2 size={12} /> Ver consulta SQL
                  </summary>
                  <pre className="mt-1.5 text-[11px] text-slate-400 bg-slate-950/60 rounded-lg p-2 overflow-x-auto">{m.sql}</pre>
                </details>
              )}
            </div>
            {m.rol === 'user' && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-slate-700/60 flex items-center justify-center">
                <User size={16} className="text-slate-300" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Bot size={16} className="text-indigo-400" />
            </div>
            <div className="glass-panel border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 size={14} className="animate-spin" /> Pensando...
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700/50 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={pregunta}
            onChange={e => setPregunta(e.target.value)}
            placeholder="Escribí tu pregunta..."
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !pregunta.trim()}
            className="shrink-0 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-colors flex items-center justify-center"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
