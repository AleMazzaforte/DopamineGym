import { Router } from 'express';
import persona from '../controllers/persona.js';
import periodo from '../controllers/periodos.js';
import cobro from '../controllers/cobros.js';
import plan from '../controllers/plan.js';
import auth from '../controllers/auth.js'; 
import asistencia from '../controllers/asistencias.js';
import saldo  from '../controllers/saldo.js';
import { verificarToken, permitirRoles } from '../middlewares/authMiddleware.js';
import caja from '../controllers/caja.js';
import producto from '../controllers/producto.js';
import venta from '../controllers/venta.js';
import reporte from '../controllers/reporte.js';


const router = Router();

// ==========================================
// 1. RUTAS PÚBLICAS
// ==========================================
router.post('/auth/login', auth.login);

// ==========================================
// MIDDLEWARE GLOBAL DE AUTENTICACIÓN
// A partir de aquí, todas las rutas requieren Token JWT válido
// ==========================================
router.use(verificarToken);

// ==========================================
// 2. RUTAS DE PERSONAS
// ==========================================
// Consulta general de alumnos/personas
router.get('/personas', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR'), persona.getAll);
router.get('/personasHistorial/:id', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR', 'ALUMNO'), persona.getHistorialEstados);
router.get('/personas/:id', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR', 'ALUMNO'), persona.getById);

// Gestión y Alta/Edición de personas
router.post('/personaCreate', permitirRoles('ADMIN', 'COLABORADOR'), persona.create);
router.put('/personasUpdate/:id', permitirRoles('ADMIN', 'COLABORADOR'), persona.update);
router.post('/personasProvisorio/:id', permitirRoles('ADMIN', 'COLABORADOR'), persona.activarProvisorio);

// ==========================================
// 3. RUTAS DE ASISTENCIAS
// ==========================================
router.get('/asistencias/hoy', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR'), asistencia.getHoy);
router.get('/asistencias/persona/:personaId', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR', 'ALUMNO'), asistencia.getByPersona);
router.post('/asistencias', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR'), asistencia.create);
router.delete('/asistencias/:id', permitirRoles('ADMIN', 'COLABORADOR'), asistencia.delete);

// ==========================================
// 4. RUTAS DE PERÍODOS / INSCRIPCIONES
// ==========================================
router.get('/periodos/persona/:personaId', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR', 'ALUMNO'), periodo.getByPersona);
router.get('/periodos/activo/:personaId', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR', 'ALUMNO'), periodo.getActivo);
router.get('/periodos/ultimo/:personaId', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR', 'ALUMNO'), periodo.getUltimo);

router.post('/periodos', permitirRoles('ADMIN', 'COLABORADOR'), periodo.create);
router.put('/periodos/:id/baja', permitirRoles('ADMIN', 'COLABORADOR'), periodo.registrarBaja);
router.put('/periodos/:id', permitirRoles('ADMIN', 'COLABORADOR'), periodo.update);
router.delete('/periodos/:id', permitirRoles('ADMIN'), periodo.delete);

// ==========================================
// 5. RUTAS DE COBROS Y CAJA
// ==========================================
router.get('/cobros', permitirRoles('ADMIN', 'COLABORADOR'), cobro.getAll);
router.get('/cobros/rango', permitirRoles('ADMIN', 'COLABORADOR'), cobro.getByRangoFechas);

// Ruta unificada para el modal de cobros (1 sola petición)
router.get('/cobros/modal-data/:personaId', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR'), cobro.getModalData);
router.get('/cobros/persona/:personaId', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR'), cobro.getByPersona);
router.get('/cobros/metodo', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR'), cobro.getByMetodoPago);

router.get('/cobros/periodo-activo/:personaId', permitirRoles('ADMIN', 'COLABORADOR'), cobro.getPeriodoActivoWithPlan);

router.post('/cobros', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR'), cobro.create);
router.post('/cobros/completar-deuda/:coberturaId', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR'), cobro.completarDeuda);
router.get('/cobros/deudas-pendientes/:personaId', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR'), cobro.getDeudasPendientes);
router.put('/cobros/:id', permitirRoles('ADMIN', 'COLABORADOR'), cobro.update);
router.delete('/cobros/:id', permitirRoles('ADMIN'), cobro.delete);

// Saldo del alumno
router.get('/alumnos/:personaId/saldo', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR', 'ALUMNO'), saldo.getSaldoAlumno);

// ==========================================
// 6. RUTAS DE PLANES (CONFIGURACIÓN)
// ==========================================
// Lectura de planes disponible para todos
router.get('/planes', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR', 'ALUMNO'), plan.getAllPlanes);
router.get('/planes/:id', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR', 'ALUMNO'), plan.getById);

// Modificación y creación de planes restringido a Admin
router.post('/planes', permitirRoles('ADMIN'), plan.create);
router.put('/planes/:id', permitirRoles('ADMIN'), plan.update);
router.put('/planes/toggle-estado/:id', permitirRoles('ADMIN'), plan.toggleEstado);

// ==========================================
// 7. RUTAS DE CAJA Y ARQUEO DIARIO
// ==========================================
router.get('/caja/estado', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR'), caja.getEstadoCaja);
router.get('/caja/resumen', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR'), caja.getResumenCaja);
router.post('/caja/abrir', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR'), caja.abrirCaja);
router.put('/caja/cerrar/:id', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR'), caja.cerrarCaja);
router.post('/caja/egresos', permitirRoles('ADMIN', 'COLABORADOR', 'PROFESOR'), caja.registrarEgreso);
router.post('/caja/retiros', permitirRoles('ADMIN'), caja.registrarRetiro);
// ==========================================
// 8. RUTAS DE PRODUCTOS (INVENTARIO)
// ==========================================
router.get('/productos', permitirRoles('ADMIN', 'COLABORADOR'), producto.getAll);
router.get('/productos/:id', permitirRoles('ADMIN', 'COLABORADOR'), producto.getById);

router.post('/productos', permitirRoles('ADMIN'), producto.create);
router.put('/productos/:id', permitirRoles('ADMIN'), producto.update);
router.put('/productos/stock/:id', permitirRoles('ADMIN', 'COLABORADOR'), producto.updateStock);
router.put('/productos/toggle-estado/:id', permitirRoles('ADMIN'), producto.toggleEstado);

// ==========================================
// 9. RUTAS DE VENTAS DE INSUMOS
// ==========================================
router.get('/ventas', permitirRoles('ADMIN', 'COLABORADOR'), venta.getAll);
router.get('/ventas/:id', permitirRoles('ADMIN', 'COLABORADOR'), venta.getByIdWithDetails);

router.post('/ventas', permitirRoles('ADMIN', 'COLABORADOR'), venta.create);
router.delete('/ventas/:id', permitirRoles('ADMIN'), venta.anular);

// ==========================================
// 10. REPORTES Y CIERRE MENSUAL
// ==========================================
router.get('/reportes/alumnos/panorama', permitirRoles('ADMIN'), reporte.getPanoramaAlumnos);
router.get('/reportes/mensual', permitirRoles('ADMIN', 'COLABORADOR'), reporte.getMensual);
router.post('/reportes/contabilizar', permitirRoles('ADMIN'), reporte.contabilizar);
router.delete('/reportes/contabilizar/:periodo', permitirRoles('ADMIN'), reporte.reabrir);

export default router;