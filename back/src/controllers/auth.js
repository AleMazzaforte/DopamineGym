import { pool } from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const auth = {
  login: async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Faltan credenciales' });
      }

      // 1. Buscar al usuario y traer también el rol de su tabla persona
      const query = `
        SELECT u.id, u.password_hash, u.persona_id, p.rol_actual, p.nombre, p.apellido 
        FROM usuarios u
        INNER JOIN personas p ON u.persona_id = p.id
        WHERE u.username = ? AND u.activo = TRUE
      `;
      
      const [rows] = await pool.query(query, [username]);

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const usuario = rows[0];

      // 2. Comparar la contraseña ingresada con el hash de la base de datos
      const passwordValida = await bcrypt.compare(password, usuario.password_hash);

      if (!passwordValida) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const tokenGym = jwt.sign(
        { id: usuario.id, persona_id: usuario.persona_id, rol: usuario.rol_actual },
        process.env.JWT_SECRET,        
      );

      // 3. Responder con los datos del usuario (más adelante aquí devolverás un token JWT)
      res.json({
        message: 'Login exitoso',
        tokenGym: tokenGym,
        usuario: {
          id: usuario.id,
          persona_id: usuario.persona_id,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          rol: usuario.rol_actual
        }
      });

    } catch (error) {
      console.error('❌ Error en login:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
};

export default auth;