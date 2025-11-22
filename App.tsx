
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

// Helper to clean up time strings from Google Sheets (handling 1899-12-30T... format)
const normalizeTimeSlot = (raw: any): string => {
  if (!raw) return '';
  const s = String(raw);
  
  // If it comes as a full ISO string (e.g., 1899-12-30T12:00:00.000Z)
  if (s.includes('T')) {
    // Extract the time part (HH:MM)
    const match = s.match(/T(\d{2}):(\d{2})/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
    // Fallback: try parsing as date
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const h = d.getUTCHours().toString().padStart(2, '0');
        const m = d.getUTCMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
      }
    } catch (e) {}
  }
  
  // If it's already "12:00" or "12:00:00", just return the first 5 chars
  if (s.includes(':')) {
    return s.substring(0, 5);
  }
  
  return s;
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  
  // Booking Context State
  const [preSelectedBarberId, setPreSelectedBarberId] = useState<string | undefined>(undefined);
  const [preSelectedServiceId, setPreSelectedServiceId] = useState<string | undefined>(undefined);
  
  // localBookings = Stored in localStorage (fallback/offline for THIS device)
  const [localBookings, setLocalBookings] = useState<Booking[]>([]);
  
  // serverBookings = All occupied slots fetched from Google Sheets (Global Availability)
  const [serverBookings, setServerBookings] = useState<Booking[]>([]);

  // authenticatedUserBookings = Bookings from server that belong to THIS Telegram user (Personal History)
  const [authenticatedUserBookings, setAuthenticatedUserBookings] = useState<Booking[]>([]);

  // Load bookings from local storage on mount
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

  // Save local bookings helper
  const saveLocalBookings = (newBookings: Booking[]) => {
    setLocalBookings(newBookings);
    try {
      localStorage.setItem('barber_bookings', JSON.stringify(newBookings));
    } catch (e) {
      console.warn("Could not save bookings to storage");
    }
  };

  // Helper to recover duration if server fails to send it
  const getFallbackDuration = (barberId: string, serviceId: string): number => {
     const barber = BARBERS.find(b => String(b.id) === String(barberId));
     if (!barber) return 45;
     const service = barber.services.find(s => String(s.serviceId) === String(serviceId));
     return service ? service.durationMinutes : 45;
  };

  // Centralized Data Fetching Function
  const fetchServerBookings = useCallback(async () => {
      try {
        // Add timestamp to prevent caching
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?t=${Date.now()}`, {
          method: 'GET',
          redirect: 'follow'
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        if (Array.isArray(data)) {
          // a) Update Server Bookings (for blocking slots globally)
          const normalizedServerBookings: Booking[] = data.map((item: any) => {
            const bId = item.barberId ? String(item.barberId) : 'unknown';
            const sId = item.serviceId || 'unknown';
            
            // Clean up the time slot format
            const cleanTime = normalizeTimeSlot(item.timeSlot);
            
            // Critical: If duration is 0 or missing, lookup the standard duration for this service
            // This ensures a 60min haircut actually blocks 60mins even if DB is empty
            const duration = item.duration || getFallbackDuration(bId, sId);

            return {
              id: item.id || `server_${Math.random()}`,
              barberId: bId,
              serviceId: sId,
              date: item.date, // ISO string
              timeSlot: cleanTime, // Ensure HH:MM
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

          // b) CROSS-DEVICE SYNC: Find my bookings on the server
          const tgUser = getTelegramUser();
          
          if (tgUser && tgUser.id) {
            const currentTgId = String(tgUser.id);
            const myServerBookings = normalizedServerBookings.filter(b => 
              b.tgUserId === currentTgId
            );
            setAuthenticatedUserBookings(myServerBookings);
          } else {
            // Fallback for non-telegram users (rely on local storage)
            setAuthenticatedUserBookings(localBookings.filter(b => b.status === 'confirmed'));
          }

          // c) SYNC LOCAL STATUS: Mark local bookings as cancelled if they are not on the server anymore
          if (localBookings.length > 0) {
            let hasChanges = false;
            const serverBookingIds = new Set(normalizedServerBookings.map(b => b.id));
            
            const updatedLocalBookings = localBookings.map(localBooking => {
              // Safety check: Don't cancel bookings created in the last 15 seconds (race condition protection)
              const isJustCreated = (Date.now() - localBooking.createdAt) < 15000;

              if (localBooking.status === 'confirmed' && !serverBookingIds.has(localBooking.id) && !isJustCreated) {
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
        // On failure, rely on local data for user's own history
        setAuthenticatedUserBookings(localBookings.filter(b => b.status === 'confirmed'));
      }
  }, [localBookings]); 

  // Polling Effect - Fetch data every 4 seconds
  useEffect(() => {
    fetchServerBookings(); // Initial fetch
    
    const intervalId = setInterval(() => {
      fetchServerBookings();
    }, 4000); 

    return () => clearInterval(intervalId);
  }, [fetchServerBookings]);


  const handleBookingComplete = async (bookingData: Omit<Booking, 'id' | 'status' | 'createdAt'>) => {
    const tgUser = getTelegramUser();
    const newBooking: Booking = {
      ...bookingData,
      id: Math.random().toString(36).substr(2, 9),
      status: 'confirmed',
      createdAt: Date.now(),
      tgUserId: tgUser?.id ? String(tgUser.id) : undefined,
      tgUsername: tgUser?.username
    };

    // 1. Optimistic UI Update
    const updatedLocal = [...localBookings, newBooking];
    saveLocalBookings(updatedLocal);
    
    setAuthenticatedUserBookings(prev => [...prev, newBooking]);
    setServerBookings(prev => [...prev, newBooking]);

    // 2. Send to Google Sheets
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(newBooking),
      });
      // Force a refresh shortly after
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
    // 1. Local Update
    const updated = localBookings.map(b => 
      b.id === id ? { ...b, status: 'cancelled' as const } : b
    );
    saveLocalBookings(updated);
    
    setAuthenticatedUserBookings(prev => prev.map(b => 
      b.id === id ? { ...b, status: 'cancelled' as const } : b
    ));

    // 2. Server Update
    try {
      const bookingToCancel = localBookings.find(b => b.id === id);
      
      if (bookingToCancel) {
         await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({ 
            ...bookingToCancel,
            status: 'cancelled' 
          })
        });
        setTimeout(fetchServerBookings, 1000);
      }
    } catch (e) {
      console.error("Failed to sync cancellation", e);
    }
  };

  const handleStartBooking = (barberId?: string, serviceId?: string) => {
    // Force refresh data before opening wizard to ensure slots are accurate
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
    if (localB.status === 'confirmed' && !allOccupiedBookings.some(serverB => serverB.id === localB.id)) {
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
