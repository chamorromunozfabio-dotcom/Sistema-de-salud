import React, { useState, useEffect } from 'react';
import { Send, AlertCircle, CheckCircle, Loader, Stethoscope, CalendarCheck, FileText, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { analyzeSymptoms } from '../services/geminiService';
import { TriageResult } from '../types';
import { useAuth } from '../context/AuthContext';
import { getPatients, createMedicalRecord } from '../services/apiService';

const TriageChat: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDoctor = user?.role === 'DOCTOR';
  const isPatient = user?.role === 'PATIENT';
  const [symptoms, setSymptoms] = useState('');
  const [result, setResult] = useState<TriageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

  useEffect(() => {
    if (isDoctor) {
      getPatients().then((r: any) => { if (r.data) setPatients(r.data as any[]); });
    }
  }, [isDoctor]);

  const handleAnalyze = async () => {
    if (!symptoms.trim()) {
      setError('Por favor, describe tus síntomas');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const triageResult = await analyzeSymptoms(symptoms);
      setResult(triageResult);
    } catch (err) {
      setError('Error al analizar los síntomas. Por favor, intenta nuevamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'Alta':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'Media':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Baja':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const handleCreateFromTriage = async () => {
    if (!isDoctor) return;
    if (!selectedPatientId) { setError('Selecciona un paciente para crear la historia'); return; }
    if (!result) return;
    setCreating(true);
    setError(null);
    setCreateMsg('');
    const res: any = await createMedicalRecord({
      patientId: selectedPatientId,
      chiefComplaint: symptoms.slice(0, 500),
      diagnosis: `${result.recommendedSpecialty} - ${result.reasoning}`,
      historyOfPresentIllness: `Triaje IA: ${result.reasoning} (Urgencia: ${result.urgency}) | Síntomas: ${symptoms}`,
      treatmentPlan: `Evaluación por ${result.recommendedSpecialty}. ${result.urgency === 'Alta' ? 'Derivar a guardia/urgencias.' : result.urgency === 'Media' ? 'Control en 48-72hs.' : 'Control ambulatorio.'}`,
    });
    if (res.error) setError(res.error);
    else {
      setCreateMsg('Historia clínica creada con apoyo de IA. Ve a Historia Clínica para completarla y generar protocolo IA.');
      setTimeout(()=> navigate('/medical-records'), 1200);
    }
    setCreating(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center space-x-3 mb-6">
          <Stethoscope className="w-8 h-8 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-800">
            {isDoctor ? 'Triaje Inteligente - Asistencia para Historia Clínica' : 'Triaje Inteligente con IA'}
          </h2>
        </div>

        <p className="text-gray-600 mb-6">
          {isDoctor
            ? 'Describe los síntomas del paciente. La IA te ayudará a crear la historia clínica con diagnóstico sugerido y protocolo.'
            : 'Describe tus síntomas y nuestra IA te recomendará la especialidad médica más adecuada y te ayudará a reservar tu cita.'}
        </p>

        {isDoctor && (
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded">
            <label className="text-sm font-medium text-indigo-800">Paciente para la historia (requerido para crear)</label>
            <select value={selectedPatientId} onChange={e=>setSelectedPatientId(e.target.value)} className="w-full mt-1 border p-2 rounded bg-white">
              <option value="">-- Selecciona paciente --</option>
              {patients.map((p:any)=><option key={p.id} value={p.id}>{p.firstName} {p.lastName} - {p.email}</option>)}
            </select>
            <p className="text-xs text-indigo-600 mt-1">El triaje creará una historia clínica borrador para este paciente.</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe tus síntomas
            </label>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Ej: Tengo dolor de cabeza intenso, náuseas y sensibilidad a la luz..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={5}
              disabled={loading}
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !symptoms.trim()}
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Analizando...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>{isDoctor ? 'Analizar y preparar historia' : 'Analizar Síntomas'}</span>
              </>
            )}
          </button>
          {createMsg && <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">{createMsg}</div>}
        </div>

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-8 space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start space-x-3 mb-4">
                <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    Resultado del Análisis
                  </h3>
                  <p className="text-gray-600">{result.reasoning}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Especialidad Recomendada</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {result.recommendedSpecialty}
                  </p>
                </div>

                <div className={`rounded-lg p-4 border ${getUrgencyColor(result.urgency)}`}>
                  <p className="text-sm mb-1">Nivel de Urgencia</p>
                  <p className="text-lg font-semibold">{result.urgency}</p>
                </div>
              </div>

              <div className="mt-6 bg-white rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-gray-600 mb-2">Próximos Pasos</p>
                {isDoctor ? (
                  <div className="space-y-3">
                    <p className="text-gray-700">Usa este triaje para crear la historia clínica del paciente seleccionado.</p>
                    <button onClick={handleCreateFromTriage} disabled={creating || !selectedPatientId} className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300">
                      {creating ? <Loader className="w-4 h-4 animate-spin"/> : <FileText className="w-4 h-4"/>}
                      {creating ? 'Creando...' : 'Crear Historia Clínica con este triaje'}
                    </button>
                    {!selectedPatientId && <p className="text-xs text-amber-600">Selecciona un paciente arriba.</p>}
                    <Link to="/medical-records" className="block text-center text-sm text-indigo-600 hover:underline">Ir a Historia Clínica → generar protocolo IA</Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-gray-700">
                      Te recomendamos <strong>{result.recommendedSpecialty}</strong> con urgencia <strong>{result.urgency}</strong>.
                    </p>
                    <Link to="/booking" className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700">
                      <CalendarCheck className="w-5 h-5"/> Reservar Turno con {result.recommendedSpecialty}
                    </Link>
                    <Link to="/medical-records" className="block text-center text-sm text-blue-600 hover:underline">Ver tu Historia Clínica</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Aviso:</strong> Este triaje es solo una recomendación. En caso de emergencia,
            dirígete inmediatamente al centro de salud más cercano o llama al número de
            emergencias de tu país.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TriageChat;
