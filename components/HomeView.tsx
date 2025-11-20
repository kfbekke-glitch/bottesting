
import React, { useState, useRef } from 'react';
import { Button } from './ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { BARBERS, SERVICES } from '../constants';
import { Star, X, Percent, ArrowRight, Clock, Trophy, Quote, ShieldCheck, MapPin, Phone, ExternalLink } from 'lucide-react';
import { Barber } from '../types';

interface HomeViewProps {
  onStartBooking: (barberId?: string, serviceId?: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onStartBooking }) => {
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  
  // Drag to Scroll Logic for Team Section
  const teamScrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const dragDist = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!teamScrollRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - teamScrollRef.current.offsetLeft;
    scrollLeft.current = teamScrollRef.current.scrollLeft;
    dragDist.current = 0;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !teamScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - teamScrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 2; 
    teamScrollRef.current.scrollLeft = scrollLeft.current - walk;
    dragDist.current = Math.abs(walk);
  };

  const handleBarberClick = (barber: Barber) => {
    if (dragDist.current < 5) {
      setSelectedBarber(barber);
    }
  };

  const getMinPrice = (serviceId: string) => {
    const prices = BARBERS.flatMap(barber => 
      barber.services
        .filter(s => s.serviceId === serviceId)
        .map(s => s.price)
    );
    if (prices.length === 0) return null;
    return Math.min(...prices);
  };

  return (
    <div className="space-y-8 pb-24 pt-4">
      {/* Welcome & Main Action */}
      <section className="px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 relative overflow-hidden flex flex-col items-center text-center"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-600/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          
          <h1 className="text-3xl font-black uppercase text-white leading-none mb-2">
            Barber<span className="text-amber-600">Testers</span>
          </h1>
          <p className="text-zinc-500 text-sm mb-8 font-mono uppercase tracking-widest">
            Мужская территория
          </p>
          
          <Button onClick={() => onStartBooking()} fullWidth className="py-4 text-lg bg-white text-black font-black tracking-widest hover:bg-zinc-200 border-none">
            ЗАПИСАТЬСЯ
          </Button>
        </motion.div>
      </section>

      {/* Promo Banner */}
      <section className="px-4">
        <div 
          onClick={() => onStartBooking(undefined, 's5')}
          className="relative bg-amber-600 rounded-xl p-5 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,#000_25%,transparent_25%,transparent_50%,#000_50%,#000_75%,transparent_75%,transparent)] bg-[length:20px_20px]" />
          
          <div className="relative z-10 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-black text-amber-600 text-[10px] font-black uppercase px-2 py-0.5 rounded">Акция</span>
                <span className="text-black font-bold text-xs uppercase tracking-wider">-15% Выгоды</span>
              </div>
              <h3 className="text-2xl font-black uppercase text-black leading-none">Отец + Сын</h3>
              <p className="text-black/80 text-xs font-bold mt-1 max-w-[80%]">Семейная стрижка по специальной цене.</p>
            </div>
            <div className="bg-black/10 p-2 rounded-full text-black">
              <Percent size={24} />
            </div>
          </div>
        </div>
      </section>

      {/* Horizontal Scroll - Masters */}
      <section>
        <div className="px-4 mb-4 flex justify-between items-end">
          <h2 className="text-lg font-bold uppercase text-white tracking-wide">Команда</h2>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Нажми для инфо</span>
        </div>
        
        <div 
          ref={teamScrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className="flex overflow-x-auto px-4 gap-4 no-scrollbar pb-4 cursor-grab active:cursor-grabbing select-none"
        >
          {BARBERS.map((barber) => (
            <div 
              key={barber.id} 
              onClick={() => handleBarberClick(barber)}
              className="shrink-0 w-40 flex flex-col cursor-pointer group"
            >
              <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-zinc-800 mb-3 relative border border-zinc-800 group-hover:border-amber-600 transition-colors">
                <img src={barber.image} alt={barber.name} draggable={false} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 pt-6">
                   <div className="flex items-center gap-1 text-amber-500 text-[10px] font-bold mb-0.5">
                      <Star size={10} fill="currentColor" /> {barber.rating}
                   </div>
                </div>
              </div>
              <h3 className="font-bold text-white text-sm uppercase truncate">{barber.name}</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide truncate">{barber.tier}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Popular Services */}
      <section className="px-4">
        <h2 className="text-lg font-bold uppercase text-white tracking-wide mb-4">Услуги</h2>
        <div className="space-y-3">
          {SERVICES.slice(0, 3).map(service => {
             const minPrice = getMinPrice(service.id);
             return (
              <div key={service.id} className="p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-xl flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-zinc-200 text-sm uppercase mb-1">{service.name}</h4>
                    <p className="text-xs text-zinc-500 line-clamp-1">{service.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-600 uppercase block">от</span>
                    <span className="font-mono text-amber-600 font-bold">{minPrice}₽</span>
                  </div>
              </div>
            )
          })}
          
          <Button 
            variant="outline" 
            fullWidth 
            onClick={() => setIsServicesOpen(true)}
            className="mt-4 text-xs py-3 border-dashed text-zinc-400 hover:text-white hover:border-solid"
          >
            Посмотреть все услуги и цены
          </Button>
        </div>
      </section>

      {/* Contacts & Location */}
      <section className="px-4">
        <h2 className="text-lg font-bold uppercase text-white tracking-wide mb-4">Где нас искать?</h2>
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-6">
          
          <div className="flex items-start gap-4">
            <div className="bg-zinc-800 p-3 rounded-full shrink-0 text-amber-600">
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-1">Адрес</h3>
              <p className="text-white font-medium text-sm mb-2">г. Тула, ул. Болдина, д. 149</p>
              <a 
                href="https://yandex.ru/maps/?text=г.+Тула,+ул.+Болдина,+д+149" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-amber-600 text-xs font-bold uppercase hover:text-amber-500 transition-colors"
              >
                Открыть на карте <ExternalLink size={12} />
              </a>
            </div>
          </div>

          <div className="flex items-start gap-4">
             <div className="bg-zinc-800 p-3 rounded-full shrink-0 text-amber-600">
              <Phone size={20} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-1">Контакты</h3>
              <a href="tel:+79805470406" className="text-white font-medium text-sm hover:text-amber-600 transition-colors block mb-1">
                +7 (980) 547-04-06
              </a>
              <p className="text-zinc-500 text-xs">Звоните, если заблудились</p>
            </div>
          </div>

           <div className="flex items-start gap-4">
             <div className="bg-zinc-800 p-3 rounded-full shrink-0 text-amber-600">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-1">Режим работы</h3>
              <p className="text-white font-medium text-sm">Ежедневно</p>
              <p className="text-zinc-400 text-sm">10:00 — 21:00</p>
            </div>
          </div>
        </div>
      </section>

      {/* Full Services Modal */}
      <AnimatePresence>
        {isServicesOpen && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-zinc-950 flex flex-col h-full w-full"
          >
            <div className="px-4 h-16 shrink-0 flex items-center justify-between border-b border-zinc-900 bg-zinc-950">
              <h2 className="text-lg font-black uppercase text-white">Прайс-лист</h2>
              <button 
                onClick={() => setIsServicesOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-safe-bottom">
              {SERVICES.map(service => {
                const minPrice = getMinPrice(service.id);
                const isPromo = service.id === 's5';
                const discountedMin = (minPrice && isPromo) ? Math.floor(minPrice * 0.85) : null;

                return (
                  <div key={service.id} className="bg-zinc-900 p-5 rounded-xl border border-zinc-800">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold text-white uppercase max-w-[60%]">{service.name}</h3>
                      {minPrice && (
                        <div className="flex flex-col items-end">
                           <div className={`bg-zinc-950 px-3 py-1 rounded-lg border border-zinc-800 ${isPromo ? 'border-amber-600/50' : ''}`}>
                            <span className="text-[10px] text-zinc-500 uppercase mr-1">от</span>
                            {isPromo && discountedMin ? (
                              <>
                                <span className="text-zinc-500 font-mono font-bold text-sm line-through mr-2 decoration-zinc-500">{minPrice}</span>
                                <span className="text-amber-600 font-mono font-bold text-lg">{discountedMin}₽</span>
                              </>
                            ) : (
                              <span className="text-amber-600 font-mono font-bold text-lg">{minPrice}₽</span>
                            )}
                          </div>
                          {isPromo && <span className="text-[10px] font-bold text-amber-600 uppercase mt-1">-15% скидка</span>}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed border-l-2 border-zinc-800 pl-3 my-3">
                      {service.description}
                    </p>
                    <button 
                      onClick={() => { setIsServicesOpen(false); onStartBooking(undefined, service.id); }}
                      className="flex items-center gap-2 text-xs font-bold uppercase text-amber-600 mt-2 hover:text-amber-500 transition-colors"
                    >
                      Записаться <ArrowRight size={14} />
                    </button>
                  </div>
                )
              })}
              
              {/* Honest Price Block */}
              <div className="mt-8 p-6 bg-zinc-900/50 border border-amber-600/20 rounded-2xl relative overflow-hidden">
                <div className="absolute -right-6 -top-6 text-amber-600/10">
                  <ShieldCheck size={100} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <ShieldCheck className="text-amber-600" size={24} />
                    <h3 className="text-white font-black uppercase tracking-wider text-sm">Честный Прайс</h3>
                  </div>
                  <p className="text-zinc-400 text-xs leading-relaxed mb-2">
                    Цена указана <strong>"ОТ"</strong> за базовую сложность. Мы ценим время и труд.
                  </p>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    Длинная борода, густые волосы или полная смена имиджа требуют больше времени и косметики.
                    Точную стоимость мастер озвучит после консультации, но <strong>ДО</strong> начала стрижки.
                  </p>
                </div>
              </div>

              <div className="h-8" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barber Details Modal */}
      <AnimatePresence>
        {selectedBarber && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none"
          >
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto" 
              onClick={() => setSelectedBarber(null)}
            />
            
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-zinc-950 w-full max-w-md rounded-t-3xl sm:rounded-2xl pointer-events-auto relative overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="relative h-72 shrink-0">
                 <img src={selectedBarber.image} className="w-full h-full object-cover" alt={selectedBarber.name} />
                 <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                 <button 
                    onClick={() => setSelectedBarber(null)}
                    className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md border border-white/10 z-20"
                 >
                    <X size={20} />
                 </button>
                 
                 <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="bg-amber-600 text-black text-xs font-black uppercase px-2 py-1 rounded">{selectedBarber.tier}</span>
                       <div className="flex items-center gap-1 text-white text-xs font-bold bg-zinc-900/80 px-2 py-1 rounded backdrop-blur">
                          <Star size={12} fill="currentColor" className="text-amber-500" /> {selectedBarber.rating}
                       </div>
                    </div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight">{selectedBarber.name}</h2>
                 </div>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                {selectedBarber.tags && selectedBarber.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {selectedBarber.tags.map((tag, index) => (
                      <div 
                        key={index}
                        className="bg-zinc-800/50 border border-zinc-700 px-3 py-1.5 rounded-full text-xs font-bold text-zinc-300 shadow-sm"
                      >
                        {tag}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-start gap-4 mb-8">
                  <Quote className="text-amber-600 shrink-0 opacity-50" size={24} />
                  <p className="text-zinc-300 leading-relaxed italic text-sm">{selectedBarber.description}</p>
                </div>
                
                <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4 tracking-wider">Достижения</h3>
                <div className="grid grid-cols-2 gap-3 mb-8">
                   <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex items-center gap-3">
                      <div className="bg-zinc-800 p-2 rounded-full text-zinc-400"><Trophy size={16} /></div>
                      <div>
                        <div className="text-xs font-bold text-white uppercase">Top Rated</div>
                        <div className="text-[10px] text-zinc-500">Выбор гостей</div>
                      </div>
                   </div>
                   <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex items-center gap-3">
                      <div className="bg-zinc-800 p-2 rounded-full text-zinc-400"><Clock size={16} /></div>
                      <div>
                        <div className="text-xs font-bold text-white uppercase">Пунктуальность</div>
                        <div className="text-[10px] text-zinc-500">100% вовремя</div>
                      </div>
                   </div>
                </div>

                <Button 
                  fullWidth 
                  onClick={() => { 
                    const id = selectedBarber.id;
                    setSelectedBarber(null);
                    onStartBooking(id); 
                  }}
                  className="py-4 text-lg"
                >
                   Записаться к мастеру
                </Button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
