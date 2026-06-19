import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SortableWidgetProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function SortableWidget({ id, children, className }: SortableWidgetProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${className || ''} ${isDragging ? 'shadow-2xl z-50' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-20 p-1 rounded cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label={t('sortableWidget.dragAria')}
      >
        <GripHorizontal className="w-5 h-5" />
      </div>
      <div className={isDragging ? 'pointer-events-none' : 'h-full'}>
        {children}
      </div>
    </div>
  );
}
