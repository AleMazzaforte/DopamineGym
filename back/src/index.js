import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes/routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'API del gimnasio funcionando' });
});

app.use('/api', router);

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  
});