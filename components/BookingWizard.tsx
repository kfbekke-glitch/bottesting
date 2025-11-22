
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Calendar as CalendarIcon, User, Scissors, Clock, Sun, Moon, PhoneCall, X } from 'lucide-react';
import { BARBERS, SERVICES } from '../constants';
import { Barber, Service, Booking, TimeSlot, BarberServiceOffer } from '../types';
import { getTelegramUser, triggerHaptic } from '../utils/telegram';

interface BookingWizardProps {
  bookings: Booking[]; // All occupied slots (local + server)
  userBookings: Booking[]; // Current user's specific bookings
  onComplete: (booking: Omit<Booking, 'id' | 'status' | 'createdAt'>) => Promise<void> | void;
  onCancel: () => void;
  initialBarberId?: string;
  initialServiceId?: string;
}

// Helper to get current Moscow Time parts safely
const getMskTimeParts = () => {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => {
      const val = parts.find(p => p.type === type)?.value;
      return val ? parseInt(val, 10) : NaN;
    };
    
    const year = getPart('year');
    const month = getPart('month') - 1; // JS months are 0-indexed
    const day = getPart('day');
    const hour = getPart('hour');
    const minute = getPart('minute');

    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
       return {
         year: now.getFullYear(),
         month: now.getMonth(),
         day: now.getDate(),
         hour: now.getHours(),
         minute: now.getMinutes()
       };
    }

    return { year, month, day, hour, minute };
  } catch (e) {
    // Absolute Fallback
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes()
    };
  }
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

const PROMO_SERVICE_ID = 's5';
const PROMO_DISCOUNT = 0.85;

// SIMPLIFIED AND ROBUST DATE KEY
const getDateKey = (date: Date | string): string => {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return '';
  }
};


