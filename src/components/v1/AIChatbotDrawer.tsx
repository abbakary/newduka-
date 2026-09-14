import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { Language } from '@/types/v1';

interface AIChatbotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  initialPrompt?: string;
}

export const AIChatbotDrawer: React.FC<AIChatbotDrawerProps> = ({
  isOpen,
  onClose,
  language,
  initialPrompt,
}) => {
  const isSw = language === 'sw';
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([
    {
      role: 'ai',
      text: isSw
        ? 'Jambo! Mimi ni Msaidizi wa Duka+. Ninaweza kukusaidia kuchambua mauzo, wateja, na mipango ya biashara.'
        : 'Hello! I am your Duka+ assistant. I can help analyze sales, clients, and business plans.',
    },
  ]);
  const sentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !initialPrompt || sentRef.current === initialPrompt) return;
    sentRef.current = initialPrompt;
    setMessages(prev => [...prev, { role: 'user', text: initialPrompt }]);
    setMessages(prev => [
      ...prev,
      {
        role: 'ai',
        text: isSw
          ? 'Nimepokea ombi lako. Fungua Dashibodi, Ripoti, au Faida na Gharama kwa uchambuzi zaidi kutoka data halisi.'
          : 'Request received. Open Dashboard, Reports, or Profit & Costs for deeper analysis from your live data.',
      },
    ]);
  }, [initialPrompt, isOpen, isSw]);

  if (!isOpen) return null;

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: isSw
            ? 'Asante kwa swali lako. Endelea kutumia moduli za POS, Ripoti, na AI Brief kwenye dashibodi.'
            : 'Thanks for your question. Continue using POS, Reports, and AI Brief on the dashboard.',
        },
      ]);
    }, 400);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white border-l border-[#E1DFDD] shadow-2xl z-50 flex flex-col">
      <div className="p-4 bg-gradient-to-r from-[#003322] to-[#0d9488] text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#D4AF37]" />
          <span className="font-bold text-sm">{isSw ? 'Msaidizi wa AI' : 'AI Assistant'}</span>
        </div>
        <button type="button" onClick={onClose} className="p-1 hover:bg-white/10 rounded cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F9F9F7]">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role === 'ai' && <Bot className="w-5 h-5 text-[#0d9488] shrink-0" />}
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                m.role === 'user' ? 'bg-[#0d9488] text-white' : 'bg-white border border-[#E1DFDD]'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t flex gap-2 bg-white">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={isSw ? 'Uliza swali…' : 'Ask a question…'}
          className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#E1DFDD] outline-none focus:border-[#0d9488]"
        />
        <button type="button" onClick={send} className="p-2 rounded-xl bg-[#D4AF37] text-[#003322] cursor-pointer">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
