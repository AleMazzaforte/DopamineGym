// ============================================
// ENTIDADES BASE
// ============================================

interface Persona {
  id: string; // UUID
  dni: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: Date;
  telefono: string;
  email: string;
  rolActual: 'ALUMNO' | 'PROFESOR' | 'ADMIN';
  contactoEmergencia?: string;
  telefonoFamiliar?: string;
  antecedentesEntrenamiento?: string;
  restricciones?: string;
  certificadoMedico?: string; // URL o path del archivo
  fechaVencimientoCertificado?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface HistorialRol {
  id: string;
  personaId: string;
  rol: 'ALUMNO' | 'PROFESOR' | 'ADMIN';
  fechaInicio: Date;
  fechaFin?: Date; // undefined = rol actual
  createdAt: Date;
}

// ============================================
// ALUMNOS / PERÍODOS
// ============================================

interface PeriodoAlumno {
  id: string;
  personaId: string;
  fechaInicio: Date;
  fechaFin?: Date; // undefined = período actual
  motivoBaja?: MotivoBaja;
  observaciones?: string;
  createdAt: Date;
  updatedAt: Date;
}

type MotivoBaja = 
  | 'cambio_domicilio'
  | 'vacaciones'
  | 'lesion'
  | 'cuestiones_laborales'
  | 'disgusto_personal'
  | 'disgusto_instalaciones'
  | 'asistencia_intermitente'
  | 'problemas_financieros'
  | 'otros';

// ============================================
// PLANES
// ============================================

interface Plan {
  id: string;
  nombre: string; // "Pase libre", "3 veces por semana", "2 veces por semana"
  descripcion?: string;
  vecesPorSemana: number | null; // null = pase libre (todos los días)
  precio: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// PERÍODOS DE COBERTURA (vinculados a pago y plan)
// ============================================

interface PeriodoCobertura {
  id: string;
  periodoAlumnoId: string;
  planId: string;
  fechaInicio: Date;
  fechaFin: Date; // fecha de vencimiento
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// DÍAS HABILITADOS (para alumnos)
// ============================================

interface DiaHabilitado {
  id: string;
  periodoAlumnoId: string;
  diaSemana: 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1=Lunes ... 7=Domingo
  fechaInicio: Date;
  fechaFin?: Date; // undefined = actualmente habilitado
  createdAt: Date;
}

// ============================================
// ASISTENCIAS
// ============================================

interface Asistencia {
  id: string;
  periodoAlumnoId: string;
  fecha: Date;
  horaEntrada: string; // "HH:MM:SS" o timestamp completo
  createdAt: Date;
}

// ============================================
// PAGOS Y SALDO
// ============================================

interface Pago {
  id: string;
  periodoAlumnoId: string;
  fechaPago: Date;
  monto: number;
  metodoPago: 'efectivo' | 'transferencia' | 'tarjetas' | 'QR' | 'debito_automatico';
  descripcion?: string;
  createdAt: Date;
}

// El saldo se calcula por períodoAlumno, no es una entidad persistente separada
// Se calcula: suma(pagos) - (cantidad_periodos_cobertura * precio_plan)
// Puede ser positivo (saldo a favor) o negativo (deuda)

// ============================================
// PROFESORES
// ============================================

interface HorarioLaboralProfesor {
  id: string;
  profesorId: string; // personaId con rol PROFESOR
  diaSemana: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  horaEntrada: string; // "HH:MM"
  horaSalida: string; // "HH:MM"
  fechaInicio: Date;
  fechaFin?: Date; // undefined = horario actual
  createdAt: Date;
}

// ============================================
// BLOQUEOS Y AUTORIZACIONES
// ============================================

interface BloqueoAcceso {
  id: string;
  periodoAlumnoId: string;
  fechaBloqueo: Date;
  fechaDesbloqueo?: Date; // undefined = sigue bloqueado
  motivo: 'deuda' | 'manual';
  createdAt: Date;
}

interface AutorizacionManual {
  id: string;
  periodoAlumnoId: string;
  administradorId: string; // personaId con rol ADMIN
  fechaAutorizacion: Date;
  fechaVencimiento: Date;
  revocada: boolean;
  fechaRevocacion?: Date;
  createdAt: Date;
}

// ============================================
// CREDENCIALES (para autenticación con Supabase)
// ============================================

interface Credencial {
  id: string;
  personaId: string;
  email: string; // vinculado con Supabase Auth
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// ENCUESTAS (aplazado para más adelante)
// ============================================

// Pendiente de definir