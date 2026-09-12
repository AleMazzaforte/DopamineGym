import { useState, useEffect, useRef, type ReactNode } from 'react';

export interface NavegadorFlechasProps<T> {
  items: T[];
  keyExtractor: (item: T) => string | number;
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  onSelect: (item: T) => void;
  isOpen: boolean;
  onClose?: () => void;
  cargando?: boolean;
  emptyMessage?: string;
  className?: string;
}

export default function NavegadorFlechas<T>({
  items,
  keyExtractor,
  renderItem,
  onSelect,
  isOpen,
  onClose,
  cargando = false,
  emptyMessage = 'No hay coincidencia con su búsqueda',
  className = '',
}: NavegadorFlechasProps<T>) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reiniciar selección al ítem 0 si cambia la lista o abre
  useEffect(() => {
    setSelectedIndex(0);
  }, [items, isOpen]);

  // Autoscroll para mantener la opción visible
  useEffect(() => {
    if (!isOpen || items.length === 0) return;
    const selectedElement = containerRef.current?.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen, items.length]);

  // Manejo de eventos de teclado (Flechas, Enter, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }

      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          onSelect(items[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedIndex, onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className={`absolute top-full left-0 right-0 bg-white mt-1 rounded-lg shadow-xl border border-gray-200 z-50 max-h-60 overflow-y-auto divide-y divide-gray-100 ${className}`}
    >
      {cargando ? (
        <div className="p-4 text-center text-sm text-gray-400 font-medium">
          
        </div>
      ) : items.length === 0 ? (
        <div className="p-4 text-center text-sm text-gray-500 font-medium">
          {emptyMessage}
        </div>
      ) : (
        items.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <div
              key={keyExtractor(item)}
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`cursor-pointer transition-colors ${
                isSelected ? 'bg-blue-100' : 'hover:bg-gray-50'
              }`}
            >
              {renderItem(item, isSelected)}
            </div>
          );
        })
      )}
    </div>
  );
}