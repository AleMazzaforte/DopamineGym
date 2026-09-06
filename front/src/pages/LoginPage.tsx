// LoginPage.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { mostrarExito, mostrarError } from '../lib/swal'; 
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api'; // 👈 Importamos nuestro helper con URL dinámica

// Esquema de validación usando DNI
const loginSchema = z.object({
  dni: z.string().min(7, 'El DNI debe tener al menos 7 números'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      // 👈 Usamos api.post que ya detecta automáticamente si es local o producción
      const result = await api.post('/auth/login', {
        username: data.dni,
        password: data.password,
      });

      // Login exitoso, guardamos el tokenGym si tu backend lo devuelve
      if (result.tokenGym && result.usuario) {
        login(result.usuario, result.tokenGym); // Esto actualiza el contexto global
      }

      mostrarExito('¡Bienvenido!');
      navigate('/dashboard');

    } catch (error: any) {
      mostrarError('Error de acceso', error.message || 'Credenciales incorrectas');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-sm w-full">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Dopamine Gym 🏋️‍♂️
        </h1>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">DNI</label>
            <input
              type="text"
              {...register('dni')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              placeholder="Ej: 35123456"
            />
            {errors.dni && <p className="text-red-500 text-xs mt-1">{errors.dni.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <input
              type="password"
              {...register('password')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 transition font-medium"
          >
            {isSubmitting ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}