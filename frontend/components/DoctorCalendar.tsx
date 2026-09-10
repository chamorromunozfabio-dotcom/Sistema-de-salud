import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { doctorService } from '../services/doctorService';
import { appointmentService } from '../services/appointmentService';
import { Calendar, Clock, User, Phone, Mail, ChevronLeft, ChevronRight, Stethoscope, AlertCircle } from 'lucide-react';

export default function DoctorCalendar() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [slots, setSlots] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [myDoctorId, setMyDoctorId] = useState<string | null>(null);

  const isDoctor = user?.role === 'DOCTOR';
  const isAdmin = user?.role === 'ADMIN';

  // Cargar doctores y resolver mi doctorId si soy DOCTOR
  useEffect(() => {
    const init = async () => {
      try {
        const all = await doctorService.getAll();
        setDoctors(all);
        if (isDoctor && user) {
          // Buscar doctor cuyo userId coincida o email coincida
          const mine = all.find((d: any) => d.userId === user.id || d.email === user.email);
          if (mine) {
            setMyDoctorId(mine.id);
            setSelectedDoctorId(mine.id);
          } else {
            // fallback: buscar via users/me doctorProfile
            // si no se encuentra, dejar que admin seleccione
            setError('No se encontró tu perfil de doctor vinculado. Pide al admin que vincule tu usuario.');
          }
        } else if (isAdmin && all.length > 0) {
          setSelectedDoctorId(all[0].id);
        }
      } catch (e: any) {
        setError(e.message || 'Error cargando doctores');
      }
    };
    init();
  }, [user]);

  const loadData = async () => {
    if (!selectedDoctorId) return;
    setLoading(true);
    setError('');
    try {
      const dateStr = selectedDate;
      const s = await doctorService.getAvailableSlots(selectedDoctorId, dateStr);
      setSlots(s);
      const allApts = await appointmentService.getAll();
      // Filtrar por doctor y por fecha seleccionada
      const start = new Date(selectedDate); start.setHours(0,0,0,0);
      const end = new Date(selectedDate); end.setHours(23,59,59,999);
      const filtered = allApts.filter((a: any) => a.doctorId === selectedDoctorId && new Date(a.date) >= start && new Date(a.date) <= end);
      setAppointments(filtered);
    } catch (e: any) {
      setError(e.message || 'Error cargando calendario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedDoctorId, selectedDate]);

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d: Date) => d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth()+1,0).getDate();
  const firstDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(),1).getDay();
  const isSelected = (day: number) => selectedDate.getDate()===day && selectedDate.getMonth()===currentMonth.getMonth() && selectedDate.getFullYear()===currentMonth.getFullYear();
  const isToday = (day: number) => new Date().getDate()===day && new Date().getMonth()===currentMonth.getMonth() && new Date().getFullYear()===currentMonth.getFullYear();

  const selectedDoctor = doctors.find(d=>d.id===selectedDoctorId);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Stethoscope className="w-6 h-6 text-blue-600"/> Calendario del Doctor</h1>
        <p className="text-sm text-gray-600">{isDoctor ? 'Ves tus citas y horarios libres' : isAdmin ? 'Administra calendario de cualquier doctor' : 'Solo doctor y admin'}</p>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}

      {isAdmin && (
        <div className="bg-white p-4 rounded border">
          <label className="text-sm font-medium">Selecciona doctor</label>
          <select value={selectedDoctorId} onChange={e=>setSelectedDoctorId(e.target.value)} className="w-full mt-1 border p-2 rounded bg-white">
            {doctors.map((d:any)=> <option key={d.id} value={d.id}>{d.name} - {d.specialty?.name} - {d.hospital}</option>)}
          </select>
        </div>
      )}

      {selectedDoctor && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm">
          <strong>{selectedDoctor.name}</strong> · {selectedDoctor.specialty?.name} · {selectedDoctor.hospital} · {selectedDoctor.email}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mini calendario */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">{currentMonth.toLocaleDateString('es-AR', {month:'long', year:'numeric'})}</h3>
            <div className="flex gap-1">
              <button onClick={()=>setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1))} className="p-2 hover:bg-gray-100 rounded"><ChevronLeft className="w-4 h-4"/></button>
              <button onClick={()=>setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1))} className="p-2 hover:bg-gray-100 rounded"><ChevronRight className="w-4 h-4"/></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2 text-xs text-gray-500 text-center">{['D','L','M','M','J','V','S'].map(d=> <div key={d} className="py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({length: firstDay(currentMonth)}).map((_,i)=> <div key={'e'+i} />)}
            {Array.from({length: daysInMonth(currentMonth)}).map((_,idx)=>{
              const day = idx+1;
              return (
                <button key={day} onClick={()=>setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))} className={`aspect-square rounded flex items-center justify-center text-sm ${isSelected(day) ? 'bg-blue-600 text-white' : isToday(day) ? 'bg-blue-100 text-blue-800 font-bold' : 'hover:bg-gray-100'}`}>{day}</button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-4">Selecciona un día para ver turnos</p>
        </div>

        {/* Detalle del día */}
        <div className="lg:col-span-2 bg-white rounded-xl border p-6">
          <h3 className="font-semibold mb-1"> {formatDate(selectedDate)} </h3>
          <p className="text-sm text-gray-500 mb-4">{appointments.length} citas agendadas · {slots.length} horarios libres</p>

          {loading ? <div className="text-center py-8">Cargando...</div> : (
            <div className="space-y-6">
              {/* Horarios libres */}
              <div>
                <h4 className="font-medium flex items-center gap-2"><Clock className="w-4 h-4 text-green-600"/> Horarios libres</h4>
                {slots.length===0 ? (
                  <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 flex gap-2"><AlertCircle className="w-4 h-4"/> No hay horarios libres para este día. El admin puede generar en Admin → Doctores → Generar slots.</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                    {slots.map((s:any)=> <div key={s.id} className="p-2 border rounded text-center bg-green-50 text-green-700 text-sm">{formatTime(s.startTime)} - {formatTime(s.endTime)}</div>)}
                  </div>
                )}
              </div>

              {/* Citas agendadas */}
              <div>
                <h4 className="font-medium flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-600"/> Citas agendadas</h4>
                {appointments.length===0 ? (
                  <div className="mt-2 p-8 text-center text-gray-500 border rounded">Sin citas para este día</div>
                ) : (
                  <div className="space-y-3 mt-2 max-h-[400px] overflow-y-auto">
                    {appointments.sort((a,b)=> new Date(a.date).getTime()-new Date(b.date).getTime()).map((a:any)=> (
                      <div key={a.id} className="border rounded p-3 flex justify-between">
                        <div>
                          <div className="font-semibold">{formatTime(a.date)} · <span className={`text-xs px-2 py-0.5 rounded ${a.status==='CONFIRMED'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>{a.status}</span></div>
                          <div className="text-sm text-gray-700 flex items-center gap-1 mt-1"><User className="w-3 h-3"/> {a.patientName} {a.patientPhone && `· ${a.patientPhone}`}</div>
                          {a.patientEmail && <div className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3"/> {a.patientEmail}</div>}
                          {a.notes && <div className="text-xs text-gray-600 mt-1">Notas: {a.notes}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
