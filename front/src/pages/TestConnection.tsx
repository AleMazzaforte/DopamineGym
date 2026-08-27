import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function TestConnection() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const testConnection = async () => {
      try {
        const { data, error } = await supabase
          .from('personas')
          .select('count')
          .limit(1)

        if (error) {
          if (error.message.includes('does not exist')) {
            setStatus('success')
            setMessage('✅ Conexión OK (la tabla no existe todavía, pero Supabase responde)')
          } else {
            setStatus('error')
            setMessage(`❌ Error: ${error.message}`)
          }
        } else {
          setStatus('success')
          setMessage('✅ ¡Conexión exitosa!')
        }
      } catch (err: any) {
        setStatus('error')
        setMessage(`❌ Error: ${err.message}`)
      }
    }

    testConnection()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
        <h1 className="text-2xl font-bold mb-4">Test de Conexión Supabase</h1>
        
        {status === 'loading' && (
          <p className="text-blue-600">⏳ Probando conexión...</p>
        )}
        
        {status === 'success' && (
          <div>
            <p className="text-green-600 font-semibold">{message}</p>
            <p className="text-sm text-gray-600 mt-2">
              Tu frontend está conectado correctamente a Supabase.
            </p>
          </div>
        )}
        
        {status === 'error' && (
          <div>
            <p className="text-red-600 font-semibold">{message}</p>
            <p className="text-sm text-gray-600 mt-2">
              Revisa tus credenciales en el archivo .env
            </p>
          </div>
        )}
      </div>
    </div>
  )
}