
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
  
  // localBookings = Stored in localStorage (fallback/offline)
  const [localBookings, setLocalBookings] = useState<Booking[]>([]);
  
  // serverBookings = All occupied slots fetched from Google Sheets
  const [serverBookings, setServerBookings] = useState<Booking[]>([]);

  // authenticatedUserBookings = Bookings from server that belong to THIS Telegram user
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
              date: item.date,
              timeSlot: item.timeSlot,
              clientName: item.clientName || 'Occupied',
              clientPhone: '',
              price: 0,
              duration: item.duration || 45, // Use duration from server if available, else default
              status: 'confirmed',
              createdAt: 0,
              tgUserId: item.tgUserId // We need this to identify own bookings
            }));
            setServerBookings(normalizedServerBookings);

            // b) CROSS-DEVICE SYNC: Find my bookings on the server
            const tgUser = getTelegramUser();
            if (tgUser && tgUser.id) {
              const myServerBookings = normalizedServerBookings.filter(b => 
                // Convert both to strings for safe comparison
                String(b.tgUserId) === String(tgUser.id)
              );
              setAuthenticatedUserBookings(myServerBookings);
            } else {
              // If no Telegram ID (browser), fall back to local bookings for "My Bookings" logic
              setAuthenticatedUserBookings(currentLocalBookings);
            }

            // c) SYNC LOCAL STATUS: Check if local bookings are still valid on server
            let hasChanges = false;
            const updatedLocalBookings = currentLocalBookings.map(localBooking => {
              if (localBooking.status === 'cancelled') return localBooking;

              // Check if this booking exists in the active server list
              // We match by Barber + Date + Time (since IDs might differ if we don't sync them perfectly)
              const existsOnServer = data.some((serverBooking: any) => {
                // Fuzzy match to handle potential format differences
                return serverBooking.barberId === localBooking.barberId &&
                       new Date(serverBooking.date).getDate() === new Date(localBooking.date).getDate() &&
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
    const updatedLocal = [...localBookings, newBooking];
    saveLocalBookings(updatedLocal);
    
    // Also update authenticated bookings so the user sees it immediately without refresh
    setAuthenticatedUserBookings(prev => [...prev, newBooking]);
    // Add to server bookings so slot is grayed out immediately
    setServerBookings(prev => [...prev, newBooking]);

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
          'Content-Type': 'text/plain;charset=utf-8',
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
    
    // Update authenticated list too
    setAuthenticatedUserBookings(prev => prev.filter(b => b.id !== id && b.timeSlot !== id)); // heuristic removal

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

  // Determine which bookings to show in "My Bookings"
  // Prefer authenticated server bookings (cross-device), fallback to local
  const displayBookings = authenticatedUserBookings.length > 0 ? authenticatedUserBookings : localBookings;

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
              <MyBookings bookings={displayBookings} onCancelBooking={handleCancelBooking} />
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
              bookings={serverBookings} // Pass GLOBAL server bookings for blocking slots
              userBookings={authenticatedUserBookings} // Pass AUTHENTICATED user bookings for 1/day limit
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
