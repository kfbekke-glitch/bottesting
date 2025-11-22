
import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { BookingWizard } from './components/BookingWizard';
import { MyBookings } from './components/MyBookings';
import { AppView, Booking } from './types';
import { AnimatePresence, motion } from 'framer-motion';
import { initTelegramApp, getTelegramUser } from './utils/telegram';
import { BARBERS } from './constants';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby5ek0lwgnxsC8Bc0TJ6DWhCvQK9-Lr6sSAGF0Z0IEASWCp09R2N3eCE2yZiY6l17_B/exec';

// Robust date parser that forces correct day regardless of timezone
const normalizeDate = (raw: any): string => {
  if (!raw) return '';
  const s = String(raw);
  // If it looks like ISO with T21:00 (common Google Sheets offset for previous day)
  // We want to treat the date part as the source of truth if possible, 
  // BUT if it's 21:00Z it usually means the Next Day in Moscow.
  // However, simpler approach: The app now sends YYYY-MM-DD. 
  // If we receive YYYY-MM-DD, just use it.
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s;
  
  // Fallback for legacy ISO strings: try to adjust for Moscow (UTC+3)
  try {
    const d = new Date(s);
    // If invalid date, return original string
    if (isNaN(d.getTime())) return s;
    
    // Add 3 hours to handle the T21:00:00.000Z issue (which is 00:00 MSK)
    // This ensures Nov 22 21:00Z becomes Nov 23 00:00Z
    const offsetDate = new Date(d.getTime() + (3 * 60 * 60 * 1000));
    return offsetDate.toISOString().split('T')[0];
  } catch(e) {
    return s;
  }
};

