
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { BookingWizard } from './components/BookingWizard';
import { MyBookings } from './components/MyBookings';
import { AppView, Booking } from './types';
import { AnimatePresence, motion } from 'framer-motion';
import { initTelegramApp, getTelegramUser } from './utils/telegram';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzvMAGT0_-mbzx4dEwEeHuitBPdxlYCJftpuAdMFArGOQZ9S5Fy5viI5B9a7ZHSHz8J/exec';

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
    
    let currentLocalBookings: Booking[] = [];

    // 1. Load Local History
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
        const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'GET',
          redirect: 'follow'
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            // a) Update Server Bookings (for blocking slots)
            const normalizedServerBookings: Booking[] = data.map((item: any, index: number) => ({
              id: `server_${index}`, // Temporary ID for display blocking
              realId: item.id, // Keep track of real ID if script sends it, or match by content
              barberId: item.barberId,
              serviceId: 'unknown',
              date: item.date,
              timeSlot: item.timeSlot,
              clientName: 'Occupied',
              clientPhone: '',
              price: 0,
              duration: 45, 
              status: 'confirmed',
              createdAt: 0
            }));
            setServerBookings(normalizedServerBookings);

            // b) SYNC LOGIC: Check if local bookings are still valid on server
            // We need the raw server data to check IDs or slots
            // Since the simple GET endpoint might only return active bookings,
            // If a local booking ID is NOT in the returned data (and it should be), it means Admin deleted it.
            // NOTE: This requires the GET endpoint to return IDs or unique keys. 
            // Assuming our GET returns simple objects {date, timeSlot, barberId}, we match by that.
            
            let hasChanges = false;
            const updatedLocalBookings = currentLocalBookings.map(localBooking => {
              if (localBooking.status === 'cancelled') return localBooking;

              // Check if this booking exists in the active server list
              // We match by Barber + Date + Time (since IDs might differ if we don't sync them perfectly)
              const existsOnServer = data.some((serverBooking: any) => {
                return serverBooking.barberId === localBooking.barberId &&
                       new Date(serverBooking.date).getTime() === new Date(localBooking.date).getTime() &&
                       serverBooking.timeSlot === localBooking.timeSlot;
              });

              // If it was confirmed locally, but is NOT in the server list anymore -> It was deleted/cancelled by Admin
              if (!existsOnServer) {
                hasChanges = true;
                return { ...localBooking, status: 'cancelled' as const };
              }
              
              return localBooking;
            });

            if (hasChanges) {
              setLocalBookings(updatedLocalBookings);
              localStorage.setItem('barber_bookings', JSON.stringify(updatedLocalBookings));
            }
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
      const tgUser = getTelegramUser();
      
      const payload = {
        ...newBooking,
        tgUserId: tgUser?.id || '',
        tgUsername: tgUser?.username || ''
      };

      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("Failed to sync with server", e);
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

    // 2. Server Update (Send cancellation event)
    try {
      const bookingToCancel = localBookings.find(b => b.id === id);
      if (bookingToCancel) {
         await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            ...bookingToCancel, 
            id: bookingToCancel.id,
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
