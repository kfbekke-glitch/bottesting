
import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { BookingWizard } from './components/BookingWizard';
import { MyBookings } from './components/MyBookings';
import { AdminView } from './components/AdminView'; // Import AdminView
import { AppView, Booking } from './types';
import { AnimatePresence, motion } from 'framer-motion';
import { initTelegramApp, getTelegramUser } from './utils/telegram';
import { BARBERS } from './constants';
import { WifiOff } from 'lucide-react';
import { Modal } from './components/ui/Modal';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxHYQW1vkDSYMqHV-QcBBgAJx-q9dzlCFdCPNujQfoQ0m_ddw01vdqE0xZ8xyxSUDn-/exec';

// Robust date parser that forces correct day regardless of timezone
const normalizeDate = (raw: any): string => {
  if (!raw) return '';
  const s = String(raw);
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s;
  
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
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
  const [isOffline, setIsOffline] = useState(false);
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  
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
        const parsed = JSON.parse(saved);
        setLocalBookings(parsed);
        // Initialize authenticated view from local cache immediately
        setAuthenticatedUserBookings(parsed.filter((b: Booking) => b.status === 'confirmed'));
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

  // Helper to fetch with timeout and simple retry
  const fetchWithRetry = async (url: string, retries = 2, timeout = 12000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, { 
            redirect: 'follow',
            signal: controller.signal
        });
        clearTimeout(id);
        if (response.ok) return response;
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(res => setTimeout(res, 1000)); // Wait 1s before retry
      }
    }
    throw new Error('Max retries reached');
  };

  const fetchServerBookings = useCallback(async () => {
      try {
        // Use robust fetch with timeout
        const response = await fetchWithRetry(`${GOOGLE_SCRIPT_URL}?t=${Date.now()}`);

        const data = await response.json();

        if (Array.isArray(data)) {
          const normalizedServerBookings: Booking[] = data.map((item: any) => {
            const bId = item.barberId ? String(item.barberId) : 'unknown';
            const sId = item.serviceId || 'unknown';
            const cleanTime = normalizeTimeSlot(item.timeSlot);
            const cleanDate = normalizeDate(item.date);
            const duration = item.duration || getFallbackDuration(bId, sId);

            return {
              id: item.id ? String(item.id) : `server_${Math.random()}`, 
              barberId: bId,
              serviceId: sId,
              date: cleanDate,
              timeSlot: cleanTime,
              clientName: item.clientName || 'Occupied',
              clientPhone: item.clientPhone || '',
              price: item.price || 0,
              duration: duration, 
              status: 'confirmed',
              createdAt: item.createdAt || 0,
              tgUserId: item.tgUserId ? String(item.tgUserId) : undefined,
              tgUsername: item.tgUsername // Ensure this is passed if server sends it (needs server update to send username, but we'll prep for it)
            };
          });
          
          setServerBookings(normalizedServerBookings);
          setIsOffline(false); // Connection healthy

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

          if (localBookings.length > 0) {
            let hasChanges = false;
            const serverBookingIds = new Set(normalizedServerBookings.map(b => String(b.id)));
            
            const updatedLocalBookings = localBookings.map(localBooking => {
              const isJustCreated = (Date.now() - localBooking.createdAt) < 15000;
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
        setIsOffline(true); // Connection failed
        // Fallback to local storage for authenticated view so user sees something
        setAuthenticatedUserBookings(localBookings.filter(b => b.status === 'confirmed'));
      }
  }, [localBookings]); 

  useEffect(() => {
    fetchServerBookings();
    const intervalId = setInterval(() => {
      fetchServerBookings();
    }, 5000); 
    return () => clearInterval(intervalId);
  }, [fetchServerBookings]);


  const handleBookingComplete = async (bookingData: Omit<Booking, 'id' | 'status' | 'createdAt'>) => {
    if (isOffline) {
      setShowOfflineAlert(true);
      return;
    }

    const tgUser = getTelegramUser();

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
      setIsOffline(true);
      setShowOfflineAlert(true);
    }

    setIsBookingOpen(false);
    setPreSelectedBarberId(undefined);
    setPreSelectedServiceId(undefined);
    setCurrentView(AppView.MY_BOOKINGS);
  };
  
  // New handler for Admin creation
  const handleAdminCreateBooking = async (bookingData: Omit<Booking, 'id' | 'status' | 'createdAt'>) => {
    if (isOffline) {
      setShowOfflineAlert(true);
      return;
    }

    // Admin bookings do not have tgUserId linked to the admin
    const newBooking: Booking = {
      ...bookingData,
      id: `admin_${Math.random().toString(36).substr(2, 9)}`,
      status: 'confirmed',
      createdAt: Date.now(),
    };

    // Update server list optimistically
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
      console.error("Failed to sync admin booking", e);
      setIsOffline(true);
      setShowOfflineAlert(true);
    }
  };

  const handleCancelBooking = async (id: string) => {
    if (isOffline) {
      setShowOfflineAlert(true);
      return;
    }

    const targetId = String(id);

    // Optimistic UI update for Local Bookings
    const updated = localBookings.map(b => 
      String(b.id) === targetId ? { ...b, status: 'cancelled' as const } : b
    );
    saveLocalBookings(updated);
    
    setAuthenticatedUserBookings(prev => prev.map(b => 
      String(b.id) === targetId ? { ...b, status: 'cancelled' as const } : b
    ));
    
    // Also update server bookings locally to reflect change immediately in Admin panel
    setServerBookings(prev => prev.map(b => 
      String(b.id) === targetId ? { ...b, status: 'cancelled' as const } : b
    ));

    try {
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
      setIsOffline(true);
    }
  };

  const handleUpdatePrice = async (id: string, newPrice: number) => {
     if (isOffline) {
      setShowOfflineAlert(true);
      return;
    }

    const targetId = String(id);
    
    // Optimistic update
    setServerBookings(prev => prev.map(b => 
      String(b.id) === targetId ? { ...b, price: newPrice } : b
    ));

    try {
       await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
          action: 'update_price',
          id: targetId,
          price: newPrice
        })
      });
      // fetchServerBookings will sync eventually
    } catch (e) {
      console.error("Failed to update price", e);
      setIsOffline(true);
    }
  };

  const handleStartBooking = (barberId?: string, serviceId?: string) => {
    if (isOffline) {
      setShowOfflineAlert(true);
      return;
    }
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
    if (localB.status === 'confirmed' && !allOccupiedBookings.some(serverB => String(serverB.id) === String(localB.id))) {
      allOccupiedBookings.push(localB);
    }
  });

  return (
    <div 
      style={{ height: 'var(--tg-viewport-height, 100vh)' }}
      className="bg-zinc-950 text-zinc-100 font-sans w-full max-w-md mx-auto overflow-hidden shadow-2xl flex flex-col relative"
    >
      <Header />
      
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-900/20 border-b border-red-900/30 overflow-hidden relative z-20 shrink-0"
          >
            <div className="px-4 py-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase text-red-500 tracking-wider">
              <WifiOff size={12} />
              <span>Нет соединения. Функции ограничены.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
               <HomeView onStartBooking={handleStartBooking} isOffline={isOffline} />
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
              <MyBookings 
                bookings={authenticatedUserBookings} 
                onCancelBooking={handleCancelBooking}
                isOffline={isOffline}
              />
            </motion.div>
          )}

          {currentView === AppView.ADMIN && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto no-scrollbar w-full h-full"
            >
              <AdminView 
                bookings={serverBookings}
                onDeleteBooking={handleCancelBooking}
                onUpdatePrice={handleUpdatePrice}
                onCreateBooking={handleAdminCreateBooking}
              />
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
              isOffline={isOffline}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Modal 
        isOpen={showOfflineAlert}
        onClose={() => setShowOfflineAlert(false)}
        onConfirm={() => setShowOfflineAlert(false)}
        title="Связь потеряна"
        description="К сожалению, сейчас нет доступа к серверу. Чтобы избежать ошибок в расписании, запись и отмена недоступны до восстановления связи."
        singleButton={true}
      />
    </div>
  );
};

export default App;