// Helper to clean up time strings from Google Sheets
const normalizeTimeSlot = (raw: any): string => {
  if (!raw) return '';
  const s = String(raw);
  
  if (s.includes('T')) {
    const match = s.match(/T(\d{2}):(\d{2})/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        // Force UTC get to avoid browser shift if possible, or just use local
        const h = d.getUTCHours().toString().padStart(2, '0');
        const m = d.getUTCMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
      }
    } catch (e) {}
  }
  
  if (s.includes(':')) {
    return s.substring(0, 5);
  }
  
  return s;
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  
  const [preSelectedBarberId, setPreSelectedBarberId] = useState<string | undefined>(undefined);
  const [preSelectedServiceId, setPreSelectedServiceId] = useState<string | undefined>(undefined);
  
  const [localBookings, setLocalBookings] = useState<Booking[]>([]);
  const [serverBookings, setServerBookings] = useState<Booking[]>([]);
  const [authenticatedUserBookings, setAuthenticatedUserBookings] = useState<Booking[]>([]);

  useEffect(() => {
    initTelegramApp();
    try {
      const saved = localStorage.getItem('barber_bookings');
      if (saved) {
        setLocalBookings(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Could not load bookings from storage");
    }
  }, []);

  const saveLocalBookings = (newBookings: Booking[]) => {
    setLocalBookings(newBookings);
    try {
      localStorage.setItem('barber_bookings', JSON.stringify(newBookings));
    } catch (e) {
      console.warn("Could not save bookings to storage");
    }
  };

  const getFallbackDuration = (barberId: string, serviceId: string): number => {
     const barber = BARBERS.find(b => String(b.id) === String(barberId));
     if (!barber) return 45;
     const service = barber.services.find(s => String(s.serviceId) === String(serviceId));
     return service ? service.durationMinutes : 45;
  };

  const fetchServerBookings = useCallback(async () => {
      try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?t=${Date.now()}`, {
          method: 'GET',
          redirect: 'follow'
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        if (Array.isArray(data)) {
          const normalizedServerBookings: Booking[] = data.map((item: any) => {
            const bId = item.barberId ? String(item.barberId) : 'unknown';
            const sId = item.serviceId || 'unknown';
            const cleanTime = normalizeTimeSlot(item.timeSlot);
            const cleanDate = normalizeDate(item.date);
            const duration = item.duration || getFallbackDuration(bId, sId);

            return {
              id: item.id ? String(item.id) : `server_${Math.random()}`, // Ensure ID is string
              barberId: bId,
              serviceId: sId,
              date: cleanDate,
              timeSlot: cleanTime,
              clientName: item.clientName || 'Occupied',
              clientPhone: '',
              price: item.price || 0,
              duration: duration, 
              status: 'confirmed',
              createdAt: item.createdAt || 0,
              tgUserId: item.tgUserId ? String(item.tgUserId) : undefined
            };
          });
          setServerBookings(normalizedServerBookings);

          const tgUser = getTelegramUser();
          
          if (tgUser && tgUser.id) {
            const currentTgId = String(tgUser.id);
            const myServerBookings = normalizedServerBookings.filter(b => 
              b.tgUserId === currentTgId
            );
            setAuthenticatedUserBookings(myServerBookings);
          } else {
            setAuthenticatedUserBookings(localBookings.filter(b => b.status === 'confirmed'));
          }

          // Sync cancellation status from server to local
          if (localBookings.length > 0) {
            let hasChanges = false;
            const serverBookingIds = new Set(normalizedServerBookings.map(b => String(b.id)));
            
            const updatedLocalBookings = localBookings.map(localBooking => {
              const isJustCreated = (Date.now() - localBooking.createdAt) < 15000;

              // If local says confirmed, but server doesn't have it (and it wasn't just created), mark cancelled
              if (localBooking.status === 'confirmed' && !serverBookingIds.has(String(localBooking.id)) && !isJustCreated) {
                hasChanges = true;
                return { ...localBooking, status: 'cancelled' as const };
              }
              return localBooking;
            });

            if (hasChanges) {
              saveLocalBookings(updatedLocalBookings);
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch server bookings:", e);
        setAuthenticatedUserBookings(localBookings.filter(b => b.status === 'confirmed'));
      }
  }, [localBookings]); 

  useEffect(() => {
    fetchServerBookings();
    const intervalId = setInterval(() => {
      fetchServerBookings();
    }, 4000); 
    return () => clearInterval(intervalId);
  }, [fetchServerBookings]);


  const handleBookingComplete = async (bookingData: Omit<Booking, 'id' | 'status' | 'createdAt'>) => {
    const tgUser = getTelegramUser();

    // NOTE: bookingData.date is now passed as YYYY-MM-DD string from BookingWizard
    const newBooking: Booking = {
      ...bookingData,
      id: Math.random().toString(36).substr(2, 9),
      status: 'confirmed',
      createdAt: Date.now(),
      tgUserId: tgUser?.id ? String(tgUser.id) : undefined,
      tgUsername: tgUser?.username
    };

    const updatedLocal = [...localBookings, newBooking];
    saveLocalBookings(updatedLocal);
    
    setAuthenticatedUserBookings(prev => [...prev, newBooking]);
    setServerBookings(prev => [...prev, newBooking]);

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(newBooking),
      });
      setTimeout(fetchServerBookings, 1000);
    } catch (e) {
      console.error("Failed to sync booking with server", e);
    }

    setIsBookingOpen(false);
    setPreSelectedBarberId(undefined);
    setPreSelectedServiceId(undefined);
    setCurrentView(AppView.MY_BOOKINGS);
  };

  const handleCancelBooking = async (id: string) => {
    const targetId = String(id); // Ensure strict string comparison

    // 1. Local Update
    const updated = localBookings.map(b => 
      String(b.id) === targetId ? { ...b, status: 'cancelled' as const } : b
    );
    saveLocalBookings(updated);
    
    setAuthenticatedUserBookings(prev => prev.map(b => 
      String(b.id) === targetId ? { ...b, status: 'cancelled' as const } : b
    ));

    // 2. Server Update
    try {
      // Find full booking object to send correct cancellation payload
      let bookingToCancel = localBookings.find(b => String(b.id) === targetId);
      if (!bookingToCancel) {
         bookingToCancel = serverBookings.find(b => String(b.id) === targetId);
      }
      
      if (bookingToCancel) {
         await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ 
            ...bookingToCancel,
            status: 'cancelled' 
          })
        });
        setTimeout(fetchServerBookings, 1000);
      } else {
        console.error("Could not find booking to cancel in any list");
      }
    } catch (e) {
      console.error("Failed to sync cancellation", e);
    }
  };

  const handleStartBooking = (barberId?: string, serviceId?: string) => {
    fetchServerBookings(); 
    setPreSelectedBarberId(barberId);
    setPreSelectedServiceId(serviceId);
    setIsBookingOpen(true);
  };

  const handleCloseBooking = () => {
    setIsBookingOpen(false);
    setPreSelectedBarberId(undefined);
    setPreSelectedServiceId(undefined);
  };
  
  const allOccupiedBookings = [...serverBookings];
  localBookings.forEach(localB => {
    // Add local booking if it's confirmed and not already in server list
    if (localB.status === 'confirmed' && !allOccupiedBookings.some(serverB => String(serverB.id) === String(localB.id))) {
      allOccupiedBookings.push(localB);
    }
  });

  return (
    <div className="bg-zinc-950 text-zinc-100 font-sans h-[100dvh] max-w-md mx-auto relative overflow-hidden shadow-2xl flex flex-col">
      <Header />
      <main className="flex-1 relative overflow-hidden w-full">
        <AnimatePresence initial={false}>
          {currentView === AppView.HOME && (
             <motion.div 
               key="home"
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               transition={{ duration: 0.2 }}
               className="absolute inset-0 overflow-y-auto no-scrollbar w-full h-full"
             >
               <HomeView onStartBooking={handleStartBooking} />
             </motion.div>
          )}

          {currentView === AppView.MY_BOOKINGS && (
            <motion.div 
              key="bookings"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto no-scrollbar w-full h-full"
            >
              <MyBookings bookings={authenticatedUserBookings} onCancelBooking={handleCancelBooking} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav currentView={currentView} onNavigate={setCurrentView} />
      <AnimatePresence>
        {isBookingOpen && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-50 h-full w-full"
          >
            <BookingWizard 
              bookings={allOccupiedBookings} 
              userBookings={authenticatedUserBookings} 
              onComplete={handleBookingComplete} 
              onCancel={handleCloseBooking} 
              initialBarberId={preSelectedBarberId}
              initialServiceId={preSelectedServiceId}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
