
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { BookingWizard } from './components/BookingWizard';
import { MyBookings } from './components/MyBookings';
import { AppView, Booking } from './types';
import { AnimatePresence, motion } from 'framer-motion';
import { initTelegramApp, getTelegramUser } from './utils/telegram';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby5ek0lwgnxsC8Bc0TJ6DWhCvQK9-Lr6sSAGF0Z0IEASWCp09R2N3eCE2yZiY6l17_B/exec';

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

  // Load bookings from local storage on mount and init Telegram
  useEffect(() => {
    initTelegramApp();
    
    let currentLocalBookings: Booking[] = [];

    // 1. Load Local History (Fallback)
    try {
      const saved = localStorage.getItem('barber_bookings');
      if (saved) {
        currentLocalBookings = JSON.parse(saved);
        setLocalBookings(currentLocalBookings);
      }
    } catch (e) {
      console.warn("Could not load bookings from storage");
    }

    // 2. Fetch Occupied Slots from Server AND Sync Status
    const fetchServerBookings = async () => {
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
          const normalizedServerBookings: Booking[] = data.map((item: any) => ({
            id: item.id || `server_${Math.random()}`,
            barberId: item.barberId,
            serviceId: item.serviceId || 'unknown',
            date: item.date, // ISO string
            timeSlot: item.timeSlot,
            clientName: item.clientName || 'Occupied',
            clientPhone: '',
            price: item.price || 0,
            duration: item.duration || 45, 
            status: 'confirmed',
            createdAt: item.createdAt || 0,
            tgUserId: item.tgUserId ? String(item.tgUserId) : undefined
          }));
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
            setAuthenticatedUserBookings(currentLocalBookings.filter(b => b.status === 'confirmed'));
          }

          // c) SYNC LOCAL STATUS: Mark local bookings as cancelled if they are not on the server anymore
          let hasChanges = false;
          const serverBookingIds = new Set(normalizedServerBookings.map(b => b.id));
          
          const updatedLocalBookings = currentLocalBookings.map(localBooking => {
            if (localBooking.status === 'confirmed' && !serverBookingIds.has(localBooking.id)) {
              hasChanges = true;
              return { ...localBooking, status: 'cancelled' as const };
            }
            return localBooking;
          });

          if (hasChanges) {
            saveLocalBookings(updatedLocalBookings);
          }
        }
      } catch (e) {
        console.error("Failed to fetch server bookings:", e);
        // On failure, rely on local data for user's own history
        setAuthenticatedUserBookings(currentLocalBookings.filter(b => b.status === 'confirmed'));
      }
    };

    fetchServerBookings();
  }, []);

  // Save local bookings
  const saveLocalBookings = (newBookings: Booking[]) => {
    setLocalBookings(newBookings);
    try {
      localStorage.setItem('barber_bookings', JSON.stringify(newBookings));
    } catch (e) {
      console.warn("Could not save bookings to storage");
    }
  };

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

    // 2. Server Update (Send cancellation event)
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
      }
    } catch (e) {
      console.error("Failed to sync cancellation", e);
    }
  };

  const handleStartBooking = (barberId?: string, serviceId?: string) => {
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
  // Add unique local bookings to prevent double-counting but ensure immediate UI feedback
  localBookings.forEach(localB => {
    if (!allOccupiedBookings.some(serverB => serverB.id === localB.id)) {
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
              bookings={allOccupiedBookings} // Pass GLOBAL bookings for slot blocking
              userBookings={authenticatedUserBookings} // Pass PERSONAL bookings for daily limit
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
