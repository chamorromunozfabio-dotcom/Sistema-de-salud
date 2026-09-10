import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck } from 'lucide-react';

export default function Verify2FA() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { needs2FA, verify2FA } = useAuth();
  const navigate = useNavigate();

  if (!needs2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-xl shadow text-center">
          <p>No hay verificación pendiente. Por favor inicia sesión.</p>
          <button onClick={() => navigate('/login')} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded">Ir a Login</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verify2FA(needs2FA.email, code);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Código inválido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Validación en 2 pasos</h1>
          <p className="text-gray-600 text-sm mt-2">Hemos enviado un código de 6 dígitos a <strong>{needs2FA.email}</strong>. Revisa tu email (expira en 5 minutos).</p>
          <p className="text-xs text-gray-500 mt-1">Hash seguro con bcrypt + tiempo de trabajo - código encriptado y temporal</p>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            className="w-full text-center text-2xl tracking-widest py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            required
            maxLength={6}
          />
          <button type="submit" disabled={loading || code.length !== 6} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Verificando...' : 'Verificar código'}
          </button>
          <p className="text-xs text-center text-gray-500">¿No recibido? Revisa spam o espera 1 minuto para reenviar (re-inicia login)</p>
        </form>
      </div>
    </div>
  );
}
