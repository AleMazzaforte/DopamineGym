import { supabase } from '../lib/supabase';

export type MotivoBaja = 
  | 'cambio_domicilio' | 'vacaciones' | 'lesion' | 'cuestiones_laborales'
  | 'disgusto_personal' | 'disgusto_instalaciones' | 'asistencia_intermitente'
  | 'problemas_financieros' | 'otros';

export type MetodoCobro = 'efectivo' | 'transferencia' | 'tarjetas' | 'QR' | 'debito_automatico';

export type PeriodoAlumno = {
  id: string;
  persona_id: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  motivo_baja: MotivoBaja | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
};

// 👇 Helper para evitar el error de tipos "never" de Supabase
const periodosTable = () => (supabase as any).from('periodos_alumno');
const coberturasTable = () => (supabase as any).from('periodos_cobertura');
const cobrosTable = () => (supabase as any).from('cobros');

export const periodoService = {
  getPeriodoActivo: async (personaId: string) => {
    const { data, error } = await periodosTable()
      .select('*')
      .eq('persona_id', personaId)
      .is('fecha_fin', null)
      .maybeSingle();
    
    if (error) throw new Error(error.message);
    return data as PeriodoAlumno | null;
  },

  getUltimoPeriodo: async (personaId: string) => {
    const { data, error } = await periodosTable()
      .select('*')
      .eq('persona_id', personaId)
      .order('fecha_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) throw new Error(error.message);
    return data as PeriodoAlumno | null;
  },

  registrarBaja: async (periodoId: string, motivo: MotivoBaja, observaciones?: string) => {
    const { data, error } = await periodosTable()
      .update({ motivo_baja: motivo, observaciones })
      .eq('id', periodoId)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data as PeriodoAlumno;
  },

  // Crear un período "de baja" para alumnos que nunca tuvieron período
crearPeriodoBaja: async (personaId: string, fecha: string) => {
  const { data, error } = await periodosTable()
    .insert({ 
      persona_id: personaId, 
      fecha_inicio: fecha,
      fecha_fin: fecha, // Mismo día: período de un solo día
    })
    .select('id')
    .single();

  if (error) throw new Error('Error al crear período de baja: ' + error.message);
  return data as PeriodoAlumno;
},

  registrarCobro: async (params: {
    personaId: string;
    planId: string;
    monto: number;
    metodoCobro: MetodoCobro;
    fechaInicio: string;
    fechaFin: string;
  }) => {
    const { personaId, planId, monto, metodoCobro, fechaInicio, fechaFin } = params;

    // 1. Verificar o crear período
    let periodoActivo = await periodoService.getPeriodoActivo(personaId);
    let periodoAlumnoId = periodoActivo?.id;

    if (!periodoAlumnoId) {
      const { data: nuevoPeriodo, error: errorPeriodo } = await periodosTable()
        .insert({ persona_id: personaId, fecha_inicio: fechaInicio })
        .select('id')
        .single();
      
      if (errorPeriodo) throw new Error('Error al crear período: ' + errorPeriodo.message);
      periodoAlumnoId = nuevoPeriodo.id;
    }

    // 2. Crear cobertura
    const { error: errorCobertura } = await coberturasTable()
      .insert({
        periodo_alumno_id: periodoAlumnoId,
        plan_id: planId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      });
    
    if (errorCobertura) throw new Error('Error al crear cobertura: ' + errorCobertura.message);

    // 3. Registrar pago
    const { error: errorPago } = await cobrosTable()
      .insert({
        periodo_alumno_id: periodoAlumnoId,
        fecha_pago: new Date().toISOString().split('T')[0],
        monto: monto,
        metodo_pago: metodoCobro,
        descripcion: `Pago de plan - ${fechaInicio} a ${fechaFin}`,
      });

    if (errorPago) throw new Error('Error al registrar pago: ' + errorPago.message);

    return true;
  },
};