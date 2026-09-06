import dotenv from 'dotenv';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import router from './routes/routes.js';

dotenv.config();

const port = process.env.PORT || 3001;
const app = express();

// Middlewares para procesar formularios, json y cookies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Configuración de CORS idéntica a tu proyecto funcional
const corsOptions = {
  origin: [
    'https://dopamine-gym.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // 👈 Clave para que las peticiones preflight (OPTIONS) no den CORS error

// Ruta de prueba en la raíz
app.get('/', (req, res) => {
  res.send(`Servidor de Dopamine Gym corriendo en puerto: ${port}`);
});

// Registrar todas las rutas bajo /api
app.use('/api', router);

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Servidor corriendo en puerto: ${port}`);
  });
}
export default app;