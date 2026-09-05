import { Router } from 'express';
import persona from '../controllers/persona.js';
import periodo from '../controllers/periodos.js';
import cobro from '../controllers/cobros.js';
import plan from '../controllers/plan.js';
import auth from '../controllers/auth.js'; 

const router = Router();

// RUTAS DE AUTENTICACIÓN
router.post('/auth/login', auth.login);



// RUTAS DE PERSONAS
router.get('/personas', persona.getAll);
router.get('/personas/:id/historial', persona.getHistorialEstados);
router.get('/personas/:id', persona.getById);
router.post('/personaCreate', persona.create);
router.put('/personas/:id', persona.update);

// RUTAS DE PERIODOS
router.get('/periodos/persona/:personaId', periodo.getByPersona);
router.get('/periodos/activo/:personaId', periodo.getActivo);
router.get('/periodos/ultimo/:personaId', periodo.getUltimo);
router.post('/periodos', periodo.create);
router.put('/periodos/:id/baja', periodo.registrarBaja);
router.put('/periodos/:id', periodo.update);

router.delete('/periodos/:id', periodo.delete);
//"api/periodos/11/baja"
// RUTAS DE COBROS
router.get('/cobros', cobro.getAll);
router.get('/cobros/rango', cobro.getByRangoFechas);
router.get('/cobros/metodo', cobro.getByMetodoPago);
router.get('/cobros/periodo-activo/:personaId', cobro.getPeriodoActivoWithPlan);
router.post('/cobros', cobro.create);
router.put('/cobros/:id', cobro.update);
router.delete('/cobros/:id', cobro.delete);

// RUTAS DE PLANES
router.get('/planes', plan.getAllPlanes);

export default router;