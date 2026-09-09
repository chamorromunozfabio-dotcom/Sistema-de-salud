import { GoogleGenAI, Type } from "@google/genai";
import { Specialty, TriageResult } from '../types';
import { tokenService } from './tokenService';
import { sanitizeString } from '../utils/sanitize';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Safe initialization of the client inside functions to avoid initialization errors if key is missing during load
const getAiClient = () => {
  if (!apiKey) {
    // No bloqueante: se intentará backend primero
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// Intenta backend /triage/analyze antes de usar cliente directo (cumple spec: IA en backend con Bull no requerido para triaje)
// Token en memoria (no localStorage) por requisito "sin storage ni cookies"
const tryBackendTriage = async (symptoms: string): Promise<TriageResult | null> => {
  try {
    const token = tokenService.getToken();
    const cleanSymptoms = sanitizeString(symptoms);
    const res = await fetch(`${API_URL}/triage/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ symptoms: cleanSymptoms }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // mapear respuesta backend a TriageResult frontend
    if (data?.recommendedSpecialty) return data as TriageResult;
    return null;
  } catch {
    return null;
  }
};

export const analyzeSymptoms = async (symptoms: string): Promise<TriageResult> => {
  // 1) Intentar backend (si está disponible no requiere VITE_GEMINI_API_KEY)
  const backendResult = await tryBackendTriage(symptoms);
  if (backendResult) return backendResult;

  const ai = getAiClient();
  if (!ai) {
    // Fallback demo si no hay backend ni API key
    return {
      recommendedSpecialty: Specialty.GENERAL,
      urgency: 'Baja',
      reasoning: 'Modo de demostración: API Key no configurada y backend no disponible. Se recomienda médico general.'
    };
  }

  try {
    const model = 'gemini-2.5-flash';
    const prompt = `Analiza los siguientes síntomas de un paciente y recomienda la especialidad médica más adecuada del sistema de salud público argentino/chileno.
    Síntomas: "${symptoms}"
    
    Las especialidades disponibles son: ${Object.values(Specialty).join(', ')}.
    
    Responde en formato JSON.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedSpecialty: {
              type: Type.STRING,
              enum: Object.values(Specialty),
              description: "La especialidad médica recomendada."
            },
            urgency: {
              type: Type.STRING,
              enum: ['Baja', 'Media', 'Alta'],
              description: "Nivel de urgencia estimado."
            },
            reasoning: {
              type: Type.STRING,
              description: "Breve explicación de por qué se eligió esa especialidad (máximo 20 palabras)."
            }
          },
          required: ['recommendedSpecialty', 'urgency', 'reasoning']
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini");
    }

    const parsed = JSON.parse(resultText) as TriageResult;
    return parsed;

  } catch (error) {
    console.error("Error analyzing symptoms:", error);
    return {
      recommendedSpecialty: Specialty.GENERAL,
      urgency: 'Media',
      reasoning: 'Hubo un error analizando los síntomas. Por favor consulte con un médico general.'
    };
  }
};