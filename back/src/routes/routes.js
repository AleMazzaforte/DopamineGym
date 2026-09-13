import { Router } from 'express';
import persona from '../controllers/persona.js';
import periodo from '../controllers/periodos.js';
import cobro from '../controllers/cobros.js';
import plan from '../controllers/plan.js';
import auth from '../controllers/auth.js'; 
import asistencia from '../controllers/asistencias.js';
import { saldo } from '../controllers/saldo.js';


const router = Router();

// RUTAS DE AUTENTICACIÓN
router.post('/auth/login', auth.login);



// RUTAS DE PERSONAS
router.get('/personas', persona.getAll);
router.get('/personasHistorial/:id', persona.getHistorialEstados);
router.get('/personas/:id', persona.getById);
router.post('/personaCreate', persona.create);
router.put('/personasUpdate/:id', persona.update);
router.post('/personasProvisorio/:id', persona.activarProvisorio);


// RUTAS DE ASISTENCIAS
router.get('/asistencias/hoy', asistencia.getHoy);
router.get('/asistencias/persona/:personaId', asistencia.getByPersona);
router.post('/asistencias', asistencia.create);
router.delete('/asistencias/:id', asistencia.delete);
    
// RUTAS DE PERIODOS
router.get('/periodos/persona/:personaId', periodo.getByPersona);
router.get('/periodos/activo/:personaId', periodo.getActivo);
router.get('/periodos/ultimo/:personaId', periodo.getUltimo);
router.post('/periodos', periodo.create);
router.put('/periodos/:id/baja', periodo.registrarBaja);
router.put('/periodos/:id', periodo.update);


router.delete('/periodos/:id', periodo.delete);


// RUTAS DE COBROS

router.get('/cobros', cobro.getAll);
router.get('/cobros/rango', cobro.getByRangoFechas);
router.get('/cobros/persona/:personaId', cobro.getByPersona);
router.get('/cobros/metodo', cobro.getByMetodoPago);
router.get('/cobros/periodo-activo/:personaId', cobro.getPeriodoActivoWithPlan);
router.post('/cobros', cobro.create);
router.put('/cobros/:id', cobro.update);
router.delete('/cobros/:id', cobro.delete);

// Saldo del alumno
router.get('/alumnos/:personaId/saldo', saldo.getSaldoAlumno);

// RUTAS DE PLANES
router.get('/planes', plan.getAllPlanes);
router.get('/planes/:id', plan.getById);
router.post('/planes', plan.create);
router.put('/planes/:id', plan.update);
router.put('/planes/toggle-estado/:id', plan.toggleEstado);

export default router;