// front/src/pages/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

interface FormInputs {
  dni: string;
  password: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  // Inicializamos React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInputs>();

  const onSubmit = async (data: FormInputs) => {
    setErrorServidor(null);

    try {
      // Usamos el helper centralizado api.post (maneja automáticamente si está en localhost o Vercel)
      // Mapeamos 'data.dni' al campo 'username' que espera tu backend
      const response = await api.post('/auth/login', {
        username: data.dni,
        password: data.password,
      });

      // Guardar sesión en AuthContext (pasa el usuario y el tokenGym devuelto)
      login(response.usuario, response.tokenGym);

      // Redireccionar al panel correspondiente según el rol
      if (response.usuario.rol === 'ALUMNO') {
        navigate('/mi-panel');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      setErrorServidor(error.message || 'Error al autenticar credenciales');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-sm w-full">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Dopamine Gym 🏋️‍♂️
        </h1>

        {/* CARTEL DE ERROR SI FALLA EL LOGIN */}
        {errorServidor && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm text-center font-medium">
            {errorServidor}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">DNI</label>
            <input
              type="text"
              {...register('dni', { required: 'El DNI es obligatorio' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              placeholder="Ej: 35123456"
            />
            {errors.dni && (
              <p className="text-red-500 text-xs mt-1">{errors.dni.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <input
              type="password"
              {...register('password', { required: 'La contraseña es obligatoria' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
            )}
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