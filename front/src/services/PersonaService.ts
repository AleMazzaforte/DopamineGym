import { supabase } from '../lib/supabase';

export type Persona = {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  telefono: string;
  email: string;
  rol_actual: 'ALUMNO' | 'PROFESOR' | 'ADMIN';
  contacto_emergencia?: string;
  telefono_familiar?: string;
  antecedentes_entrenamiento?: string;
  restricciones?: string;
  certificado_medico?: string;
  fecha_vencimiento_certificado?: string;
  created_at: string;
  updated_at: string;
};

export type PersonaInsert = Omit<Persona, 'id' | 'created_at' | 'updated_at'>;

const personaService = {
  getAll: async (rol?: 'ALUMNO' | 'PROFESOR' | 'ADMIN') => {
    let query = supabase.from('personas').select('*').order('apellido', { ascending: true });
    if (rol) query = query.eq('rol_actual', rol);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as Persona[];
  },

  search: async (term: string, rol?: 'ALUMNO' | 'PROFESOR' | 'ADMIN') => {
    const cleanTerm = `%${term.toLowerCase()}%`;
    let query = supabase
      .from('personas')
      .select('*')
      .or(`dni.ilike.${cleanTerm},nombre.ilike.${cleanTerm},apellido.ilike.${cleanTerm}`)
      .order('apellido', { ascending: true });
    if (rol) query = query.eq('rol_actual', rol);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as Persona[];
  },

  create: async (persona: PersonaInsert) => {
    const { data, error } = await supabase.from('personas').insert(persona).select().single();
    if (error) throw new Error(error.message);
    return data as Persona;
  },

  update: async (id: string, updates: Partial<PersonaInsert>) => {
    const { data, error } = await supabase.from('personas').update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as Persona;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase.from('personas').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data as Persona;
  },
};

export default personaService; // 👈 EXPORT DEFAULT (sin nombre)