
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { BookingWizard } from './components/BookingWizard';
import { MyBookings } from './components/MyBookings';
import { AppView, Booking } from './types';
import { AnimatePresence, motion } from 'framer-motion';
import { initTelegramApp, getTelegramUser } from './utils/telegram';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx57Ru5n6HiQQ68rEiGa2kXVHGIzI-8JvCnZSusmB-pC0GVN60Qu6Wi8ZPTOaT1yKbW/exec';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  
  // Booking Context State
  const [preSelectedBarberId, setPreSelectedBarberId] = useState<string | undefined>(undefined);
  const [preSelectedServiceId, setPreSelectedServiceId] = useState<string | undefined>(undefined);
  
  // localBookings = Stored in localStorage (fallback/offline)
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
        const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'GET',
          redirect: 'follow'
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            // a) Update Server Bookings (for blocking slots globally)
            const normalizedServerBookings: Booking[] = data.map((item: any, index: number) => ({
              id: item.id || `server_${index}`,
              barberId: item.barberId,
              serviceId: item.serviceId || 'unknown',
              // Ensure date is preserved correctly as ISO string
              date: item.date,
              timeSlot: item.timeSlot,
              clientName: item.clientName || 'Occupied',
              clientPhone: '',
              price: 0,
              duration: item.duration || 45, 
              status: 'confirmed',
              createdAt: 0,
              // Normalize tgUserId to string for comparison
              tgUserId: item.tgUserId ? String(item.tgUserId) : undefined
            }));
            setServerBookings(normalizedServerBookings);

            // b) CROSS-DEVICE SYNC: Find my bookings on the server
            const tgUser = getTelegramUser();
            
            // Logic: If we have a Telegram ID, filter server bookings by it.
            // If not, fall back to local storage.
            if (tgUser && tgUser.id) {
              const currentTgId = String(tgUser.id);
              
              const myServerBookings = normalizedServerBookings.filter(b => 
                b.tgUserId === currentTgId
              );
              
              // Merge with local just in case server hasn't updated yet (optimistic)
              // But generally trust server for "already booked" status
              
              // Map server bookings to full objects if possible, but we mostly need date/status
              // For MyBookings view, we might miss details like Price if not stored on server
              // But for "One booking per day" check, date is enough.
              
              // Let's combine: Take server bookings (truth) + any local bookings not yet on server
              const combinedUserBookings = [...myServerBookings];
              
              // Add local bookings that are NOT in server list yet (newly created)
              currentLocalBookings.forEach(localB => {
                 const exists = combinedUserBookings.some(sb => sb.id === localB.id);
                 if (!exists && localB.status === 'confirmed') {
                    combinedUserBookings.push(localB);
                 }
              });

              setAuthenticatedUserBookings(combinedUserBookings);
            } else {
              // If no Telegram ID (browser), fall back to local bookings
              setAuthenticatedUserBookings(currentLocalBookings);
            }

            // c) SYNC LOCAL STATUS: Check if local bookings are still valid on server
            let hasChanges = false;
            const updatedLocalBookings = currentLocalBookings.map(localBooking => {
              if (localBooking.status === 'cancelled') return localBooking;

              // Check if this booking ID exists in the active server data
              // If server returns clean list of ACTIVE bookings, missing ID means cancelled/deleted
              // NOTE: Our GAS script returns active bookings. Cancelled ones are filtered out.
              const existsOnServer = data.some((serverBooking: any) => {
                if (serverBooking.id && serverBooking.id === localBooking.id) return true;
                // Fallback match
                return serverBooking.barberId === localBooking.barberId &&
                       serverBooking.timeSlot === localBooking.timeSlot &&
                       serverBooking.date.substring(0, 10) === localBooking.date.substring(0, 10);
              });

              // If data loaded successfully (length > 0) and booking is missing -> Cancel it locally
              if (!existsOnServer && data.length > 0) { 
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

    // 1. Optimistic UI Update
    const updatedLocal = [...localBookings, newBooking];
    saveLocalBookings(updatedLocal);
    setAuthenticatedUserBookings(prev => [...prev, newBooking]);
    setServerBookings(prev => [...prev, newBooking]); // Block slot immediately

    // 2. Send to Google Sheets
    try {
      const tgUser = getTelegramUser();
      
      const payload = {
        ...newBooking,
        tgUserId: tgUser?.id ? String(tgUser.id) : '', 
        tgUsername: tgUser?.username || ''
      };

      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', // Fix for CORS
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
    
    // Update authenticated list
    setAuthenticatedUserBookings(prev => prev.map(b => 
      b.id === id ? { ...b, status: 'cancelled' as const } : b
    ));

    // 2. Server Update (Send cancellation event)
    try {
      const bookingToCancel = localBookings.find(b => b.id === id) || authenticatedUserBookings.find(b => b.id === id);
      
      if (bookingToCancel) {
         await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 
            'Content-Type': 'text/plain;charset=utf-8' // Fix for CORS
          },
          body: JSON.stringify({ 
            id: id, 
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

  // Use authenticated bookings if available (cross-device), otherwise local
  const displayBookings = authenticatedUserBookings.length > 0 ? authenticatedUserBookings : localBookings;

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
              <MyBookings bookings={displayBookings} onCancelBooking={handleCancelBooking} />
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
              bookings={serverBookings} // Pass GLOBAL bookings for slot blocking
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
