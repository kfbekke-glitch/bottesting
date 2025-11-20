import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  fullWidth?: boolean;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  isLoading = false,
  className = '',
  disabled,
  ...props 
}) => {
  const baseStyles = "relative font-mono uppercase font-bold tracking-wider transition-all duration-200 active:translate-y-[2px] disabled:opacity-50 disabled:pointer-events-none py-3 px-6 border-2";
  
  const variants = {
    primary: "bg-white text-black border-white hover:bg-zinc-200 hover:border-zinc-200",
    secondary: "bg-zinc-800 text-white border-zinc-800 hover:bg-zinc-700 hover:border-zinc-700",
    danger: "bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700",
    outline: "bg-transparent text-white border-zinc-600 hover:border-white hover:text-white",
  };

  return (
    <button
      className={`
        ${baseStyles} 
        ${variants[variant]} 
        ${fullWidth ? 'w-full' : ''} 
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Загрузка...
        </span>
      ) : children}
    </button>
  );
};
