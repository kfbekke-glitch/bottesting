import React from 'react';
import { Button } from './ui/Button';
import { motion } from 'framer-motion';

interface HeroProps {
  onStartBooking: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onStartBooking }) => {
  return (
    <div className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2074&auto=format&fit=crop" 
          alt="Barbershop interior" 
          className="w-full h-full object-cover grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-950/40" />
      </div>

      <div className="relative z-10 text-center max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-6xl md:text-8xl font-black uppercase text-white tracking-tighter mb-6">
            Barber<span className="text-amber-600">Testers</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-300 font-mono uppercase tracking-widest mb-10 max-w-2xl mx-auto">
            Стиль не терпит компромиссов. <br/>
            Брутальная атмосфера. Опытные мастера.
          </p>
          
          <div className="flex flex-col md:flex-row gap-6 justify-center">
            <Button onClick={onStartBooking} className="text-lg px-10 py-4 border-white">
              Записаться
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
