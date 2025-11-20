
import React, { useState } from 'react';
import { Booking } from '../types';
import { BARBERS, SERVICES } from '../constants';
import { Calendar, Clock, Trash2 } from 'lucide-react';
import { Modal } from './ui/Modal';

interface MyBookingsProps {
  bookings: Booking[];
  onCancelBooking: (id: string) => void;
}

export const MyBookings: React.FC<MyBookingsProps> = ({ bookings, onCancelBooking }) => {
  const [cancelId, setCancelId] = useState<string | null>(null);

  const handleConfirmCancel = () => {
    if (cancelId) {
      onCancelBooking(cancelId);
      setCancelId(null);
    }
  };

  const getBarberName = (id: string) => BARBERS.find(b => b.id === id)?.name || 'Неизвестный мастер';
  const getServiceName = (id: string) => SERVICES.find(s => s.id === id)?.name || 'Услуга';
  const getBarberImage = (id: string) => BARBERS.find(b => b.id === id)?.image || '';
  
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
    } catch (e) {
      return 'Дата';
    }
  };

  const sortedBookings = [...bookings].sort((a, b) => b.createdAt - a.createdAt);

  if (sortedBookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] px-6 text-center">
        <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
           <Calendar size={32} className="text-zinc-700" />
        </div>
        <h3 className="text-xl font-bold text-white uppercase mb-2">Пусто</h3>
        <p className="text-zinc-500 text-sm">У вас пока нет активных записей.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4 pb-24">
      <h2 className="text-xl font-black uppercase text-white">Мои Записи</h2>
      
      {sortedBookings.map((booking) => (
        <div 
          key={booking.id} 
          className={`
            relative bg-zinc-900 rounded-2xl p-5 border overflow-hidden
            ${booking.status === 'cancelled' ? 'border-red-900/30 opacity-75 grayscale' : 'border-zinc-800'}
          `}
        >
          <div className="flex gap-4 items-start mb-4">
            <img src={getBarberImage(booking.barberId)} alt="" className="w-12 h-12 rounded-full object-cover bg-zinc-800 border border-zinc-700" />
            <div className="flex-1">
              <h3 className="text-white font-bold text-sm uppercase leading-tight">{getServiceName(booking.serviceId)}</h3>
              <p className="text-zinc-400 text-xs mt-1">{getBarberName(booking.barberId)}</p>
            </div>
            {booking.status === 'confirmed' ? (
               <span className="bg-green-900/10 text-green-500 text-[10px] font-bold px-2 py-1 rounded uppercase border border-green-900/30">Активно</span>
            ) : (
               <span className="bg-red-900/10 text-red-500 text-[10px] font-bold px-2 py-1 rounded uppercase border border-red-900/30">Отмена</span>
            )}
          </div>

          <div className="bg-zinc-950 rounded-xl p-3 flex justify-between items-center text-sm mb-4 border border-zinc-800/50">
             <div className="flex items-center gap-2 text-white font-mono">
               <Calendar size={14} className="text-zinc-500" />
               {formatDate(booking.date)}
             </div>
             <div className="w-px h-4 bg-zinc-800" />
             <div className="flex items-center gap-2 text-white font-mono">
               <Clock size={14} className="text-zinc-500" />
               {booking.timeSlot}
             </div>
             <div className="w-px h-4 bg-zinc-800" />
             <div className="text-amber-600 font-mono font-bold">
                от {booking.price}₽
             </div>
          </div>

          {booking.status === 'confirmed' && (
            <button 
              onClick={() => setCancelId(booking.id)}
              className="w-full py-3 rounded-xl border border-zinc-800 text-zinc-400 text-sm font-medium hover:bg-red-900/10 hover:text-red-500 hover:border-red-900/30 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={16} /> Отменить запись
            </button>
          )}
        </div>
      ))}

      <Modal 
        isOpen={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={handleConfirmCancel}
        title="Отмена записи"
        description="Вы уверены? Место может занять кто-то другой."
      />
    </div>
  );
};
