import React from 'react';
import { Scissors } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 pt-safe-top">
      <div className="h-14 flex items-center justify-center relative">
        <div className="flex items-center gap-2">
           <div className="text-amber-600">
             <Scissors size={20} />
           </div>
           <span className="text-lg font-black uppercase tracking-tighter text-white">
             BarberTesters
           </span>
        </div>
      </div>
    </header>
  );
};