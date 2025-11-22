
import React, { useMemo, useState } from 'react';
import { Booking } from '../types';
import { BARBERS, SERVICES } from '../constants';
import { Shield, DollarSign, Users, Calendar, Clock, Trash2, Filter } from 'lucide-react';

interface AdminViewProps {
  bookings: Booking[];
  onDeleteBooking: (id: string) => void;
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

export const AdminView: React.FC<AdminViewProps> = ({ bookings, onDeleteBooking }) => {
  const [filterBarberId, setFilterBarberId] = useState<string | null>(null);

  // 1. Filter bookings based on selection
  const filteredBookings = useMemo(() => {
    if (!filterBarberId) return bookings;
    return bookings.filter(b => String(b.barberId) === String(filterBarberId));
  }, [bookings, filterBarberId]);
  
  // 2. Calculate stats based on FILTERED bookings
  const stats = useMemo(() => {
    const activeBookings = filteredBookings.filter(b => b.status === 'confirmed');
    const totalRevenue = activeBookings.reduce((sum, b) => sum + (b.price || 0), 0);
    
    // Filter for "Today" (rough check)
    const todayStr = new Date().toISOString().split('T')[0];
    const todayBookings = activeBookings.filter(b => b.date.startsWith(todayStr));
    const todayRevenue = todayBookings.reduce((sum, b) => sum + (b.price || 0), 0);

    return {
      totalActive: activeBookings.length,
      totalRevenue,
      todayCount: todayBookings.length,
      todayRevenue
    };
  }, [filteredBookings]);

  const sortedBookings = [...filteredBookings]
    .filter(b => b.status === 'confirmed')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getBarberName = (id: string) => BARBERS.find(b => b.id === id)?.name || id;
  const getServiceName = (id: string) => SERVICES.find(s => s.id === id)?.name || id;

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
          {/* "ALL" Button */}
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

      {/* Stats Grid (Dynamic) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <div className="text-zinc-500 text-[10px] uppercase font-bold mb-1 flex items-center gap-1">
            <DollarSign size={12} /> Выручка {filterBarberId ? '(Мастер)' : '(Всего)'}
          </div>
          <div className="text-2xl font-mono font-bold text-white">{stats.totalRevenue.toLocaleString()}₽</div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <div className="text-zinc-500 text-[10px] uppercase font-bold mb-1 flex items-center gap-1">
            <Users size={12} /> Записей {filterBarberId ? '(Мастер)' : '(Всего)'}
          </div>
          <div className="text-2xl font-mono font-bold text-white">{stats.totalActive}</div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 col-span-2 flex justify-between items-center bg-gradient-to-r from-zinc-900 to-zinc-800">
           <div>
              <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">Сегодня</div>
              <div className="text-xl font-mono font-bold text-amber-500">+{stats.todayRevenue.toLocaleString()}₽</div>
           </div>
           <div className="text-right">
              <div className="text-zinc-400 text-[10px] uppercase font-bold mb-1">Клиентов</div>
              <div className="text-xl font-mono font-bold text-white">{stats.todayCount}</div>
           </div>
        </div>
      </div>

      {/* All Bookings List */}
      <div>
        <h2 className="text-lg font-bold uppercase text-white mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-amber-600" /> 
          {filterBarberId ? 'Записи мастера' : 'Все записи'}
        </h2>
        
        <div className="space-y-3">
          {sortedBookings.length === 0 ? (
            <div className="text-center py-10 border border-zinc-800 border-dashed rounded-xl">
              <p className="text-zinc-500 text-sm">Нет активных записей</p>
            </div>
          ) : (
            sortedBookings.map(booking => (
              <div key={booking.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 relative">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-white font-bold text-sm flex items-center gap-2">
                      {booking.clientName}
                      {booking.tgUsername && <span className="text-blue-400 text-[10px] font-normal">@{booking.tgUsername}</span>}
                    </div>
                    <div className="text-zinc-500 text-xs">{booking.clientPhone || 'Без телефона'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-600 font-mono font-bold">{booking.price}₽</div>
                    <div className="text-zinc-600 text-[10px] uppercase">{booking.status}</div>
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
                      onClick={() => {
                        if(confirm('Вы точно хотите удалить эту запись?')) onDeleteBooking(booking.id);
                      }}
                      className="flex items-center gap-1 px-3 py-2 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-bold uppercase hover:bg-red-500/20 transition-colors border border-red-500/20"
                   >
                      <Trash2 size={14} />
                      Удалить
                   </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
