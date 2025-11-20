
import React from 'react';
import { AppView } from '../types';
import { Home, Calendar } from 'lucide-react';

interface BottomNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onNavigate }) => {
  const navItems = [
    { view: AppView.HOME, icon: Home, label: 'Главная' },
    { view: AppView.MY_BOOKINGS, icon: Calendar, label: 'Мои Записи' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 z-40 pb-safe-bottom">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className={`
                flex flex-col items-center justify-center w-full h-full space-y-1
                transition-colors duration-200
                ${isActive ? 'text-amber-600' : 'text-zinc-500'}
              `}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
