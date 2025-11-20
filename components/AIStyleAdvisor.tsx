import React, { useState, useRef, useEffect } from 'react';
import { getStyleAdvice } from '../services/geminiService';
import { Bot, Send, User } from 'lucide-react';
import { motion } from 'framer-motion';

interface Message {
  role: 'user' | 'bot';
  text: string;
}

export const AIStyleAdvisor: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Привет. Я BarberBot. Опиши свой тип лица или волос, и я подберу стрижку.' }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    const response = await getStyleAdvice(userMsg);
    
    setLoading(false);
    setMessages(prev => [...prev, { role: 'bot', text: response }]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 pb-4">
        {messages.map((msg, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`
              w-8 h-8 shrink-0 flex items-center justify-center rounded-full
              ${msg.role === 'bot' ? 'bg-zinc-800 text-amber-600' : 'bg-zinc-700 text-white'}
            `}>
              {msg.role === 'bot' ? <Bot size={16} /> : <User size={16} />}
            </div>
            <div className={`
              p-3 max-w-[85%] text-sm rounded-2xl
              ${msg.role === 'bot' 
                ? 'bg-zinc-900 text-zinc-200 rounded-tl-none' 
                : 'bg-amber-600 text-black rounded-tr-none font-medium'}
            `}>
              {msg.text}
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex gap-3">
             <div className="w-8 h-8 shrink-0 bg-zinc-800 flex items-center justify-center rounded-full text-amber-600">
               <Bot size={16} />
            </div>
            <div className="bg-zinc-900 p-3 rounded-2xl rounded-tl-none text-zinc-500 text-xs animate-pulse">
              Печатает...
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-zinc-950 border-t border-zinc-900">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Сообщение..."
            className="flex-1 bg-zinc-900 rounded-full px-4 py-3 text-white text-sm focus:ring-1 focus:ring-amber-600 outline-none placeholder-zinc-600"
            disabled={loading}
          />
          <button 
            onClick={handleSend} 
            disabled={loading || !input.trim()} 
            className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center text-black disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-600"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};