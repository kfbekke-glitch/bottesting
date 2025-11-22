
import React, { useMemo, useState, useEffect } from 'react';
import { Booking, Barber, Service, TimeSlot } from '../types';
import { BARBERS, SERVICES, BLOCK_TYPES } from '../constants';
import { Shield, DollarSign, Users, Calendar, Clock, Trash2, Filter, CheckCircle2, Phone, ChevronLeft, ChevronRight, Edit2, Plus, X, User, Scissors, Coffee, Ban, DoorOpen } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface AdminViewProps {
  bookings: Booking[];
  onDeleteBooking: (id: string) => void;
  onUpdatePrice: (id: string, newPrice: number) => void;
  onCreateBooking: (booking: Omit<Booking, 'id' | 'status' | 'createdAt'>) => Promise<void> | void;
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

const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const addMinutesToTime = (time: string, minutesToAdd: number) => {
  const totalMinutes = timeToMinutes(time) + minutesToAdd;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
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

export const AdminView: React.FC<AdminViewProps> = ({ bookings, onDeleteBooking, onUpdatePrice, onCreateBooking }) => {
  const [filterBarberId, setFilterBarberId] = useState<string | null>(null);
  // Default to today's date in YYYY-MM-DD format
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Price Edit State
  const [editPriceId, setEditPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');

  // Create Booking State
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'client' | 'block'>('client'); // Toggle between client booking and tech block
  const [createBarber, setCreateBarber] = useState<Barber | null>(null);
  const [createService, setCreateService] = useState<Service | null>(null);
  const [createBlockType, setCreateBlockType] = useState<keyof typeof BLOCK_TYPES | null>(null);
  const [createTime, setCreateTime] = useState<string>('');
  const [createName, setCreateName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [isCreating, setIsCreating] = useState(false);

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
    // Filter out system blocks for financial stats
    const clientBookings = dateFilteredBookings.filter(b => !b.serviceId.startsWith('block_'));
    
    const totalPlan = clientBookings.reduce((sum, b) => sum + (b.price || 0), 0);
    const totalCount = clientBookings.length;

    const earned = clientBookings.reduce((sum, b) => {
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
    if (booking.serviceId.startsWith('block_')) return; // Prevent editing price for blocks
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

  // --- Creator Logic ---
  
  const availableSlots = useMemo(() => {
    if (!createBarber || !selectedDate) return [];
    
    const slots: TimeSlot[] = [];
    const startHour = 10;
    const endHour = 21;
    const allIntervals: { time: string; isBlocked: boolean }[] = [];

    // 1. Generate 30 min intervals
    for (let h = startHour; h < endHour; h++) {
      ['00', '30'].forEach(m => {
        allIntervals.push({ time: `${h.toString().padStart(2,'0')}:${m}`, isBlocked: false });
      });
    }

    // 2. Mark occupied
    const occupiedTimes = new Set<string>();
    // Filter bookings for selected date and barber
    const relevantBookings = bookings.filter(b => 
      b.status === 'confirmed' && 
      String(b.barberId) === String(createBarber.id) &&
      b.date === selectedDate
    );

    relevantBookings.forEach(b => {
      const duration = b.duration || 45;
      const slotsNeeded = duration <= 35 ? 1 : duration <= 65 ? 2 : duration <= 95 ? 3 : Math.ceil(duration/30);
      let t = cleanTime(b.timeSlot);
      for(let i=0; i<slotsNeeded; i++) {
        occupiedTimes.add(t);
        t = addMinutesToTime(t, 30);
      }
    });

    allIntervals.forEach(int => {
      if (occupiedTimes.has(int.time)) int.isBlocked = true;
    });

    // 3. Determine if a service fits (based on mode)
    let slotsNeededForNew = 1;
    
    if (createMode === 'client' && createService) {
       const offer = createBarber.services.find(s => s.serviceId === createService.id);
       const dur = offer ? offer.durationMinutes : 45;
       slotsNeededForNew = Math.ceil(dur/30);
    } else if (createMode === 'block' && createBlockType) {
       const blockDur = BLOCK_TYPES[createBlockType].duration;
       if (createBlockType === 'EARLY') {
         // For early finish, validation is tricky, we just show available start slots
         slotsNeededForNew = 1; 
       } else {
         slotsNeededForNew = Math.ceil(blockDur/30);
       }
    }

    for (let i = 0; i < allIntervals.length; i++) {
      const startSlot = allIntervals[i];
      if (startSlot.isBlocked) {
        slots.push({ id: startSlot.time, time: startSlot.time, available: false });
        continue;
      }
      // Check if next N slots are free
      let canFit = true;
      // If Early finish, we don't strictly check all future slots here, but usually it means "From here to end"
      if (createMode === 'block' && createBlockType === 'EARLY') {
         canFit = true; // Can technically start anytime that is free
      } else {
        for (let j = 1; j < slotsNeededForNew; j++) {
           const nextIndex = i + j;
           if (nextIndex >= allIntervals.length || allIntervals[nextIndex].isBlocked) {
             canFit = false;
             break;
           }
        }
      }
      slots.push({ id: startSlot.time, time: startSlot.time, available: canFit });
    }

    return slots;
  }, [createBarber, createService, createMode, createBlockType, selectedDate, bookings]);

  const openCreator = () => {
    if (filterBarberId) {
      const b = BARBERS.find(b => b.id === filterBarberId);
      setCreateBarber(b || null);
    } else {
      setCreateBarber(null);
    }
    setCreateMode('client');
    setCreateService(null);
    setCreateBlockType(null);
    setCreateTime('');
    setCreateName('');
    setCreatePhone('');
    setIsCreatorOpen(true);
  };

  const handleSubmitBooking = async () => {
    if (!createBarber || !createTime) return;
    
    setIsCreating(true);
    let payload;

    if (createMode === 'client') {
      if (!createService || !createName) { setIsCreating(false); return; }
      const offer = createBarber.services.find(s => s.serviceId === createService.id);
      const price = offer ? offer.price : 0;
      const duration = offer ? offer.durationMinutes : 45;

      payload = {
        barberId: createBarber.id,
        serviceId: createService.id,
        date: selectedDate,
        timeSlot: createTime,
        clientName: createName,
        clientPhone: createPhone,
        price,
        duration
      };
    } else {
      // BLOCK MODE
      if (!createBlockType) { setIsCreating(false); return; }
      const blockDef = BLOCK_TYPES[createBlockType];
      
      let duration = blockDef.duration;
      let time = createTime;

      // Special logic for specific blocks
      if (createBlockType === 'EARLY') {
         const startMins = timeToMinutes(createTime);
         const endMins = timeToMinutes("21:00");
         duration = Math.max(30, endMins - startMins);
      } else if (createBlockType === 'DAY_OFF') {
         time = "10:00"; // Force day off to start at open
         duration = 660; // 11 hours
      }

      payload = {
        barberId: createBarber.id,
        serviceId: blockDef.id,
        date: selectedDate,
        timeSlot: time,
        clientName: blockDef.name, // Using Name field to show label
        clientPhone: '',
        price: 0,
        duration
      };
    }

    await onCreateBooking(payload);
    setIsCreating(false);
    setIsCreatorOpen(false);
  };

  return (
    <div className="px-4 py-6 space-y-6 pb-24 relative">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="bg-amber-600 p-2 rounded-lg text-black">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase text-white leading-none">Админ Панель</h1>
            <p className="text-xs text-zinc-500 font-mono uppercase">Режим Бога</p>
          </div>
        </div>
        <button 
          onClick={openCreator}
          className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          <Plus size={24} strokeWidth={3} />
        </button>
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
              const isBlock = booking.serviceId.startsWith('block_');
              
              return (
                <div 
                  key={booking.id} 
                  className={`
                    rounded-xl p-4 border relative transition-all overflow-hidden
                    ${isBlock 
                       ? 'bg-zinc-900/40 border-zinc-800/60 border-dashed' 
                       : isDone ? 'bg-zinc-900 border-zinc-800 opacity-70' : 'bg-zinc-900 border-zinc-700 shadow-lg shadow-black/20'}
                  `}
                >
                  {isBlock && (
                     <div className="absolute -right-4 -top-4 text-zinc-800 rotate-12 opacity-20 pointer-events-none">
                        <Ban size={100} />
                     </div>
                  )}

                  <div className="flex justify-between items-start mb-3 relative z-10">
                    <div>
                      <div className={`font-black text-sm flex items-center gap-2 ${isBlock ? 'text-zinc-400 uppercase tracking-widest' : 'text-white'}`}>
                        {booking.clientName}
                        {!isBlock && isDone && <CheckCircle2 size={14} className="text-green-600" />}
                      </div>
                      {!isBlock && (
                        <a href={`tel:${booking.clientPhone}`} className="flex items-center gap-1 text-zinc-400 text-xs mt-1 hover:text-amber-500">
                          <Phone size={10} /> {booking.clientPhone || 'Нет телефона'}
                        </a>
                      )}
                      {isBlock && <span className="text-[10px] text-zinc-600 uppercase font-bold">Блокировка времени</span>}
                    </div>
                    <div className="text-right">
                      {!isBlock ? (
                        <>
                          <button 
                            onClick={() => handleEditPriceClick(booking)}
                            className={`font-mono font-bold flex items-center gap-1 active:scale-95 transition-transform hover:bg-zinc-800 px-1 rounded ${isDone ? 'text-green-600' : 'text-amber-600'}`}
                          >
                            {booking.price}₽ <Edit2 size={10} className="opacity-50" />
                          </button>
                          <div className="text-zinc-600 text-[10px] uppercase mt-1">{isDone ? 'Выполнено' : 'Ожидание'}</div>
                        </>
                      ) : (
                        <div className="bg-zinc-800 px-2 py-1 rounded text-[10px] font-bold text-zinc-500 uppercase">
                          Тех. слот
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3 relative z-10">
                     <div className="bg-zinc-950 rounded-lg p-2 flex items-center gap-2 text-xs text-zinc-400 border border-zinc-800/50">
                       <Calendar size={12} /> {booking.date}
                     </div>
                     <div className="bg-zinc-950 rounded-lg p-2 flex items-center gap-2 text-xs text-zinc-400 border border-zinc-800/50">
                       <Clock size={12} /> 
                       {isBlock && booking.serviceId === 'block_day_off' ? 'Весь день' : cleanTime(booking.timeSlot)}
                     </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-zinc-800/50 pt-3 mt-1 relative z-10">
                     <div className="flex flex-col">
                         <span className={`text-xs font-bold ${filterBarberId ? 'text-amber-500' : 'text-zinc-300'}`}>
                            {getBarberName(booking.barberId)}
                         </span>
                         {!isBlock && <span className="text-[10px] text-zinc-500 truncate max-w-[150px]">{getServiceName(booking.serviceId)}</span>}
                     </div>

                     <button 
                        onClick={() => setDeleteId(booking.id)}
                        className="flex items-center gap-1 px-3 py-2 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-bold uppercase hover:bg-red-500/20 transition-colors border border-red-500/20"
                     >
                        <Trash2 size={14} />
                        {isBlock ? 'Разблок' : 'Удалить'}
                     </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CREATE BOOKING MODAL */}
      {isCreatorOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsCreatorOpen(false)} />
           <div className="bg-zinc-950 w-full max-w-md rounded-t-2xl sm:rounded-xl relative z-10 flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900 rounded-t-2xl">
                <h3 className="text-lg font-black uppercase text-white">Создать запись</h3>
                <button onClick={() => setIsCreatorOpen(false)} className="text-zinc-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              {/* TABS */}
              <div className="grid grid-cols-2 p-1 bg-zinc-900 border-b border-zinc-800">
                 <button 
                   onClick={() => { setCreateMode('client'); setCreateBlockType(null); setCreateTime(''); }}
                   className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${createMode === 'client' ? 'border-amber-600 text-white' : 'border-transparent text-zinc-500'}`}
                 >
                   Клиент
                 </button>
                 <button 
                   onClick={() => { setCreateMode('block'); setCreateService(null); setCreateTime(''); }}
                   className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${createMode === 'block' ? 'border-red-500 text-white' : 'border-transparent text-zinc-500'}`}
                 >
                   Блокировка
                 </button>
              </div>
              
              <div className="overflow-y-auto p-4 space-y-6 pb-20">
                {/* 1. Select Barber */}
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-2 flex items-center gap-2"><User size={12}/> Мастер</label>
                  <div className="grid grid-cols-3 gap-2">
                    {BARBERS.map(barber => (
                      <button
                        key={barber.id}
                        onClick={() => { setCreateBarber(barber); setCreateTime(''); }}
                        className={`
                          p-2 rounded-lg border text-xs font-bold uppercase transition-colors text-center
                          ${createBarber?.id === barber.id 
                            ? 'bg-white text-black border-white' 
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'}
                        `}
                      >
                        {barber.name.split('"')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Select Service OR Block Type */}
                {createBarber && (
                  <div>
                     <label className="text-xs font-bold text-zinc-500 uppercase mb-2 flex items-center gap-2">
                       {createMode === 'client' ? <Scissors size={12}/> : <Ban size={12} />} 
                       {createMode === 'client' ? 'Услуга' : 'Причина блокировки'}
                     </label>
                     
                     {createMode === 'client' ? (
                       <div className="grid grid-cols-1 gap-2">
                          {createBarber.services.map(offer => {
                             const details = SERVICES.find(s => s.id === offer.serviceId);
                             if (!details) return null;
                             return (
                               <button
                                 key={offer.serviceId}
                                 onClick={() => { setCreateService(details); setCreateTime(''); }}
                                 className={`
                                   p-3 rounded-lg border text-left transition-colors flex justify-between items-center
                                   ${createService?.id === details.id 
                                     ? 'bg-zinc-800 border-amber-600 text-white' 
                                     : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'}
                                 `}
                               >
                                 <span className="text-xs font-bold uppercase">{details.name}</span>
                                 <span className="text-xs font-mono">{offer.price}₽</span>
                               </button>
                             )
                          })}
                       </div>
                     ) : (
                       <div className="grid grid-cols-2 gap-2">
                          <button
                             onClick={() => { setCreateBlockType('LUNCH'); setCreateTime(''); }}
                             className={`p-4 rounded-lg border flex flex-col items-center gap-2 ${createBlockType === 'LUNCH' ? 'bg-zinc-800 border-red-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                          >
                             <Coffee size={20} />
                             <span className="text-xs font-bold uppercase">Обед (1ч)</span>
                          </button>
                          <button
                             onClick={() => { setCreateBlockType('EARLY'); setCreateTime(''); }}
                             className={`p-4 rounded-lg border flex flex-col items-center gap-2 ${createBlockType === 'EARLY' ? 'bg-zinc-800 border-red-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                          >
                             <DoorOpen size={20} />
                             <span className="text-xs font-bold uppercase">Уйти раньше</span>
                          </button>
                          <button
                             onClick={() => { setCreateBlockType('DAY_OFF'); setCreateTime('10:00'); }}
                             className={`p-4 rounded-lg border col-span-2 flex flex-col items-center gap-2 ${createBlockType === 'DAY_OFF' ? 'bg-zinc-800 border-red-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
                          >
                             <Ban size={20} />
                             <span className="text-xs font-bold uppercase">Выходной (Весь день)</span>
                          </button>
                       </div>
                     )}
                  </div>
                )}

                {/* 3. Select Time */}
                {createBarber && (createService || createBlockType) && createBlockType !== 'DAY_OFF' && (
                   <div>
                     <label className="text-xs font-bold text-zinc-500 uppercase mb-2 flex items-center gap-2"><Clock size={12}/> Время ({selectedDate})</label>
                     <div className="grid grid-cols-5 gap-2">
                        {availableSlots.map(slot => (
                           <button
                             key={slot.id}
                             disabled={!slot.available}
                             onClick={() => setCreateTime(slot.time)}
                             className={`
                               py-2 rounded border text-xs font-mono font-bold transition-all
                               ${!slot.available
                                 ? 'bg-zinc-900/50 text-zinc-700 border-transparent cursor-not-allowed'
                                 : createTime === slot.time
                                   ? 'bg-amber-600 text-black border-amber-600'
                                   : 'bg-zinc-800 text-white border-zinc-700 hover:border-white'}
                             `}
                           >
                             {slot.time}
                           </button>
                        ))}
                     </div>
                     {availableSlots.length === 0 && <p className="text-xs text-red-500 mt-2">Нет мест</p>}
                   </div>
                )}

                {/* 4. Client Info (Only if Client Mode) */}
                {createMode === 'client' && createBarber && createService && createTime && (
                  <div className="space-y-3 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                     <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Имя Клиента</label>
                        <input 
                          value={createName}
                          onChange={(e) => setCreateName(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white text-sm outline-none focus:border-amber-600"
                          placeholder="Иван"
                        />
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Телефон</label>
                        <input 
                          value={createPhone}
                          onChange={(e) => setCreatePhone(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white text-sm outline-none focus:border-amber-600"
                          placeholder="+7..."
                        />
                     </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-zinc-800 bg-zinc-950">
                 <Button 
                   fullWidth 
                   onClick={handleSubmitBooking}
                   disabled={!createBarber || (!createService && !createBlockType) || (!createTime && createBlockType !== 'DAY_OFF') || (createMode === 'client' && !createName) || isCreating}
                 >
                   {isCreating ? 'Обработка...' : createMode === 'client' ? 'Создать запись' : 'Установить блокировку'}
                 </Button>
              </div>
           </div>
        </div>
      )}
      
      <Modal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Удаление"
        description="Вы собираетесь удалить эту запись или блокировку. Время станет доступным для записи."
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
