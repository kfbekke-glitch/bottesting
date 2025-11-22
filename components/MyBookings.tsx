
import React, { useState } from 'react';
import { Booking } from '../types';
import { BARBERS, SERVICES } from '../constants';
import { Calendar, Clock, Trash2 } from 'lucide-react';
import { Modal } from './ui/Modal';

interface MyBookingsProps {
  bookings: Booking[];
  onCancelBooking: (id: string) => void;
}

// Helper to safely extract time from potentially malformed strings
const cleanTimeDisplay = (time: string) => {
  if (!time) return '--:--';
  if (time.includes('T')) {
    const match = time.match(/T(\d{2}):(\d{2})/);
    if (match) return `${match[1]}:${match[2]}`;
    try {
        const d = new Date(time);
        if(!isNaN(d.getTime())) {
            return `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`;
        }
    } catch(e) {}
  }
  if (time.includes(':')) return time.substring(0, 5);
  return time;
}

export const MyBookings: React.FC<MyBookingsProps> = ({ bookings, onCancelBooking }) => {
  const [cancelId, setCancelId] = useState<string | null>(null);

  const handleConfirmCancel = () => {
    if (cancelId) {
      onCancelBooking(cancelId);
      setCancelId(null);
    }
  };

  const getBookingDetails = (booking: Booking) => {
    const barber = BARBERS.find(b => b.id === booking.barberId);
    const service = SERVICES.find(s => s.id === booking.serviceId);
    const serviceOffer = barber?.services.find(so => so.serviceId === booking.serviceId);
    
    // Dynamically calculate price from constants for accuracy, using stored price as fallback.
    let price = booking.price;
    if (serviceOffer) {
      price = serviceOffer.price;
      if (serviceOffer.serviceId === 's5') { // Apply promo discount
        price = Math.floor(price * 0.85);
      }
    }

    return {
      barberName: barber?.name || 'Неизвестный мастер',
      serviceName: service?.name || 'Услуга',
      barberImage: barber?.image || '',
      price: price
    };
  };
  
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return 'Неверная дата';
      }
      return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
    } catch (e) {
      return 'Дата';
    }
  };

  const sortedBookings = [...bookings].sort((a, b) => {
    try {
      const [hA, mA] = cleanTimeDisplay(a.timeSlot).split(':').map(Number);
      const dateTimeA = new Date(a.date);
      if(!isNaN(hA)) dateTimeA.setHours(hA, mA, 0, 0);

      const [hB, mB] = cleanTimeDisplay(b.timeSlot).split(':').map(Number);
      const dateTimeB = new Date(b.date);
      if(!isNaN(hB)) dateTimeB.setHours(hB, mB, 0, 0);

      const timeA = dateTimeA.getTime();
      const timeB = dateTimeB.getTime();

      if (isNaN(timeA)) return 1;
      if (isNaN(timeB)) return -1;
      
      return timeB - timeA;
    } catch(e) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
  });


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
      
      {sortedBookings.map((booking) => {
        const { barberName, serviceName, barberImage, price } = getBookingDetails(booking);
        const displayTime = cleanTimeDisplay(booking.timeSlot);

        return (
          <div 
            key={booking.id} 
            className={`
              relative bg-zinc-900 rounded-2xl p-5 border overflow-hidden
              ${booking.status === 'cancelled' ? 'border-red-900/30 opacity-75 grayscale' : 'border-zinc-800'}
            `}
          >
            <div className="flex gap-4 items-start mb-4">
              <img src={barberImage} alt="" className="w-12 h-12 rounded-full object-cover bg-zinc-800 border border-zinc-700" />
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm uppercase leading-tight">{serviceName}</h3>
                <p className="text-zinc-400 text-xs mt-1">{barberName}</p>
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
                 {displayTime}
               </div>
               <div className="w-px h-4 bg-zinc-800" />
               <div className="text-amber-600 font-mono font-bold">
                  от {price}₽
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
        )
      })}

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
