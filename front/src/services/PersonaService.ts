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


export type PersonaConEstado = Persona & {
  estado: 'ACTIVO' | 'INACTIVO' | 'BAJA';
};

export type PersonaInsert = Omit<Persona, 'id' | 'created_at' | 'updated_at'>;

const personasTable = () => (supabase as any).from('personas');

export const personaService = {
getAll: async (rol?: 'ALUMNO' | 'PROFESOR' | 'ADMIN') => {
  let query = personasTable()
    .select(`
      *,
      periodos_alumno!left(
        fecha_fin,
        motivo_baja
      )
    `)
    .order('apellido', { ascending: true });

  if (rol) {
    query = query.eq('rol_actual', rol);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const hoy = new Date().toISOString().split('T')[0];

  const processedData = data.map((p: any) => {
    // 1. ¿Tiene al menos un período sin fecha de fin O con fecha_fin >= hoy?
    const tieneActivo = p.periodos_alumno?.some((per: any) => 
      per.fecha_fin === null || per.fecha_fin >= hoy
    );
    
    if (tieneActivo) {
      return { ...p, estado: 'ACTIVO' };
    }

    // 2. Si no está activo, ¿tiene algún período con motivo de baja registrado?
    const tieneBaja = p.periodos_alumno?.some((per: any) => 
      per.motivo_baja !== null && per.motivo_baja !== undefined
    );

    return {
      ...p,
      estado: tieneBaja ? 'BAJA' : 'INACTIVO'
    };
  });

  // Si es rol ALUMNO, por defecto mostramos SOLO los activos
  if (rol === 'ALUMNO') {
    return processedData.filter((p: any) => p.estado !== 'BAJA') as PersonaConEstado[];
  }

  return processedData as PersonaConEstado[];
},

search: async (term: string, rol?: 'ALUMNO' | 'PROFESOR' | 'ADMIN') => {
  const cleanTerm = `%${term.toLowerCase()}%`;
  let query = personasTable()
    .select(`
      *,
      periodos_alumno!left(
        fecha_fin,
        motivo_baja
      )
    `)
    .or(`dni.ilike.${cleanTerm},nombre.ilike.${cleanTerm},apellido.ilike.${cleanTerm}`)
    .order('apellido', { ascending: true });

  if (rol) {
    query = query.eq('rol_actual', rol);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const hoy = new Date().toISOString().split('T')[0];

  const processedData = data.map((p: any) => {
    // 1. ¿Tiene al menos un período sin fecha de fin O con fecha_fin >= hoy?
    const tieneActivo = p.periodos_alumno?.some((per: any) => 
      per.fecha_fin === null || per.fecha_fin >= hoy
    );
    
    if (tieneActivo) {
      return { ...p, estado: 'ACTIVO' };
    }

    // 2. Si no está activo, ¿tiene algún período con motivo de baja registrado?
    const tieneBaja = p.periodos_alumno?.some((per: any) => 
      per.motivo_baja !== null && per.motivo_baja !== undefined
    );

    return {
      ...p,
      estado: tieneBaja ? 'BAJA' : 'INACTIVO'
    };
  });

  // En la búsqueda, devolvemos TODOS (activos, inactivos y baja)
  return processedData as PersonaConEstado[];
},


  create: async (persona: PersonaInsert) => {
    const { data, error } = await personasTable().insert(persona).select().single();
    if (error) throw new Error(error.message);
    return data as Persona;
  },

  update: async (id: string, updates: Partial<PersonaInsert>) => {
    const { data, error } = await personasTable().update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data as Persona;
  },

  getById: async (id: string) => {
    const { data, error } = await personasTable().select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data as Persona;
  },
};

export default personaService;