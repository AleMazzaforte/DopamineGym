-- ============================================
-- 1. PERSONAS
-- ============================================
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dni TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  telefono TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  rol_actual TEXT NOT NULL CHECK (rol_actual IN ('ALUMNO', 'PROFESOR', 'ADMIN')),
  contacto_emergencia TEXT,
  telefono_familiar TEXT,
  antecedentes_entrenamiento TEXT,
  restricciones TEXT,
  certificado_medico TEXT, -- URL o path del archivo
  fecha_vencimiento_certificado DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. HISTORIAL DE ROLES
-- ============================================
CREATE TABLE historial_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  rol TEXT NOT NULL CHECK (rol IN ('ALUMNO', 'PROFESOR', 'ADMIN')),
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ, -- NULL = rol actual
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT historial_roles_unique_active UNIQUE (persona_id, rol, fecha_inicio)
);

-- Índice para búsqueda rápida de roles actuales
CREATE INDEX idx_historial_roles_persona_activo ON historial_roles(persona_id) WHERE fecha_fin IS NULL;

-- ============================================
-- 3. CREDENCIALES (vinculado a Supabase Auth)
-- ============================================
CREATE TABLE credenciales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE, -- Debe coincidir con auth.users
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. PERIODOS COMO ALUMNO
-- ============================================
CREATE TABLE periodos_alumno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE, -- NULL = período activo
  motivo_baja TEXT CHECK (motivo_baja IN (
    'cambio_domicilio',
    'vacaciones',
    'lesion',
    'cuestiones_laborales',
    'disgusto_personal',
    'disgusto_instalaciones',
    'asistencia_intermitente',
    'problemas_financieros',
    'otros'
  )),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para buscar períodos activos
CREATE INDEX idx_periodos_alumno_activo ON periodos_alumno(persona_id) WHERE fecha_fin IS NULL;

-- ============================================
-- 5. PLANES
-- ============================================
CREATE TABLE planes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  veces_por_semana INTEGER CHECK (veces_por_semana >= 1 AND veces_por_semana <= 7), -- NULL = pase libre
  precio DECIMAL(10,2) NOT NULL CHECK (precio > 0),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. PERIODOS DE COBERTURA
-- ============================================
CREATE TABLE periodos_cobertura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_alumno_id UUID NOT NULL REFERENCES periodos_alumno(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES planes(id),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL, -- fecha de vencimiento
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT cobertura_fechas_validas CHECK (fecha_fin >= fecha_inicio)
);

-- Índice para buscar cobertura activa
CREATE INDEX idx_cobertura_activa ON periodos_cobertura(periodo_alumno_id, fecha_fin);

-- ============================================
-- 7. DIAS HABILITADOS (para alumnos)
-- ============================================
CREATE TABLE dias_habilitados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_alumno_id UUID NOT NULL REFERENCES periodos_alumno(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 1 AND dia_semana <= 7), -- 1=Lunes ... 7=Domingo
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE, -- NULL = actualmente habilitado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT dias_habilitados_unique UNIQUE (periodo_alumno_id, dia_semana, fecha_inicio)
);

-- Índice para consultar días actuales
CREATE INDEX idx_dias_habilitados_activos ON dias_habilitados(periodo_alumno_id) WHERE fecha_fin IS NULL;

-- ============================================
-- 8. ASISTENCIAS
-- ============================================
CREATE TABLE asistencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_alumno_id UUID NOT NULL REFERENCES periodos_alumno(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_entrada TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT asistencia_unica_dia UNIQUE (periodo_alumno_id, fecha)
);

-- Índice para consultas diarias
CREATE INDEX idx_asistencias_fecha ON asistencias(fecha);

-- ============================================
-- 9. PAGOS
-- ============================================
CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_alumno_id UUID NOT NULL REFERENCES periodos_alumno(id) ON DELETE CASCADE,
  fecha_pago DATE NOT NULL,
  monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjetas', 'QR', 'debito_automatico')),
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para consultas por período
CREATE INDEX idx_pagos_periodo ON pagos(periodo_alumno_id);

-- ============================================
-- 10. HORARIOS LABORALES DE PROFESORES
-- ============================================
CREATE TABLE horarios_laborales_profesores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profesor_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 1 AND dia_semana <= 7),
  hora_entrada TIME NOT NULL,
  hora_salida TIME NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE, -- NULL = horario actual
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT horario_valido CHECK (hora_salida > hora_entrada)
);

