
import React, { useMemo, useState } from 'react';
import { Booking } from '../types';
import { BARBERS, SERVICES } from '../constants';
import { Shield, DollarSign, Users, Calendar, Clock, Trash2, Filter, CheckCircle2, Phone, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { Modal } from './ui/Modal';

interface AdminViewProps {
  bookings: Booking[];
  onDeleteBooking: (id: string) => void;
  onUpdatePrice: (id: string, newPrice: number) => void;
}

// Helper to clean time
const cleanTime = (time: string) => {
  if (!time) return '--:--';
  if (time.includes('T')) {
    const match = time.match(/T(\d{2}):(\d{2})/);
    if (match) return `${match[1]}:${match[2]}`;
  }
  if (time.includes(':')) return time.substring(0, 5);
  return time;
};

// Helper to check if booking time has passed
const isBookingCompleted = (dateStr: string, timeStr: string): boolean => {
  try {
    const now = new Date();
    // Simple string comparison works well for ISO YYYY-MM-DD
    const todayStr = now.toISOString().split('T')[0];
    
    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;
    
    // If today, check time
    const [h, m] = cleanTime(timeStr).split(':').map(Number);
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    
    if (h < nowH) return true;
    if (h === nowH && m <= nowM) return true;
    
    return false;
  } catch (e) {
    return false;
  }
};

export const AdminView: React.FC<AdminViewProps> = ({ bookings, onDeleteBooking, onUpdatePrice }) => {
  const [filterBarberId, setFilterBarberId] = useState<string | null>(null);
  // Default to today's date in YYYY-MM-DD format
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Price Edit State
  const [editPriceId, setEditPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');

  // 1. Filter bookings based on Barbers
  const barberFilteredBookings = useMemo(() => {
    if (!filterBarberId) return bookings;
    return bookings.filter(b => String(b.barberId) === String(filterBarberId));
  }, [bookings, filterBarberId]);

  // 2. Filter based on Date (for the list view)
  const dateFilteredBookings = useMemo(() => {
    return barberFilteredBookings.filter(b => b.date === selectedDate && b.status === 'confirmed');
  }, [barberFilteredBookings, selectedDate]);
  
  // 3. Calculate stats based on SELECTED DATE
  const stats = useMemo(() => {
    const totalPlan = dateFilteredBookings.reduce((sum, b) => sum + (b.price || 0), 0);
    const totalCount = dateFilteredBookings.length;

    const earned = dateFilteredBookings.reduce((sum, b) => {
      if (isBookingCompleted(b.date, b.timeSlot)) {
        return sum + (b.price || 0);
      }
      return sum;
    }, 0);

    return {
      totalPlan,
      earned,
      totalCount
    };
  }, [dateFilteredBookings]);

  const sortedBookings = [...dateFilteredBookings].sort((a, b) => {
    // Sort by time ascending (earliest first) for the daily schedule
    const timeA = cleanTime(a.timeSlot);
    const timeB = cleanTime(b.timeSlot);
    return timeA.localeCompare(timeB);
  });

  const getBarberName = (id: string) => BARBERS.find(b => b.id === id)?.name || id;
  const getServiceName = (id: string) => SERVICES.find(s => s.id === id)?.name || id;

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };
  
  const handleConfirmDelete = () => {
    if (deleteId) {
      onDeleteBooking(deleteId);
      setDeleteId(null);
    }
  };
  
  const handleEditPriceClick = (booking: Booking) => {
    setEditPriceId(booking.id);
    setEditPriceValue(String(booking.price));
  };
  
  const handleConfirmPriceUpdate = () => {
    if (editPriceId && editPriceValue) {
      const val = parseInt(editPriceValue, 10);
      if (!isNaN(val)) {
        onUpdatePrice(editPriceId, val);
      }
      setEditPriceId(null);
    }
  };

  // Formatting date for display header
  const displayDateTitle = useMemo(() => {
    const d = new Date(selectedDate);
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate === today) return 'Сегодня';
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' }).format(d);
  }, [selectedDate]);

  return (
    <div className="px-4 py-6 space-y-6 pb-24">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-amber-600 p-2 rounded-lg text-black">
          <Shield size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black uppercase text-white leading-none">Админ Панель</h1>
          <p className="text-xs text-zinc-500 font-mono uppercase">Режим Бога</p>
        </div>
      </div>

      {/* Barber Filter Scroll */}
      <div>
        <div className="text-[10px] font-bold text-zinc-500 uppercase mb-2 flex items-center gap-1">
          <Filter size={10} /> Фильтр по мастеру
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          <button
            onClick={() => setFilterBarberId(null)}
            className={`
              shrink-0 px-4 py-2 rounded-xl border flex items-center gap-2 transition-colors
              ${filterBarberId === null 
                ? 'bg-white text-black border-white' 
                : 'bg-zinc-900 text-zinc-400 border-zinc-800'}
            `}
          >
            <span className="text-xs font-black uppercase">Все</span>
          </button>

          {BARBERS.map(barber => (
            <button
              key={barber.id}
              onClick={() => setFilterBarberId(filterBarberId === barber.id ? null : barber.id)}
              className={`
                shrink-0 pr-4 pl-1 py-1 rounded-full border flex items-center gap-2 transition-colors
                ${filterBarberId === barber.id 
                  ? 'bg-amber-600 text-black border-amber-600' 
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'}
              `}
            >
              <img src={barber.image} className="w-8 h-8 rounded-full object-cover" alt="" />
              <span className="text-xs font-bold uppercase whitespace-nowrap">{barber.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date Picker Control */}
      <div className="bg-zinc-900 p-2 rounded-xl border border-zinc-800 flex items-center justify-between">
        <button onClick={handlePrevDay} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg">
          <ChevronLeft size={20} />
        </button>
        <div className="flex flex-col items-center relative">
           <span className="text-sm font-bold text-white uppercase">{displayDateTitle}</span>
           <input 
             type="date" 
             value={selectedDate} 
             onChange={(e) => setSelectedDate(e.target.value)}
             className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
           />
           <span className="text-[10px] text-zinc-500">Нажми, чтобы сменить</span>
        </div>
        <button onClick={handleNextDay} className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Stats Grid (Dynamic) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <div className="text-zinc-500 text-[10px] uppercase font-bold mb-1 flex items-center gap-1">
            <DollarSign size={12} /> Касса (Факт / План)
          </div>
          <div className="flex items-baseline gap-1">
             <span className="text-xl font-mono font-bold text-amber-500">{stats.earned.toLocaleString()}</span>
             <span className="text-sm font-mono text-zinc-600">/ {stats.totalPlan.toLocaleString()}₽</span>
          </div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <div className="text-zinc-500 text-[10px] uppercase font-bold mb-1 flex items-center gap-1">
            <Users size={12} /> Клиентов
          </div>
          <div className="text-2xl font-mono font-bold text-white">{stats.totalCount}</div>
        </div>
      </div>

      {/* Bookings List */}
      <div>
        <h2 className="text-lg font-bold uppercase text-white mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-amber-600" /> 
          Список записей
        </h2>
        
        <div className="space-y-3">
          {sortedBookings.length === 0 ? (
            <div className="text-center py-10 border border-zinc-800 border-dashed rounded-xl">
              <p className="text-zinc-500 text-sm">На этот день записей нет</p>
            </div>
          ) : (
            sortedBookings.map(booking => {
              const isDone = isBookingCompleted(booking.date, booking.timeSlot);
              
              return (
                <div 
                  key={booking.id} 
                  className={`
                    bg-zinc-900 rounded-xl p-4 border relative transition-all
                    ${isDone ? 'border-zinc-800 opacity-70' : 'border-zinc-700 shadow-lg shadow-black/20'}
                  `}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-white font-bold text-sm flex items-center gap-2">
                        {booking.clientName}
                        {isDone && <CheckCircle2 size={14} className="text-green-600" />}
                      </div>
                      {/* PHONE NUMBER FIX: Display visually robust phone */}
                      <a href={`tel:${booking.clientPhone}`} className="flex items-center gap-1 text-zinc-400 text-xs mt-1 hover:text-amber-500">
                        <Phone size={10} /> {booking.clientPhone || 'Нет телефона'}
                      </a>
                    </div>
                    <div className="text-right">
                      <button 
                        onClick={() => handleEditPriceClick(booking)}
                        className={`font-mono font-bold flex items-center gap-1 active:scale-95 transition-transform hover:bg-zinc-800 px-1 rounded ${isDone ? 'text-green-600' : 'text-amber-600'}`}
                      >
                         {booking.price}₽ <Edit2 size={10} className="opacity-50" />
                      </button>
                      <div className="text-zinc-600 text-[10px] uppercase mt-1">{isDone ? 'Выполнено' : 'Ожидание'}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                     <div className="bg-zinc-950 rounded-lg p-2 flex items-center gap-2 text-xs text-zinc-400 border border-zinc-800/50">
                       <Calendar size={12} /> {booking.date}
                     </div>
                     <div className="bg-zinc-950 rounded-lg p-2 flex items-center gap-2 text-xs text-zinc-400 border border-zinc-800/50">
                       <Clock size={12} /> {cleanTime(booking.timeSlot)}
                     </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-zinc-800 pt-3 mt-1">
                     <div className="flex flex-col">
                         <span className={`text-xs font-bold ${filterBarberId ? 'text-amber-500' : 'text-zinc-300'}`}>
                            {getBarberName(booking.barberId)}
                         </span>
                         <span className="text-[10px] text-zinc-500 truncate max-w-[150px]">{getServiceName(booking.serviceId)}</span>
                     </div>

                     <button 
                        onClick={() => setDeleteId(booking.id)}
                        className="flex items-center gap-1 px-3 py-2 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-bold uppercase hover:bg-red-500/20 transition-colors border border-red-500/20"
                     >
                        <Trash2 size={14} />
                        Удалить
                     </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      <Modal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Удалить запись?"
        description="Вы собираетесь отменить эту бронь. Это действие нельзя отменить."
      />

      <Modal 
        isOpen={!!editPriceId}
        onClose={() => setEditPriceId(null)}
        onConfirm={handleConfirmPriceUpdate}
        title="Изменить цену"
        description="Введите фактическую стоимость услуги для точного учета кассы."
      >
        <div className="mt-2">
          <input 
             type="number" 
             value={editPriceValue}
             onChange={(e) => setEditPriceValue(e.target.value)}
             placeholder="Цена"
             className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-4 text-xl text-white font-mono font-bold focus:border-amber-600 outline-none"
             autoFocus
          />
        </div>
      </Modal>
    </div>
  );
};
