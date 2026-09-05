import { pool } from './src/config/database.js'; 
import bcrypt from 'bcryptjs';

async function generarPrimerUsuario() {
  try {
    console.log('⏳ Creando administrador...');

    const dni = '23823934';
    const password = 'pipochipolati';

    const [personas] = await pool.query('SELECT id FROM personas WHERE dni = ?', [dni]);
    let personaId;

    if (personas.length > 0) {
      personaId = personas[0].id;
      console.log('La persona ya existe, usando su ID...');
    } else {
      // 👉 AGREGAMOS EL TELÉFONO AQUÍ
      const [resultPersona] = await pool.query(
        `INSERT INTO personas (nombre, apellido, dni, telefono, fecha_nacimiento, rol_actual) 
         VALUES (?, ?, ?, ?, ?, 'ADMIN')`, 
        ['Admin', 'Principal', dni, '23823934', '1974-03-23']
      );
      personaId = resultPersona.insertId;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 👉 QUITAMOS LA FECHA DE NACIMIENTO DE ESTA TABLA
    await pool.query(
      `INSERT INTO usuarios (persona_id, username, password_hash) 
       VALUES (?, ?, ?)`,
      [personaId, dni, passwordHash]
    );

    console.log('✅ ¡Administrador creado con éxito!');
    console.log('-----------------------------------');
    console.log(`👤 Usuario (DNI) : ${dni}`);
    console.log(`🔑 Contraseña    : ${password}`);
    console.log('-----------------------------------');

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('❌ El usuario ya existe en la base de datos.');
    } else {
      console.error('❌ Error:', error);
    }
  } finally {
    process.exit(0); 
  }
}

generarPrimerUsuario();