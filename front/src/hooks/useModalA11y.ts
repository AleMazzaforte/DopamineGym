// hooks/useModalA11y.ts
// Encapsula el comportamiento accesible estándar de todos los modales:
// cierre con Escape, clic en backdrop, y foco inicial en el contenedor

import { useEffect, useRef } from 'react';

interface UseModalA11yOptions {
  open: boolean;
  onClose: () => void;
}

export function useModalA11y({ open, onClose }: UseModalA11yOptions) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // Mueve el foco al contenedor del modal al abrir
    dialogRef.current?.focus();

    // Listener de teclado: cierra con Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);

    // Bloquea el scroll del body mientras el modal está abierto
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  // Handler para cerrar al hacer clic en el backdrop (no en el contenido)
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return { dialogRef, handleBackdropClick };
}