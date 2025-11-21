
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { BookingWizard } from './components/BookingWizard';
import { MyBookings } from './components/MyBookings';
import { AppView, Booking } from './types';
import { AnimatePresence, motion } from 'framer-motion';
import { initTelegramApp, getTelegramUser } from './utils/telegram';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzlt51lxw4cj4d6jypDa1P-18pFL5NAY9ih-3Dy6J52zbNqoicigAh7z53wVSyxoX5_/exec';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  
  // Booking Context State
  const [preSelectedBarberId, setPreSelectedBarberId] = useState<string | undefined>(undefined);
  const [preSelectedServiceId, setPreSelectedServiceId] = useState<string | undefined>(undefined);
  
  // localBookings = User's personal history (persisted in localStorage)
  const [localBookings, setLocalBookings] = useState<Booking[]>([]);
  // serverBookings = Occupied slots from all users (fetched from Google Sheets)
  const [serverBookings, setServerBookings] = useState<Booking[]>([]);

  // Load bookings from local storage on mount and init Telegram
  useEffect(() => {
    initTelegramApp();
    
    // 1. Load Local History
    try {
      const saved = localStorage.getItem('barber_bookings');
      if (saved) {
        setLocalBookings(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Could not load bookings from storage");
    }

    // 2. Fetch Occupied Slots from Server
    const fetchServerBookings = async () => {
      try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'GET',
          redirect: 'follow'
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            // Normalize server data to Booking interface
            // Server sends minimal data: {date, timeSlot, barberId}
            // We add default values for missing fields to satisfy the type
            const normalized: Booking[] = data.map((item: any, index: number) => ({
              id: `server_${index}`,
              barberId: item.barberId,
              serviceId: 'unknown',
              date: item.date,
              timeSlot: item.timeSlot,
              clientName: 'Occupied',
              clientPhone: '',
              price: 0,
              duration: 45, // Default duration for blocking if missing
              status: 'confirmed',
              createdAt: 0
            }));
            setServerBookings(normalized);
          }
        }
      } catch (e) {
        console.error("Failed to fetch server bookings", e);
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
    const newBooking: Booking = {
      ...bookingData,
      id: Math.random().toString(36).substr(2, 9),
      status: 'confirmed',
      createdAt: Date.now(),
    };

    // 1. Optimistic UI Update (Local)
    saveLocalBookings([...localBookings, newBooking]);
    
    // 2. Send to Google Sheets (Backend)
    try {
      // Get latest Telegram user data if available
      const tgUser = getTelegramUser();
      
      const payload = {
        ...newBooking,
        tgUserId: tgUser?.id || '',
        tgUsername: tgUser?.username || ''
      };

      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // 'no-cors' is required for simple GAS web app requests
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      // Note: With 'no-cors', we can't read the response, but the request will succeed if network is fine.
    } catch (e) {
      console.error("Failed to sync with server", e);
      // We don't rollback local state because offline-first is better for UX
    }

    setIsBookingOpen(false);
    setPreSelectedBarberId(undefined);
    setPreSelectedServiceId(undefined);
    setCurrentView(AppView.MY_BOOKINGS);
  };

  const handleCancelBooking = (id: string) => {
    // Currently only cancels locally. 
    // For full sync, we would need a separate API endpoint to update status in Sheets.
    const updated = localBookings.map(b => 
      b.id === id ? { ...b, status: 'cancelled' as const } : b
    );
    saveLocalBookings(updated);
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

  // Combine local and server bookings for the wizard to know what is blocked
  const allOccupiedBookings = [...localBookings, ...serverBookings];

  return (
    <div className="bg-zinc-950 text-zinc-100 font-sans h-[100dvh] max-w-md mx-auto relative overflow-hidden shadow-2xl flex flex-col">
      <Header />

      {/* Main Content Area */}
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
              <MyBookings bookings={localBookings} onCancelBooking={handleCancelBooking} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav currentView={currentView} onNavigate={setCurrentView} />

      {/* Booking Full Screen Overlay */}
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
              bookings={allOccupiedBookings} // Pass ALL bookings for slot blocking
              userBookings={localBookings}   // Pass ONLY user bookings for "One per day" check
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
