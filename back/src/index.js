import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes/routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de CORS explícita para desarrollo y producción
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://dopamine-gym.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como Postman o curl) o si están en la lista
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por política de CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Ruta de prueba
app.get('/api', (req, res) => {
  res.json({ message: 'API del gimnasio funcionando' });
});

app.use('/api', router);

// En desarrollo se ejecuta app.listen
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });
}

export default app;