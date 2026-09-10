import React, { useEffect, useState } from 'react';
import { getMyMedicalRecords, getAllMedicalRecords, deleteMedicalRecord, signMedicalRecord, generateAiProtocol, createMedicalRecord } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { FileText, Stethoscope, User, Plus, Trash2, CheckCircle, Sparkles, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MedicalRecords() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ patientId: '', chiefComplaint: '', diagnosis: '', historyOfPresentIllness: '', treatmentPlan: '' });
  const [aiContext, setAiContext] = useState('');
  const role = user?.role;

  const load = async () => {
    setLoading(true);
    setError('');
    // Paciente ve suyas, doctor ve suyas, admin ve todas -> usamos endpoint correspondiente
    const res = role === 'ADMIN' ? await getAllMedicalRecords() : await getMyMedicalRecords();
    if (res.error) setError(res.error);
    else setRecords(res.data as any[] || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientId || !form.chiefComplaint || !form.diagnosis) {
      setError('Completa paciente, motivo y diagnóstico');
      return;
    }
    const res = await createMedicalRecord(form);
    if (res.error) setError(res.error);
    else {
      setShowCreate(false);
      setForm({ patientId: '', chiefComplaint: '', diagnosis: '', historyOfPresentIllness: '', treatmentPlan: '' });
      load();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar historia clínica? Solo ADMIN puede hacerlo.')) return;
    const res = await deleteMedicalRecord(id);
    if (res.error) alert(res.error);
    else load();
  };

  const handleSign = async (id: string) => {
    const res = await signMedicalRecord(id);
    if (res.error) alert(res.error);
    else load();
  };

  const handleGenerateAI = async (id: string) => {
    const ctx = prompt('Contexto clínico para IA (ej: síntomas, signos vitales):', aiContext || 'paciente con dolor torácico y HTA');
    if (!ctx) return;
    const type = prompt('Tipo: protocolo / diagnostico / proceso / todo', 'todo') || 'todo';
    const res = await generateAiProtocol(id, ctx, type);
    if (res.error) alert(res.error);
    else {
      alert('IA Gemini generó protocolo/diagnóstico. Recarga para ver.');
      load();
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando historias...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-blue-600"/> Historia Clínica</h1>
        <div className="text-sm text-gray-600">
          {role === 'PATIENT' && 'Paciente la ve (solo tus historias)'}
          {role === 'DOCTOR' && 'Doctor la genera (crear/editar) + IA protocolo'}
          {role === 'ADMIN' && 'Admin las maneja o administra (CRUD total)'}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      {(role === 'DOCTOR' || role === 'ADMIN') && (
        <div className="mb-6">
          {!showCreate ? (
            <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Plus className="w-4 h-4"/> Nueva Historia (doctor genera)</button>
          ) : (
            <form onSubmit={handleCreate} className="bg-white p-4 rounded-xl border shadow space-y-3">
              <h3 className="font-semibold">Crear Historia Clínica - lógica real: doctor genera, admin administra</h3>
              <input placeholder="ID Paciente (UUID) - ej: paciente1 id" value={form.patientId} onChange={(e) => setForm({...form, patientId: e.target.value})} className="w-full border p-2 rounded" required />
              <input placeholder="Motivo consulta (chiefComplaint)" value={form.chiefComplaint} onChange={(e) => setForm({...form, chiefComplaint: e.target.value})} className="w-full border p-2 rounded" required />
              <textarea placeholder="Historia enfermedad actual" value={form.historyOfPresentIllness} onChange={(e) => setForm({...form, historyOfPresentIllness: e.target.value})} className="w-full border p-2 rounded" rows={2} />
              <input placeholder="Diagnóstico + CIE10 (ej: Hipertensión I10)" value={form.diagnosis} onChange={(e) => setForm({...form, diagnosis: e.target.value})} className="w-full border p-2 rounded" required />
              <textarea placeholder="Plan tratamiento" value={form.treatmentPlan} onChange={(e) => setForm({...form, treatmentPlan: e.target.value})} className="w-full border p-2 rounded" rows={2} />
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Guardar</button>
                <button type="button" onClick={() => setShowCreate(false)} className="bg-gray-200 px-4 py-2 rounded">Cancelar</button>
              </div>
              <p className="text-xs text-gray-500">Hint: para demo usa ID de paciente1 visible en Admin → Usuarios</p>
            </form>
          )}
        </div>
      )}

      <div className="grid gap-4">
        {records.length === 0 && <div className="bg-white p-8 rounded text-center text-gray-500 border">Sin historias clínicas. {role==='PATIENT' ? 'Cuando un doctor genere tu historia aparecerá aquí.' : 'Crea la primera.'}</div>}
        {records.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border p-5 shadow-sm">
            <div className="flex justify-between">
              <div>
                <div className="font-semibold text-slate-800 flex items-center gap-2"><Stethoscope className="w-4 h-4 text-blue-600"/> {r.chiefComplaint} <span className={`text-xs px-2 py-0.5 rounded ${r.status==='SIGNED' ? 'bg-green-100 text-green-700' : r.status==='FINAL' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.status}</span></div>
                <div className="text-sm text-gray-600 mt-1">Paciente: {r.patient?.firstName} {r.patient?.lastName} ({r.patient?.email}) {r.patient?.dni && `DNI ${r.patient.dni}`}</div>
                <div className="text-sm text-gray-600">Doctor: {r.doctor?.firstName} {r.doctor?.lastName} {r.doctorProfile?.hospital && `· ${r.doctorProfile.hospital} · ${r.doctorProfile.specialty?.name}`}</div>
                <div className="text-sm mt-2"><strong>Diagnóstico:</strong> {r.diagnosis} {r.diagnosisCode && `(${r.diagnosisCode})`}</div>
                {r.treatmentPlan && <div className="text-sm"><strong>Plan:</strong> {r.treatmentPlan}</div>}
                {r.physicalExam && <div className="text-sm"><strong>Examen:</strong> {r.physicalExam}</div>}
                {r.vitalSigns && <div className="text-xs bg-slate-50 p-2 rounded mt-2"><strong>Signos vitales:</strong> {JSON.stringify(r.vitalSigns)}</div>}
                {r.aiProtocol && <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded"><div className="text-xs font-bold text-indigo-700 flex items-center gap-1"><Sparkles className="w-3 h-3"/> Protocolo IA (Gemini):</div><div className="text-sm whitespace-pre-wrap">{r.aiProtocol}</div></div>}
                {r.aiDiagnosisSupport && <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded"><div className="text-xs font-bold text-purple-700">Diagnóstico IA:</div><div className="text-sm whitespace-pre-wrap">{r.aiDiagnosisSupport}</div></div>}
                {r.prescriptions?.length > 0 && <div className="text-xs mt-2"><strong>Recetas:</strong> {r.prescriptions.map((p: any) => `${p.medication} ${p.dosage} ${p.frequency} (${p.duration})`).join(' | ')}</div>}
                <div className="text-xs text-gray-400 mt-2">Visita: {new Date(r.visitDate).toLocaleString()} · Creada {new Date(r.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="flex flex-col gap-2 ml-4">
                <button onClick={() => handleGenerateAI(r.id)} className="text-xs bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 py-1.5 rounded flex items-center gap-1"><Sparkles className="w-3 h-3"/> IA: protocolo/diagnóstico</button>
                {(role==='DOCTOR' || role==='ADMIN') && r.status !== 'SIGNED' && <button onClick={() => handleSign(r.id)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Firmar</button>}
                {role==='ADMIN' && <button onClick={() => handleDelete(r.id)} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded flex items-center gap-1"><Trash2 className="w-3 h-3"/> Eliminar (admin)</button>}
                <Link to={`/medical-records/${r.id}`} className="text-xs bg-white border px-3 py-1.5 rounded text-center flex items-center gap-1 justify-center"><Eye className="w-3 h-3"/> Ver detalle</Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-bold text-sm">Lógica de negocio real implementada:</h4>
        <ul className="text-xs text-slate-700 list-disc ml-5 mt-2 space-y-1">
          <li><strong>Paciente la ve:</strong> solo lectura de sus propias historias (pacienteId === user.id) - ver detalle, protocolo IA</li>
          <li><strong>Doctor la genera:</strong> crea con patientId, diagnóstico, vitales, examen, tratamiento, recetas; genera protocolo/diagnóstico con Gemini API</li>
          <li><strong>Admin las maneja o administra:</strong> CRUD total, firma, archiva, elimina, ve logs de auditoría</li>
          <li>Estados: DRAFT → FINAL → SIGNED (firmada) → ARCHIVED, con auditoría de cada cambio</li>
          <li>IA Gemini: endpoint POST /medical-records/:id/generate-ai con prompt clínico genera protocolo a seguir por paciente y doctor + diagnóstico diferencial + procesos</li>
        </ul>
      </div>
    </div>
  );
}
