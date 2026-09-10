import { tokenService } from './tokenService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const token = tokenService.getToken();
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(`${API_URL}${endpoint}`, {
      credentials: 'include', // enviar cookies httpOnly (refreshToken)
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...options?.headers,
      },
    });

    // Auto refresh si 401 y no es endpoint de auth
    if (response.status === 401 && !endpoint.includes('/auth/')) {
      const refreshed = await tokenService.tryRefresh();
      if (refreshed) {
        const retry = await fetch(`${API_URL}${endpoint}`, {
          credentials: 'include',
          ...options,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${refreshed}`,
            ...options?.headers,
          },
        });
        if (!retry.ok) {
          const error = await retry.json().catch(() => ({ message: 'Error desconocido' }));
          return { error: error.message || `Error ${retry.status}` };
        }
        const data = await retry.json();
        return { data };
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
      return { error: error.message || `Error ${response.status}` };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('API Error:', error);
    return { error: error instanceof Error ? error.message : 'Error de conexión' };
  }
}

// Specialties
export async function getAllSpecialties() {
  return fetchAPI('/specialties', { method: 'GET' });
}

export async function getSpecialtyById(id: string) {
  return fetchAPI(`/specialties/${id}`, { method: 'GET' });
}

// Doctors
export async function getAllDoctors(specialtyId?: string) {
  const query = specialtyId ? `?specialtyId=${specialtyId}` : '';
  return fetchAPI(`/doctors${query}`, { method: 'GET' });
}

export async function getDoctorById(id: string) {
  return fetchAPI(`/doctors/${id}`, { method: 'GET' });
}

// Appointments
export async function getAllAppointments(status?: string) {
  const query = status ? `?status=${status}` : '';
  return fetchAPI(`/appointments${query}`, { method: 'GET' });
}

export async function getAppointmentStats() {
  return fetchAPI('/appointments/stats', { method: 'GET' });
}

export async function createAppointment(data: {
  doctorId: string;
  patientName: string;
  patientEmail?: string;
  patientPhone: string;
  date: string;
  notes?: string;
}) {
  return fetchAPI('/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function cancelAppointment(id: string) {
  return fetchAPI(`/appointments/${id}`, { method: 'DELETE' });
}

// Users - CRUD pacientes, doctores (solo admin crea doctor)
export async function getAllUsers(role?: string, search?: string) {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (search) params.set('search', search);
  const q = params.toString() ? `?${params.toString()}` : '';
  return fetchAPI(`/users${q}`, { method: 'GET' });
}
export async function getPatients(search?: string) {
  return getAllUsers('PATIENT', search);
}
export async function getDoctorsUsers(search?: string) {
  return fetchAPI(`/users/doctors${search ? `?search=${encodeURIComponent(search)}` : ''}`, { method: 'GET' });
}
export async function createDoctorUser(data: any) {
  return fetchAPI('/users/doctors', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateUser(id: string, data: any) {
  return fetchAPI(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteUser(id: string) {
  return fetchAPI(`/users/${id}`, { method: 'DELETE' });
}
export async function toggleUserActive(id: string) {
  return fetchAPI(`/users/${id}/toggle-active`, { method: 'POST' });
}

// Medical Records - historia clínica
export async function getMyMedicalRecords() {
  return fetchAPI('/medical-records/my-records', { method: 'GET' });
}
export async function getAllMedicalRecords(filters?: { patientId?: string; doctorId?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.patientId) params.set('patientId', filters.patientId);
  if (filters?.doctorId) params.set('doctorId', filters.doctorId);
  if (filters?.status) params.set('status', filters.status);
  const q = params.toString() ? `?${params.toString()}` : '';
  return fetchAPI(`/medical-records${q}`, { method: 'GET' });
}
export async function getMedicalRecordById(id: string) {
  return fetchAPI(`/medical-records/${id}`, { method: 'GET' });
}
export async function createMedicalRecord(data: any) {
  return fetchAPI('/medical-records', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateMedicalRecord(id: string, data: any) {
  return fetchAPI(`/medical-records/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteMedicalRecord(id: string) {
  return fetchAPI(`/medical-records/${id}`, { method: 'DELETE' });
}
export async function signMedicalRecord(id: string) {
  return fetchAPI(`/medical-records/${id}/sign`, { method: 'POST' });
}
export async function generateAiProtocol(id: string, clinicalContext: string, type: string = 'todo') {
  return fetchAPI(`/medical-records/${id}/generate-ai`, {
    method: 'POST',
    body: JSON.stringify({ clinicalContext, type }),
  });
}

// Audit logs
export async function getAuditLogs(params?: { action?: string; take?: number }) {
  const q = params ? `?${new URLSearchParams(params as any).toString()}` : '';
  return fetchAPI(`/audit/logs${q}`, { method: 'GET' });
}