export const BookingWizard: React.FC<BookingWizardProps> = ({ bookings, userBookings, onComplete, onCancel, initialBarberId, initialServiceId }) => {
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(() => {
    if (initialBarberId) {
      return BARBERS.find(b => b.id === initialBarberId) || null;
    }
    return null;
  });

  const [step, setStep] = useState<number>(initialBarberId ? 2 : 1);
  const [selectedServiceOffer, setSelectedServiceOffer] = useState<BarberServiceOffer | null>(null);
  const [selectedServiceDetails, setSelectedServiceDetails] = useState<Service | null>(null);
  const [mskTime, setMskTime] = useState(() => getMskTimeParts());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Telegram User Data
  const tgUser = getTelegramUser();

  // Form State
  const [name, setName] = useState(tgUser?.first_name || '');
  const [phone, setPhone] = useState('');

  // Effect to update name if Telegram data loads late
  useEffect(() => {
    if (!name && tgUser?.first_name) {
      setName(tgUser.first_name);
    }
  }, [tgUser]);

  const dates = useMemo(() => {
    const { year, month, day } = getMskTimeParts(); 
    const dateList = [];
    
    const safeYear = isNaN(year) ? new Date().getFullYear() : year;
    const safeMonth = isNaN(month) ? new Date().getMonth() : month;
    const safeDay = isNaN(day) ? new Date().getDate() : day;

    const baseDate = new Date(safeYear, safeMonth, safeDay);
    const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;
    
    for (let i = 0; i < 15; i++) {
      const d = new Date(validBase);
      d.setDate(validBase.getDate() + i);
      dateList.push(d);
    }
    return dateList;
  }, []);

  const [selectedDate, setSelectedDate] = useState<Date>(() => dates[0] || new Date());
  const [selectedTime, setSelectedTime] = useState<TimeSlot | null>(null);
  
  const dateScrollRef = useRef<HTMLDivElement>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const dragDist = useRef(0);

  const availableBarbers = useMemo(() => {
    let list = BARBERS;
    if (initialServiceId) {
      list = BARBERS.filter(b => b.services.some(s => s.serviceId === initialServiceId));
    }
    return [...list].sort((a, b) => b.rating - a.rating);
  }, [initialServiceId]);

  const preSelectedServiceName = useMemo(() => {
    if (!initialServiceId) return '';
    return SERVICES.find(s => s.id === initialServiceId)?.name || '';
  }, [initialServiceId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMskTime(getMskTimeParts());
    }, 30000); 
    return () => clearInterval(timer);
  }, []);

  const isWorkingDay = useMemo(() => {
    if (!selectedBarber || isNaN(selectedDate.getTime())) return true;
    return selectedBarber.workDays.includes(selectedDate.getDay());
  }, [selectedBarber, selectedDate]);
  
  const hasExistingBookingOnDate = useMemo(() => {
    if (isNaN(selectedDate.getTime())) return false;
    const selectedKey = getDateKey(selectedDate);
    
    return userBookings.some(b => {
      if (b.status !== 'confirmed') return false;
      return getDateKey(b.date) === selectedKey;
    });
  }, [userBookings, selectedDate]);

  const timeSlots = useMemo(() => {
    const slots: TimeSlot[] = [];
    if (isNaN(selectedDate.getTime()) || !selectedBarber) return slots;
    
    if (!selectedBarber.workDays.includes(selectedDate.getDay())) {
      return slots;
    }

    // Logic to calculate how many slots the SELECTED service needs
    let slotsNeeded = 1;
    if (selectedServiceOffer) {
      const d = selectedServiceOffer.durationMinutes;
      if (d <= 35) slotsNeeded = 1;
      else if (d <= 65) slotsNeeded = 2;
      else if (d <= 95) slotsNeeded = 3;
      else slotsNeeded = Math.ceil(d / 30);
    }

    const startHour = 10;
    const endHour = 21; 
    const allDayIntervals: { time: string; isBlocked: boolean }[] = [];

    // STRICT string generation: HH:MM with zero padding
    for (let h = startHour; h < endHour; h++) {
      ['00', '30'].forEach(m => {
        const hStr = h.toString().padStart(2, '0');
        allDayIntervals.push({ time: `${hStr}:${m}`, isBlocked: false });
      });
    }

    const selectedKey = getDateKey(selectedDate);
    const todayKey = getDateKey(new Date(mskTime.year, mskTime.month, mskTime.day));
    const isToday = selectedKey === todayKey;
    const currentMskMinutes = mskTime.hour * 60 + mskTime.minute;

    const occupiedTimes = new Set<string>();

    // 1. FILTER Bookings for THIS BARBER ONLY
    const dayBookings = bookings.filter(b => {
      if (b.status !== 'confirmed') return false;
      if (String(b.barberId) !== String(selectedBarber.id)) return false;
      return getDateKey(b.date) === selectedKey;
    });

    // 2. BLOCK slots based on existing booking durations
    dayBookings.forEach(booking => {
      const duration = booking.duration || 45; 
      let bookingSlotsCount = 1;
      
      if (duration <= 35) bookingSlotsCount = 1;
      else if (duration <= 65) bookingSlotsCount = 2;
      else if (duration <= 95) bookingSlotsCount = 3;
      else bookingSlotsCount = Math.ceil(duration / 30);

      // Normalize check time to ensure format match (e.g. 9:00 -> 09:00)
      // IMPORTANT: Ensure parsing handles "1899" date string if it still sneaks in, though App.tsx should catch it.
      let timeStr = booking.timeSlot;
      if (timeStr.includes('T')) {
          const match = timeStr.match(/T(\d{2}):(\d{2})/);
          if (match) timeStr = `${match[1]}:${match[2]}`;
      }

      const [bh, bm] = timeStr.split(':').map(Number);
      if (!isNaN(bh) && !isNaN(bm)) {
         let checkTime = `${bh.toString().padStart(2, '0')}:${bm.toString().padStart(2, '0')}`;
         for (let i = 0; i < bookingSlotsCount; i++) {
           occupiedTimes.add(checkTime);
           checkTime = addMinutesToTime(checkTime, 30);
         }
      }
    });

    // 3. Mark intervals as blocked
    allDayIntervals.forEach(interval => {
      const intervalMins = timeToMinutes(interval.time);
      
      // Block past times if today
      if (isToday && intervalMins <= currentMskMinutes) {
        interval.isBlocked = true;
      }
      // Block occupied times
      if (occupiedTimes.has(interval.time)) {
        interval.isBlocked = true;
      }
    });

    // 4. Generate final selectable slots (checking if selected service FITS)
    for (let i = 0; i < allDayIntervals.length; i++) {
      const startSlot = allDayIntervals[i];
      
      if (startSlot.isBlocked) {
        slots.push({
          id: `t-${selectedKey}-${startSlot.time}`,
          time: startSlot.time,
          available: false
        });
        continue;
      }

      // Check if subsequent slots needed for duration are also free
      let canFit = true;
      for (let j = 1; j < slotsNeeded; j++) {
        const nextIndex = i + j;
        if (nextIndex >= allDayIntervals.length) {
          canFit = false; // Exceeds working hours
          break;
        }
        if (allDayIntervals[nextIndex].isBlocked) {
          canFit = false; // Overlaps with another booking
          break;
        }
      }

      slots.push({
        id: `t-${selectedKey}-${startSlot.time}`,
        time: startSlot.time,
        available: canFit
      });
    }

    return slots;
  }, [selectedDate, mskTime, bookings, selectedBarber, selectedServiceOffer]);

  const groupedSlots = useMemo(() => {
    const groups = {
      morning: [] as TimeSlot[], 
      day: [] as TimeSlot[],     
      evening: [] as TimeSlot[]  
    };

    timeSlots.forEach(slot => {
      const [h] = slot.time.split(':').map(Number);
      if (h < 12) groups.morning.push(slot);
      else if (h < 17) groups.day.push(slot);
      else groups.evening.push(slot);
    });

    return groups;
  }, [timeSlots]);

  const formatDate = (date: Date) => {
    if (isNaN(date.getTime())) return '...';
    try {
      return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
    } catch (e) {
      return `${date.getDate()}.${date.getMonth() + 1}`;
    }
  };

  const getDayName = (date: Date) => {
    if (isNaN(date.getTime())) return '';
    const { day, month, year } = mskTime;
    if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
      return 'Сегодня';
    }
    try {
      return new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(date);
    } catch (e) {
      return '';
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length === 0) {
      setPhone('');
      return;
    }
    if (val.startsWith('7') || val.startsWith('8')) {
      val = val.substring(1);
    }
    if (val.length > 10) val = val.substring(0, 10);
    setPhone(val);
  };

  const canProceed = () => {
    if (step === 1) return !!selectedBarber;
    if (step === 2) return !!selectedServiceOffer;
    if (step === 3) return !!selectedDate && !!selectedTime;
    if (step === 4) return name.trim().length > 0 && phone.length === 10;
    return false;
  };

  const handleNext = async () => {
    triggerHaptic('impact', 'light');
    if (step === 4) {
      setIsSubmitting(true);
      triggerHaptic('notification', 'success');
      let finalPrice = selectedServiceOffer!.price;
      if (selectedServiceOffer!.serviceId === PROMO_SERVICE_ID) {
        finalPrice = Math.floor(finalPrice * PROMO_DISCOUNT);
      }

      await onComplete({
        barberId: selectedBarber!.id,
        serviceId: selectedServiceOffer!.serviceId,
        date: selectedDate.toISOString(),
        timeSlot: selectedTime!.time,
        clientName: name,
        clientPhone: `+7${phone}`,
        price: finalPrice,
        duration: selectedServiceOffer!.durationMinutes
      });
      setIsSubmitting(false);
    } else {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    triggerHaptic('impact', 'light');
    if (step > 1) {
      if (step === 2 && initialBarberId) {
        onCancel();
      } 
      else if (step === 3 && initialServiceId) {
        setStep(1);
        setSelectedBarber(null);
        setSelectedServiceOffer(null);
        setSelectedServiceDetails(null);
      }
      else {
        setStep(prev => prev - 1);
      }
    }
    else onCancel();
  };

  const handleBarberSelect = (barber: Barber) => {
    triggerHaptic('selection');
    setSelectedBarber(barber);
    
    if (initialServiceId) {
      const offer = barber.services.find(s => s.serviceId === initialServiceId);
      const details = SERVICES.find(s => s.id === initialServiceId);
      
      if (offer && details) {
        setSelectedServiceOffer(offer);
        setSelectedServiceDetails(details);
        setTimeout(() => setStep(3), 150);
        return;
      }
    }

    setSelectedServiceOffer(null);
    setSelectedServiceDetails(null);
    setTimeout(() => setStep(2), 150);
  }

  const handleServiceSelect = (offer: BarberServiceOffer, details: Service) => {
    triggerHaptic('selection');
    setSelectedServiceOffer(offer);
    setSelectedServiceDetails(details);
    setTimeout(() => setStep(3), 150);
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!dateScrollRef.current) return;
    isDown.current = true;
    startX.current = e.pageX - dateScrollRef.current.offsetLeft;
    scrollLeft.current = dateScrollRef.current.scrollLeft;
    dragDist.current = 0;
  };

  const handleMouseLeave = () => {
    isDown.current = false;
  };

  const handleMouseUp = () => {
    isDown.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown.current || !dateScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - dateScrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    dateScrollRef.current.scrollLeft = scrollLeft.current - walk;
    dragDist.current = Math.abs(walk);
  };

  const handleDateClick = (date: Date, disabled: boolean) => {
    if (disabled) {
      triggerHaptic('notification', 'error');
      return;
    }
    if (dragDist.current < 5) {
      triggerHaptic('selection');
      setSelectedDate(date);
    }
  };

  const handleTimeSelect = (slot: TimeSlot) => {
     triggerHaptic('selection');
     setSelectedTime(slot);
  };

  const getAvailableServices = () => {
    if (!selectedBarber) return [];
    return selectedBarber.services.map((offer) => {
      const details = SERVICES.find((s) => s.id === offer.serviceId);
      if (!details) return null;
      return { offer, details };
    }).filter((item): item is { offer: BarberServiceOffer; details: Service } => item !== null);
  };

  const renderTimeSection = (title: string, icon: React.ReactNode, slots: TimeSlot[]) => {
    if (slots.length === 0) return null;
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 text-zinc-500 px-1">
          {icon}
          <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
          <div className="h-px flex-1 bg-zinc-800/50"></div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {slots.map((slot) => (
            <button
              key={slot.id}
              disabled={!slot.available}
              onClick={() => handleTimeSelect(slot)}
              className={`
                relative py-2 rounded-lg font-mono font-bold text-sm transition-all active:scale-95 overflow-hidden
                ${!slot.available 
                  ? 'bg-red-900/10 text-zinc-700 cursor-not-allowed border border-red-900/20' 
                  : selectedTime?.id === slot.id 
                    ? 'bg-amber-600 text-black shadow-lg shadow-amber-600/40' 
                    : 'bg-zinc-800 text-white hover:bg-zinc-700'}
              `}
            >
              <span className={!slot.available ? 'opacity-20' : ''}>{slot.time}</span>
              {!slot.available && (
                 <div className="absolute inset-0 flex items-center justify-center text-red-800/60">
                    <X size={20} strokeWidth={3} />
                 </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col h-full w-full">
      <div className="px-4 h-14 shrink-0 flex items-center justify-between border-b border-zinc-900 bg-zinc-950">
        <button onClick={handleBack} disabled={isSubmitting} className="p-2 -ml-2 text-zinc-400 hover:text-white disabled:opacity-50">
          <ChevronLeft size={24} />
        </button>
        <div className="text-sm font-bold uppercase tracking-wider text-zinc-500">
          Шаг {step} / 4
        </div>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="min-h-full">
          {step === 1 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="pb-20"
            >
              <h2 className="text-2xl font-black uppercase text-white mb-2">Кто будет стричь?</h2>
              {initialServiceId && (
                 <p className="text-amber-600 font-bold text-xs uppercase mb-6">
                   Мастера для услуги: <span className="text-white">{preSelectedServiceName}</span>
                 </p>
              )}
              {!initialServiceId && <div className="mb-6" />}

              <div className="grid grid-cols-2 gap-4">
                {availableBarbers.map((barber) => (
                  <div 
                    key={barber.id}
                    onClick={() => handleBarberSelect(barber)}
                    className={`
                      relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all active:scale-95 bg-zinc-900
                      ${selectedBarber?.id === barber.id ? 'border-amber-600' : 'border-transparent'}
                    `}
                  >
                    <img src={barber.image} className="w-full h-full object-cover" alt={barber.name} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent flex flex-col justify-end p-3">
                      <span className="font-bold text-white text-sm uppercase leading-none mb-1">{barber.name}</span>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">{barber.tier}</span>
                        <span className="text-[10px] font-bold text-white bg-zinc-800/80 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" className="text-amber-500"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          {barber.rating}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="pb-20"
            >
              <h2 className="text-2xl font-black uppercase text-white mb-2">Что делаем?</h2>
              <p className="text-zinc-500 text-sm mb-6">Услуги мастера: <span className="text-white font-bold">{selectedBarber?.name}</span></p>
              
              <div className="space-y-3">
                {getAvailableServices().map(({ offer, details }) => {
                  const isPromo = offer.serviceId === PROMO_SERVICE_ID;
                  const discountedPrice = isPromo ? Math.floor(offer.price * PROMO_DISCOUNT) : null;

                  return (
                    <div
                      key={offer.serviceId}
                      onClick={() => handleServiceSelect(offer, details)}
                      className={`
                        p-4 rounded-xl border bg-zinc-900 active:scale-[0.98] transition-transform
                        ${selectedServiceOffer?.serviceId === offer.serviceId ? 'border-amber-600' : 'border-zinc-800'}
                      `}
                    >
                      <div className="flex justify-between items-start mb-1">
                         <span className="font-bold text-white uppercase max-w-[65%]">{details.name}</span>
                         <div className="text-right">
                            {isPromo && discountedPrice ? (
                              <div className="flex flex-col items-end">
                                <span className="font-mono text-zinc-500 text-xs line-through decoration-zinc-500">{offer.price}₽</span>
                                <span className="font-mono text-amber-600 text-sm font-bold">{discountedPrice}₽</span>
                              </div>
                            ) : (
                              <span className="font-mono text-amber-600 text-sm font-bold">{offer.price}₽</span>
                            )}
                         </div>
                      </div>
                      <p className="text-xs text-zinc-500">{details.description}</p>
                      <div className="flex justify-between items-end mt-2">
                        <p className="text-xs text-zinc-600 flex items-center gap-1">⏱ {offer.durationMinutes} мин.</p>
                        {isPromo && <span className="text-[10px] font-bold text-amber-600 uppercase bg-amber-600/10 px-2 py-0.5 rounded">Акция</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="pb-20"
            >
              <h2 className="text-2xl font-black uppercase text-white mb-6">Когда удобно?</h2>
              
              <div 
                ref={dateScrollRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className="mb-6 -mx-4 px-4 overflow-x-auto no-scrollbar flex gap-3 cursor-grab active:cursor-grabbing select-none"
              >
                {dates.map((date) => {
                   const isSelected = date.getTime() === selectedDate.getTime();
                   const isWorkDay = selectedBarber ? selectedBarber.workDays.includes(date.getDay()) : true;

                   return (
                     <button
                       key={date.getTime()}
                       onClick={() => handleDateClick(date, !isWorkDay)}
                       disabled={!isWorkDay}
                       className={`
                         shrink-0 flex flex-col items-center justify-center min-w-[4.5rem] h-[4.5rem] rounded-xl border-2 transition-all active:scale-95
                         ${!isWorkDay 
                           ? 'bg-zinc-950 border-zinc-900 text-zinc-700 opacity-50 cursor-not-allowed' 
                           : isSelected 
                             ? 'bg-amber-600 border-amber-600 text-black' 
                             : 'bg-zinc-900 border-zinc-800 text-zinc-400'}
                       `}
                     >
                       <span className="text-[10px] font-bold uppercase">{getDayName(date)}</span>
                       {isWorkDay ? (
                          <span className="text-xl font-black">{date.getDate()}</span>
                       ) : (
                          <span className="text-xs font-bold mt-1">ВЫХ</span>
                       )}
                     </button>
                   )
                })}
              </div>

              <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4 flex items-center gap-2">
                <CalendarIcon size={14} />
                {formatDate(selectedDate)}
              </h3>

              {!isWorkingDay ? (
                 <div className="mt-8 p-6 bg-zinc-900/30 border border-zinc-800 rounded-xl text-center border-dashed">
                    <p className="text-zinc-400 font-bold uppercase text-sm mb-2">Мастер не работает</p>
                    <p className="text-xs text-zinc-600">Выберите другую дату для записи к {selectedBarber?.name}</p>
                 </div>
              ) : hasExistingBookingOnDate ? (
                <div className="mt-8 p-6 bg-zinc-900/50 border border-amber-600/20 rounded-xl text-center">
                   <p className="text-white font-bold uppercase text-sm mb-2">У вас уже есть запись на {formatDate(selectedDate)}</p>
                   <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
                     Система разрешает одну запись в день. <br/>
                     Хотите добавить еще одну услугу на этот день?
                   </p>
                   <a 
                     href="tel:+79805470406"
                     className="inline-flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-zinc-700 hover:border-amber-600"
                   >
                     <PhoneCall size={16} className="text-amber-600" />
                     Позвонить администратору
                   </a>
                </div>
              ) : (
                <>
                  {renderTimeSection('Утро', <Sun size={16} />, groupedSlots.morning)}
                  {renderTimeSection('День', <Sun size={16} className="text-amber-500" />, groupedSlots.day)}
                  {renderTimeSection('Вечер', <Moon size={16} className="text-blue-400" />, groupedSlots.evening)}

                  {timeSlots.every(s => !s.available) && timeSlots.length > 0 && (
                     <div className="mt-8 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center">
                        <p className="text-zinc-400 text-sm mb-1">На эту дату нет свободного времени.</p>
                        <p className="text-xs text-zinc-600">Пожалуйста, выберите другой день.</p>
                     </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="pb-24"
            >
              <h2 className="text-2xl font-black uppercase text-white mb-6">Ваши данные</h2>
              
              <div className="space-y-6 mb-8">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Имя</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-900 border-none rounded-xl p-4 text-white text-lg focus:ring-2 focus:ring-amber-600 placeholder-zinc-700"
                    placeholder={tgUser ? "Имя из Telegram" : "Иван"}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Телефон</label>
                  <div className="flex items-center bg-zinc-900 rounded-xl overflow-hidden px-4 py-4 focus-within:ring-2 focus-within:ring-amber-600">
                    <span className="text-zinc-400 text-lg font-mono mr-2">+7</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      className="flex-1 bg-transparent border-none p-0 text-white text-lg font-mono focus:ring-0 placeholder-zinc-700 outline-none"
                      placeholder="900 000 00 00"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800">
                <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider flex items-center gap-2 border-b border-zinc-800 pb-2">
                  <span>Детали записи</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-zinc-400">
                       <User size={14} />
                       <span className="text-xs uppercase">Мастер</span>
                    </div>
                    <div className="text-white font-bold text-sm">{selectedBarber?.name}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-zinc-400">
                       <Scissors size={14} />
                       <span className="text-xs uppercase">Услуга</span>
                    </div>
                    <div className="text-white font-bold text-sm text-right max-w-[60%] truncate">{selectedServiceDetails?.name}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-zinc-400">
                       <Clock size={14} />
                       <span className="text-xs uppercase">Время</span>
                    </div>
                    <div className="text-white font-bold text-sm">
                      {formatDate(selectedDate)} <span className="text-zinc-500">|</span> {selectedTime?.time}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-zinc-800/50 mt-2">
                    <span className="text-zinc-500 text-xs uppercase font-bold">Итого</span>
                    <div className="text-amber-600 font-mono font-black text-lg">
                      от {selectedServiceOffer?.serviceId === PROMO_SERVICE_ID 
                        ? Math.floor((selectedServiceOffer?.price || 0) * PROMO_DISCOUNT) 
                        : selectedServiceOffer?.price}₽
                    </div>
                  </div>
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-900 z-20">
                 <button
                   onClick={handleNext}
                   disabled={!canProceed() || isSubmitting}
                   className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-none hover:bg-zinc-200 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                 >
                   {isSubmitting ? (
                     <>
                       <span className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full"/>
                       ОТПРАВКА...
                     </>
                   ) : 'ПОДТВЕРДИТЬ ЗАПИСЬ'}
                 </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {step < 4 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-900 z-20">
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-none hover:bg-zinc-200 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-transform"
          >
            Далее
          </button>
        </div>
      )}
    </div>
  );
};
