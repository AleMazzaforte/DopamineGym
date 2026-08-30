import { supabase } from '../lib/supabase';
import { type MetodoCobro } from './periodoService';

export type Cobro = {
  id: string;
  periodo_alumno_id: string;
  fecha_cobro: string;
  monto: number;
  metodo_cobro: MetodoCobro;
  descripcion: string | null;
  created_at: string;
};

export type CobroInsert = Omit<Cobro, 'id' | 'created_at'>;

export type CobroConAlumno = Cobro & {
  periodo_alumno?: {
    persona?: {
      nombre: string;
      apellido: string;
      dni: string;
    };
  };
};

const cobrosTable = () => (supabase as any).from('cobros');
const periodosTable = () => (supabase as any).from('periodos_alumno');
const coberturasTable = () => (supabase as any).from('periodos_cobertura');

export const cobroService = {
  getAll: async () => {
    const { data, error } = await cobrosTable()
      .select(`
        *,
        periodo_alumno!inner(
          id,
          persona:personas!inner(
            id,
            nombre,
            apellido,
            dni
          )
        )
      `)
      .order('fecha_cobro', { ascending: false });

    if (error) throw new Error(error.message);
    return data as CobroConAlumno[];
  },

  getByRangoFechas: async (fechaDesde: string, fechaHasta: string) => {
    const { data, error } = await cobrosTable()
      .select(`
        *,
        periodo_alumno!inner(
          id,
          persona:personas!inner(
            id,
            nombre,
            apellido,
            dni
          )
        )
      `)
      .gte('fecha_cobro', fechaDesde)
      .lte('fecha_cobro', fechaHasta)
      .order('fecha_cobro', { ascending: false });

    if (error) throw new Error(error.message);
    return data as CobroConAlumno[];
  },

  getByMetodoPago: async (metodo: MetodoCobro) => {
    const { data, error } = await cobrosTable()
      .select(`
        *,
        periodo_alumno!inner(
          id,
          persona:personas!inner(
            id,
            nombre,
            apellido,
            dni
          )
        )
      `)
      .eq('metodo_cobro', metodo)
      .order('fecha_cobro', { ascending: false });

    if (error) throw new Error(error.message);
    return data as CobroConAlumno[];
  },

  create: async (params: {
    personaId: string;
    planId: string;
    monto: number;
    MetodoCobro: MetodoCobro;
    fechaCobro: string;
    fechaInicio: string;
    fechaFin: string;
    descripcion?: string;
  }) => {
    const { personaId, planId, monto, MetodoCobro, fechaCobro, fechaInicio, fechaFin, descripcion } = params;

    // 1. Verificar si ya tiene período activo
    const { data: periodoActivo } = await periodosTable()
      .select('id')
      .eq('persona_id', personaId)
      .is('fecha_fin', null)
      .maybeSingle();

    let periodoAlumnoId = periodoActivo?.id;

    // 2. Si NO tiene período activo, crear uno nuevo CON LAS FECHAS CORRECTAS
    if (!periodoAlumnoId) {
      const { data: nuevoPeriodo, error: errorPeriodo } = await periodosTable()
        .insert({ 
          persona_id: personaId, 
          fecha_inicio: fechaInicio,  // 👈 FECHA DE INICIO
          fecha_fin: fechaFin         // 👈 FECHA DE FIN
        })
        .select('id')
        .single();
      
      if (errorPeriodo) {
        console.error('Error al crear período:', errorPeriodo);
        throw new Error('Error al crear período: ' + errorPeriodo.message);
      }
      periodoAlumnoId = nuevoPeriodo.id;
    } else {
      // 3. Si YA tiene período activo, EXTENDERLO con la nueva fecha de fin
      const { error: errorUpdate } = await periodosTable()
        .update({ fecha_fin: fechaFin })  // 👈 ACTUALIZAR FECHA DE FIN
        .eq('id', periodoAlumnoId);
      
      if (errorUpdate) {
        console.error('Error al extender período:', errorUpdate);
        throw new Error('Error al extender período: ' + errorUpdate.message);
      }
    }

    // 4. Crear la cobertura del plan CON LAS FECHAS CORRECTAS
    const { error: errorCobertura } = await coberturasTable()
      .insert({
        periodo_alumno_id: periodoAlumnoId,
        plan_id: planId,
        fecha_inicio: fechaInicio,  // 👈 FECHA DE INICIO
        fecha_fin: fechaFin         // 👈 FECHA DE FIN
      });
    
    if (errorCobertura) {
      console.error('Error al crear cobertura:', errorCobertura);
      throw new Error('Error al crear cobertura: ' + errorCobertura.message);
    }

    // 5. Registrar el cobro
    const { data: cobro, error: errorCobro } = await cobrosTable()
      .insert({
        periodo_alumno_id: periodoAlumnoId,
        fecha_cobro: fechaCobro,
        monto: monto,
        metodo_cobro: MetodoCobro,
        descripcion: descripcion || null,
      })
      .select()
      .single();

    if (errorCobro) {
      console.error('Error al registrar cobro:', errorCobro);
      throw new Error('Error al registrar cobro: ' + errorCobro.message);
    }

    return cobro as Cobro;
  },

  update: async (id: string, updates: Partial<CobroInsert>) => {
    const { data, error } = await cobrosTable()
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Cobro;
  },

  delete: async (id: string) => {
    const { error } = await cobrosTable()
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  },

  getPeriodoActivoWithPlan: async (personaId: string) => {
    const { data, error } = await periodosTable()
      .select(`
        id,
        fecha_inicio,
        fecha_fin,
        periodos_cobertura!inner(
          id,
          plan:planes(
            id,
            nombre,
            precio
          )
        )
      `)
      .eq('persona_id', personaId)
      .is('fecha_fin', null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  },
};