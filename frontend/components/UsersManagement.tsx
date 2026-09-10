import React, { useEffect, useState } from 'react';
import { getAllUsers, getPatients, getDoctorsUsers, createDoctorUser, deleteUser, toggleUserActive, updateUser } from '../services/apiService';
import { getAllSpecialties } from '../services/apiService';
import { Trash2, UserPlus, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UsersManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [tab, setTab] = useState<'all' | 'patients' | 'doctors'>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', dni: '', specialtyId: '', hospital: '' });

  const load = async () => {
    setLoading(true);
    const res = tab === 'patients' ? await getPatients(search) : tab === 'doctors' ? await getDoctorsUsers(search) : await getAllUsers(undefined, search);
    if (res.error) setError(res.error);
    else setUsers(res.data as any[] || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);
  useEffect(() => {
    getAllSpecialties().then((r) => {
      if (r.data) setSpecialties((r.data as any[]) || []);
    });
  }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(); };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createDoctorUser(form);
    if (res.error) setError(res.error);
    else {
      alert(`Doctor creado. Credenciales otorgadas: ${form.email} / ${form.password} (comunicar al doctor)`);
      setShowDoctorForm(false);
      setForm({ email: '', password: '', firstName: '', lastName: '', phone: '', dni: '', specialtyId: '', hospital: '' });
      load();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar usuario? Si es doctor con turnos pendientes fallará.')) return;
    const res = await deleteUser(id);
    if (res.error) alert(res.error);
    else load();
  };

  const handleToggle = async (id: string) => {
    const res = await toggleUserActive(id);
    if (res.error) alert(res.error);
    else load();
  };

  if (!isAdmin) return <div className="p-8 text-center">Solo ADMIN puede gestionar usuarios. Tu rol: {user?.role}</div>;

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">Gestión de Usuarios - CRUD para todo (ADMIN maneja todo)</h1>
      <p className="text-sm text-gray-600 mb-4">Pacientes: auto-registro. Doctores: solo ADMIN los registra y les otorga user y password. Admin maneja todo.</p>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('all')} className={`px-4 py-2 rounded ${tab==='all'?'bg-blue-600 text-white':'bg-white border'}`}>Todos</button>
        <button onClick={() => setTab('patients')} className={`px-4 py-2 rounded ${tab==='patients'?'bg-blue-600 text-white':'bg-white border'}`}>Pacientes</button>
        <button onClick={() => setTab('doctors')} className={`px-4 py-2 rounded ${tab==='doctors'?'bg-blue-600 text-white':'bg-white border'}`}>Doctores</button>
        <button onClick={() => setShowDoctorForm(!showDoctorForm)} className="ml-auto bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2"><UserPlus className="w-4 h-4"/> Registrar Doctor (solo admin)</button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, email, DNI" className="w-full pl-9 pr-3 py-2 border rounded"/>
        </div>
        <button type="submit" className="bg-white border px-4 py-2 rounded">Buscar</button>
        <button type="button" onClick={load} className="bg-white border px-4 py-2 rounded">Refrescar</button>
      </form>

      {showDoctorForm && (
        <form onSubmit={handleCreateDoctor} className="bg-white p-4 rounded border shadow mb-6 space-y-3">
          <h3 className="font-semibold">Registrar Doctor - ADMIN otorga user y password (requisito)</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="border p-2 rounded" required />
            <input placeholder="Password temporal (otorgado por admin)" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} className="border p-2 rounded" required />
            <input placeholder="Nombre" value={form.firstName} onChange={(e) => setForm({...form, firstName: e.target.value})} className="border p-2 rounded" required />
            <input placeholder="Apellido" value={form.lastName} onChange={(e) => setForm({...form, lastName: e.target.value})} className="border p-2 rounded" required />
            <input placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="border p-2 rounded" />
            <input placeholder="DNI" value={form.dni} onChange={(e) => setForm({...form, dni: e.target.value})} className="border p-2 rounded" />
            <select value={form.specialtyId} onChange={(e) => setForm({...form, specialtyId: e.target.value})} className="border p-2 rounded" required>
              <option value="">-- Especialidad --</option>
              {specialties.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input placeholder="Hospital" value={form.hospital} onChange={(e) => setForm({...form, hospital: e.target.value})} className="border p-2 rounded" required />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Crear Doctor</button>
            <button type="button" onClick={() => setShowDoctorForm(false)} className="bg-gray-200 px-4 py-2 rounded">Cancelar</button>
          </div>
        </form>
      )}

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}

      {loading ? <div className="text-center p-8">Cargando...</div> : (
        <div className="bg-white rounded border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr><th className="p-3 text-left">Usuario</th><th className="p-3">Rol</th><th className="p-3">DNI</th><th className="p-3">Activo</th><th className="p-3">2FA</th><th className="p-3">Acciones</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3"><div className="font-medium">{u.firstName} {u.lastName}</div><div className="text-xs text-gray-500">{u.email}</div><div className="text-xs text-gray-500">{u.phone}</div>{u.doctorProfile && <div className="text-xs text-blue-600">{u.doctorProfile.hospital} · {u.doctorProfile.specialty?.name}</div>}</td>
                  <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-xs ${u.role==='ADMIN'?'bg-purple-100 text-purple-700':u.role==='DOCTOR'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{u.role}</span></td>
                  <td className="p-3 text-center">{u.dni || '-'}</td>
                  <td className="p-3 text-center">{u.isActive ? '✅' : '❌'}</td>
                  <td className="p-3 text-center">{u.twoFactorEnabled ? '🔐' : '-'}</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => handleToggle(u.id)} className="p-1.5 bg-yellow-100 hover:bg-yellow-200 rounded" title="Activar/Desactivar">{u.isActive ? <ToggleRight className="w-4 h-4 text-green-600"/> : <ToggleLeft className="w-4 h-4 text-gray-500"/>}</button>
                      <button onClick={() => handleDelete(u.id)} className="p-1.5 bg-red-100 hover:bg-red-200 rounded"><Trash2 className="w-4 h-4 text-red-600"/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length===0 && <div className="p-8 text-center text-gray-500">Sin usuarios</div>}
        </div>
      )}

      <div className="mt-6 p-4 bg-slate-50 rounded border text-xs">
        <strong>Logs de auditoría:</strong> tabla <code>audit_logs</code> registra REGISTER, LOGIN, CREATE_DOCTOR, UPDATE_USER, DELETE_USER, CREATE_MEDICAL_RECORD, etc con IP y userAgent. Ver en <code>/audit/logs</code> (solo ADMIN) o en Prisma Studio.
      </div>
    </div>
  );
}