-- Índice para horarios actuales
CREATE INDEX idx_horarios_profesores_activos ON horarios_laborales_profesores(profesor_id) WHERE fecha_fin IS NULL;

-- ============================================
-- 11. BLOQUEOS DE ACCESO
-- ============================================
CREATE TABLE bloqueos_acceso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_alumno_id UUID NOT NULL REFERENCES periodos_alumno(id) ON DELETE CASCADE,
  fecha_bloqueo DATE NOT NULL,
  fecha_desbloqueo DATE, -- NULL = sigue bloqueado
  motivo TEXT NOT NULL CHECK (motivo IN ('deuda', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para buscar bloqueos activos
CREATE INDEX idx_bloqueos_activos ON bloqueos_acceso(periodo_alumno_id) WHERE fecha_desbloqueo IS NULL;

-- ============================================
-- 12. AUTORIZACIONES MANUALES
-- ============================================
CREATE TABLE autorizaciones_manuales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_alumno_id UUID NOT NULL REFERENCES periodos_alumno(id) ON DELETE CASCADE,
  administrador_id UUID NOT NULL REFERENCES personas(id),
  fecha_autorizacion DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  revocada BOOLEAN DEFAULT FALSE,
  fecha_revocacion DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT autorizacion_fechas_validas CHECK (fecha_vencimiento >= fecha_autorizacion)
);

-- Índice para buscar autorizaciones vigentes
CREATE INDEX idx_autorizaciones_vigentes ON autorizaciones_manuales(periodo_alumno_id, revocada, fecha_vencimiento);

-- ============================================
-- 13. ENCUESTAS (aplazado para más adelante)
-- ============================================
-- Pendiente de definir
-- Tablas: encuestas, preguntas, respuestas

-- ============================================
-- TRIGGERS PARA updated_at
-- ============================================

-- Función helper para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con updated_at
CREATE TRIGGER update_personas_updated_at BEFORE UPDATE ON personas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_credenciales_updated_at BEFORE UPDATE ON credenciales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_periodos_alumno_updated_at BEFORE UPDATE ON periodos_alumno FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_planes_updated_at BEFORE UPDATE ON planes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_periodos_cobertura_updated_at BEFORE UPDATE ON periodos_cobertura FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VISTA PARA CALCULAR SALDO POR PERÍODO
-- ============================================

CREATE OR REPLACE VIEW saldo_por_periodo AS
SELECT 
  pa.id AS periodo_alumno_id,
  pa.persona_id,
  COALESCE(pagos_totales.total_pagado, 0) AS total_pagado,
  COALESCE(coberturas_totales.total_coberturas, 0) AS total_coberturas,
  COALESCE(pagos_totales.total_pagado, 0) - COALESCE(coberturas_totales.total_coberturas, 0) AS saldo
FROM periodos_alumno pa
LEFT JOIN (
  -- Subconsulta para sumar pagos sin duplicar por coberturas
  SELECT periodo_alumno_id, SUM(monto) AS total_pagado
  FROM pagos
  GROUP BY periodo_alumno_id
) pagos_totales ON pagos_totales.periodo_alumno_id = pa.id
LEFT JOIN (
  -- Subconsulta para sumar precios de planes sin duplicar por pagos
  SELECT pc.periodo_alumno_id, SUM(pl.precio) AS total_coberturas
  FROM periodos_cobertura pc
  JOIN planes pl ON pl.id = pc.plan_id
  GROUP BY pc.periodo_alumno_id
) coberturas_totales ON coberturas_totales.periodo_alumno_id = pa.id;


-- ============================================
-- DESACTIVAR RLS TEMPORALMENTE PARA DESARROLLO
-- ============================================
ALTER TABLE personas DISABLE ROW LEVEL SECURITY;
ALTER TABLE historial_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE credenciales DISABLE ROW LEVEL SECURITY;
ALTER TABLE periodos_alumno DISABLE ROW LEVEL SECURITY;
ALTER TABLE planes DISABLE ROW LEVEL SECURITY;
ALTER TABLE periodos_cobertura DISABLE ROW LEVEL SECURITY;
ALTER TABLE dias_habilitados DISABLE ROW LEVEL SECURITY;
ALTER TABLE asistencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE pagos DISABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_laborales_profesores DISABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueos_acceso DISABLE ROW LEVEL SECURITY;
ALTER TABLE autorizaciones_manuales DISABLE ROW LEVEL SECURITY;