import { supabase } from '../lib/supabase';

export type MotivoBaja = 
  | 'cambio_domicilio' | 'vacaciones' | 'lesion' | 'cuestiones_laborales'
  | 'disgusto_personal' | 'disgusto_instalaciones' | 'asistencia_intermitente'
  | 'problemas_financieros' | 'otros';

export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjetas' | 'QR' | 'debito_automatico';

export const periodoService = {
  getPeriodoActivo: async (personaId: string) => {
    const { data, error } = await supabase
      .from('periodos_alumno')
      .select('*')
      .eq('persona_id', personaId)
      .is('fecha_fin', null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  getUltimoPeriodo: async (personaId: string) => {
    const { data, error } = await supabase
      .from('periodos_alumno')
      .select('*')
      .eq('persona_id', personaId)
      .order('fecha_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  registrarBaja: async (periodoId: string, motivo: MotivoBaja, observaciones?: string) => {
    const { data, error } = await supabase
      .from('periodos_alumno')
      .update({ motivo_baja: motivo, observaciones })
      .eq('id', periodoId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  // 👇 NUEVA FUNCIÓN: Registra el cobro completo
  registrarCobro: async (params: {
    personaId: string;
    planId: string;
    monto: number;
    metodoPago: MetodoPago;
    fechaInicio: string;
    fechaFin: string;
  }) => {
    const { personaId, planId, monto, metodoPago, fechaInicio, fechaFin } = params;

    // 1. Verificar si ya tiene un período activo para reutilizarlo, o crear uno nuevo
    let periodoActivo = await periodoService.getPeriodoActivo(personaId);
    let periodoAlumnoId = periodoActivo?.id;

    if (!periodoAlumnoId) {
      const { data: nuevoPeriodo, error: errorPeriodo } = await supabase
        .from('periodos_alumno')
        .insert({ persona_id: personaId, fecha_inicio: fechaInicio })
        .select('id')
        .single();
      
      if (errorPeriodo) throw new Error('Error al crear período: ' + errorPeriodo.message);
      periodoAlumnoId = nuevoPeriodo.id;
    }

    // 2. Crear la cobertura del plan
    const { error: errorCobertura } = await supabase
      .from('periodos_cobertura')
      .insert({
        periodo_alumno_id: periodoAlumnoId,
        plan_id: planId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      });
    
    if (errorCobertura) throw new Error('Error al crear cobertura: ' + errorCobertura.message);

    // 3. Registrar el pago
    const { error: errorPago } = await supabase
      .from('pagos')
      .insert({
        periodo_alumno_id: periodoAlumnoId,
        fecha_pago: new Date().toISOString().split('T')[0], // Fecha de hoy
        monto: monto,
        metodo_pago: metodoPago,
        descripcion: `Pago de plan - ${fechaInicio} a ${fechaFin}`,
      });

    if (errorPago) throw new Error('Error al registrar pago: ' + errorPago.message);

    return true;
  },
};