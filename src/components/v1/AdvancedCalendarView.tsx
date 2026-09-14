import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Truck, 
  Users, 
  ShieldCheck, 
  Tag, 
  Filter, 
  UserCheck, 
  CalendarDays,
  X,
  RefreshCw
} from 'lucide-react';
import { CalendarEvent, CalendarEventCategory, Language } from '@/types/v1';
import { getTranslation } from '@/utils/translations';
import { ActionBar } from '@/components/v1/ActionBar';
import confetti from 'canvas-confetti';
import { api } from '@/lib/api';
import { mapEvent, eventToApiPayload, filterByBranchId } from '@/lib/apiSync';

interface AdvancedCalendarViewProps {
  language: Language;
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  onOpenAIChatWithPrompt?: (prompt: string) => void;
  lowStockCount: number;
  overdueCreditCount: number;
  activeBranchId?: string | null;
}

export const AdvancedCalendarView: React.FC<AdvancedCalendarViewProps> = ({
  language,
  events,
  setEvents,
  onOpenAIChatWithPrompt,
  lowStockCount,
  overdueCreditCount,
  activeBranchId,
}) => {
  const t = (key: any) => getTranslation(language, key);

  const branchEvents = useMemo(
    () => filterByBranchId(events, activeBranchId),
    [events, activeBranchId],
  );

  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 28)); // August 2026
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day' | 'agenda'>('month');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(branchEvents[0] || null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [isAIScheduling, setIsAIScheduling] = useState(false);

  useEffect(() => {
    if (!selectedEvent || !branchEvents.some(e => e.id === selectedEvent.id)) {
      setSelectedEvent(branchEvents[0] || null);
    }
  }, [branchEvents, selectedEvent?.id]);

  // New Event Form State
  const [newEvent, setNewEvent] = useState({
    title: '',
    category: 'delivery' as CalendarEventCategory,
    date: '2026-08-29',
    time: '10:00 AM',
    priority: 'high' as 'high' | 'medium' | 'low',
    description: '',
    assignedTo: 'Store Manager',
    syncedTRA: false,
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const goToToday = () => setCurrentDate(new Date(2026, 7, 28));

  // Category Color Map & Icons
  const getCategoryConfig = (category: CalendarEventCategory) => {
    switch (category) {
      case 'delivery':
        return { label: 'Supplier Delivery', bg: 'bg-[#0078D4]/15', text: 'text-[#0078D4]', border: 'border-[#0078D4]/30', icon: Truck };
      case 'dunning':
        return { label: 'Credit Dunning', bg: 'bg-[#D13438]/15', text: 'text-[#D13438]', border: 'border-[#D13438]/30', icon: Users };
      case 'compliance':
        return { label: 'TRA Compliance', bg: 'bg-[#107C10]/15', text: 'text-[#107C10]', border: 'border-[#107C10]/30', icon: ShieldCheck };
      case 'promo':
        return { label: 'Promo / Wellness', bg: 'bg-[#6264A7]/15', text: 'text-[#6264A7]', border: 'border-[#6264A7]/30', icon: Tag };
      case 'shift':
        return { label: 'Staff Shift', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', icon: Clock };
      default:
        return { label: 'General Task', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', icon: CalendarDays };
    }
  };

  const filteredEvents = branchEvents.filter(e => {
    if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;
    return true;
  });

  // Toggle completion
  const handleToggleComplete = async (eventId: string) => {
    const event = branchEvents.find(e => e.id === eventId);
    if (!event) return;
    const nextState = !event.completed;
    try {
      await api.updateCalendarEvent(eventId, { completed: nextState });
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, completed: nextState } : e));
      if (nextState) confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title) return;

    try {
      const raw = await api.createCalendarEvent(eventToApiPayload({
        title: newEvent.title,
        category: newEvent.category,
        date: newEvent.date,
        time: newEvent.time,
        priority: newEvent.priority,
        description: newEvent.description,
        assignedTo: newEvent.assignedTo,
      }, activeBranchId));
      const created = mapEvent(raw as Record<string, unknown>);
      setEvents(prev => [created, ...prev]);
      setSelectedEvent(created);
      setIsCreatingEvent(false);
      setNewEvent({
        title: '',
        category: 'delivery',
        date: new Date().toISOString().slice(0, 10),
        time: '10:00',
        priority: 'high',
        description: '',
        assignedTo: 'Store Manager',
        syncedTRA: false,
      });
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // AI Smart Scheduling Engine
  const handleAISmartSchedule = async () => {
    setIsAIScheduling(true);
    try {
      const res = await fetch('/api/ai/smart-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopType: 'Pharmacy',
          lowStockCount,
          overdueCustomersCount: overdueCreditCount,
        }),
      });
      const data = await res.json();
      if (data.events && data.events.length > 0) {
        // Merge without duplicates
        setEvents(prev => [...data.events, ...prev]);
        setSelectedEvent(data.events[0]);
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAIScheduling(false);
    }
  };

  // Calculate days for August 2026
  const daysInMonth = 31;
  const firstDayIndex = 6; // Saturday Aug 1, 2026
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanksArray = Array.from({ length: firstDayIndex }, (_, i) => i);

  return (
    <div className="space-y-5 pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#323130] tracking-tight">{t('calendarTitle')}</h2>
          <p className="text-xs text-[#605E5C]">
            Supplier Restock Drops • Customer Debt Dunning Schedule • TRA VFD Tax Compliance • Shift Rosters
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Smart Schedule Button */}
          <button
            id="btn-ai-smart-schedule"
            onClick={handleAISmartSchedule}
            disabled={isAIScheduling}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-[#0078D4] to-[#6264A7] hover:brightness-110 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            {isAIScheduling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-200" />}
            <span>{isAIScheduling ? 'AI Scheduling...' : t('aiScheduleBtn')}</span>
          </button>

          {/* Add Event */}
          <button
            id="btn-create-event-top"
            onClick={() => setIsCreatingEvent(!isCreatingEvent)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6264A7] hover:bg-[#555793] text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isCreatingEvent ? t('cancel') : t('addEvent')}</span>
          </button>
        </div>
      </div>

      {/* FULL WIDTH ACTION BAR */}
      <ActionBar
        language={language}
        onAdd={() => setIsCreatingEvent(true)}
        onView={() => selectedEvent && alert(`Viewing details for ${selectedEvent.title}`)}
        onAISuggest={handleAISmartSchedule}
        onExport={() => alert('Exporting Event Roster to iCal/Google Calendar/PDF...')}
        customAddLabel="➕ Schedule Event"
        selectedCount={selectedEvent ? 1 : 0}
        totalCount={branchEvents.length}
      />

      {/* INLINE EVENT CREATION DRAWER/FORM */}
      {isCreatingEvent && (
        <form onSubmit={handleSaveEvent} className="bg-white rounded-xl p-5 border-2 border-[#6264A7] shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-[#F3F2F1] pb-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-[#6264A7]" />
              <h3 className="font-bold text-sm text-[#323130]">{t('addEvent')}</h3>
            </div>
            <button type="button" onClick={() => setIsCreatingEvent(false)} className="text-[#605E5C]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Event Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Harshil Pharma Batch Delivery"
                value={newEvent.title}
                onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg focus:bg-white focus:border-[#0078D4] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Category</label>
              <select
                value={newEvent.category}
                onChange={e => setNewEvent({ ...newEvent, category: e.target.value as CalendarEventCategory })}
                className="w-full px-3 py-2 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg focus:bg-white focus:border-[#0078D4] outline-none"
              >
                <option value="delivery">🚚 Supplier Delivery</option>
                <option value="dunning">👥 Customer Credit Dunning</option>
                <option value="compliance">🛡️ TRA Tax / EFD Compliance</option>
                <option value="promo">🏷️ Promo & Wellness Event</option>
                <option value="shift">⏰ Staff Shift / Handover</option>
                <option value="maintenance">🔧 Store Maintenance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Priority</label>
              <select
                value={newEvent.priority}
                onChange={e => setNewEvent({ ...newEvent, priority: e.target.value as any })}
                className="w-full px-3 py-2 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg focus:bg-white focus:border-[#0078D4] outline-none"
              >
                <option value="high">🔴 High Priority</option>
                <option value="medium">🟡 Medium Priority</option>
                <option value="low">🟢 Low Priority</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Date (YYYY-MM-DD)</label>
              <input
                type="date"
                value={newEvent.date}
                onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg focus:bg-white focus:border-[#0078D4] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Time</label>
              <input
                type="text"
                placeholder="e.g. 10:30 AM"
                value={newEvent.time}
                onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg focus:bg-white focus:border-[#0078D4] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#323130] mb-1">Assigned Person</label>
              <input
                type="text"
                placeholder="e.g. Fatuma Ally (Pharmacist)"
                value={newEvent.assignedTo}
                onChange={e => setNewEvent({ ...newEvent, assignedTo: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg focus:bg-white focus:border-[#0078D4] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#323130] mb-1">Event Description & Action Items</label>
            <textarea
              rows={2}
              placeholder="Provide context, invoice numbers, or customer contact notes..."
              value={newEvent.description}
              onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#F3F2F1] border border-[#EDEBE9] rounded-lg focus:bg-white focus:border-[#0078D4] outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-xs text-[#323130] cursor-pointer">
              <input
                type="checkbox"
                checked={newEvent.syncedTRA}
                onChange={e => setNewEvent({ ...newEvent, syncedTRA: e.target.checked })}
                className="rounded text-[#0078D4] focus:ring-0"
              />
              <span className="font-medium">Link with TRA Electronic Invoice / VFD Deadline</span>
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingEvent(false)}
                className="px-4 py-1.5 text-xs font-semibold text-[#605E5C] bg-[#F3F2F1] rounded-lg hover:bg-[#EDEBE9]"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 text-xs font-semibold text-white bg-[#6264A7] hover:bg-[#555793] rounded-lg shadow-xs"
              >
                {t('save')} Event
              </button>
            </div>
          </div>
        </form>
      )}

      {/* CALENDAR CONTROLS & FILTER BAR */}
      <div className="bg-white rounded-xl p-4 border border-[#E1DFDD] shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#F3F2F1] p-1 rounded-lg border border-[#EDEBE9]">
            <button onClick={prevMonth} className="p-1 hover:bg-white rounded text-[#323130] transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={goToToday} className="px-3 py-0.5 text-xs font-bold text-[#0078D4] hover:bg-white rounded transition-colors">
              Today
            </button>
            <button onClick={nextMonth} className="p-1 hover:bg-white rounded text-[#323130] transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <h3 className="text-base font-bold text-[#323130] min-w-[140px]">
            {monthNames[currentMonth]} {currentYear}
          </h3>
        </div>

        {/* Category Filters */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs">
          <span className="text-[#605E5C] font-semibold mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { key: 'all', label: 'All' },
            { key: 'delivery', label: '🚚 Deliveries' },
            { key: 'dunning', label: '👥 Dunning' },
            { key: 'compliance', label: '🛡️ TRA' },
            { key: 'promo', label: '🏷️ Promo' },
            { key: 'shift', label: '⏰ Shifts' },
          ].map(cat => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-2.5 py-1 rounded-lg font-medium text-xs transition-all ${
                selectedCategory === cat.key
                  ? 'bg-[#6264A7] text-white font-bold shadow-xs'
                  : 'bg-[#F3F2F1] text-[#605E5C] hover:text-[#323130]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* View Switcher: Month, Week, Day, Agenda */}
        <div className="flex items-center bg-[#F3F2F1] p-1 rounded-lg border border-[#EDEBE9] text-xs font-semibold">
          {(['month', 'week', 'day', 'agenda'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setCalendarView(mode)}
              className={`px-3 py-1 rounded-md capitalize transition-all ${
                calendarView === mode
                  ? 'bg-white text-[#0078D4] shadow-xs font-bold'
                  : 'text-[#605E5C] hover:text-[#323130]'
              }`}
            >
              {t(`${mode}View` as any)}
            </button>
          ))}
        </div>
      </div>

      {/* CALENDAR MAIN BODY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT / MAIN CALENDAR GRID (8 COLS) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-[#E1DFDD] shadow-xs overflow-hidden">
          {calendarView === 'month' && (
            <div>
              {/* Day Name Headers */}
              <div className="grid grid-cols-7 border-b border-[#EDEBE9] bg-[#F8F8F8] text-center text-xs font-bold text-[#605E5C] py-2.5">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-[#EDEBE9]">
                {/* Blanks before 1st of month */}
                {blanksArray.map(b => (
                  <div key={`blank-${b}`} className="min-h-[96px] bg-[#FAF9F8]/50 p-1.5"></div>
                ))}

                {/* Days of August 2026 */}
                {daysArray.map(day => {
                  const dateStr = `2026-08-${String(day).padStart(2, '0')}`;
                  const dayEvents = filteredEvents.filter(e => e.date === dateStr);
                  const isToday = day === 28;

                  return (
                    <div
                      key={`day-${day}`}
                      onClick={() => {
                        if (dayEvents.length > 0) setSelectedEvent(dayEvents[0]);
                      }}
                      className={`min-h-[100px] p-1.5 transition-colors flex flex-col justify-between group cursor-pointer ${
                        isToday ? 'bg-[#F0F2FA] font-bold ring-1 ring-inset ring-[#6264A7]' : 'hover:bg-[#F8F8F8]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs w-5 h-5 rounded-full flex items-center justify-center ${
                          isToday ? 'bg-[#6264A7] text-white font-bold' : 'text-[#323130]'
                        }`}>
                          {day}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="w-2 h-2 rounded-full bg-[#0078D4]"></span>
                        )}
                      </div>

                      {/* Event Chips */}
                      <div className="space-y-1 my-1 overflow-hidden">
                        {dayEvents.slice(0, 2).map(evt => {
                          const config = getCategoryConfig(evt.category);
                          return (
                            <div
                              key={evt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(evt);
                              }}
                              className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium border ${config.bg} ${config.text} ${config.border} ${
                                evt.completed ? 'line-through opacity-50' : ''
                              }`}
                              title={evt.title}
                            >
                              {evt.time} {evt.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] text-[#605E5C] font-semibold pl-1">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Agenda List View */}
          {calendarView !== 'month' && (
            <div className="p-4 space-y-3">
              <h4 className="text-xs font-bold text-[#323130] uppercase tracking-wider">
                Upcoming Operational Timeline ({filteredEvents.length} Events)
              </h4>
              <div className="space-y-2">
                {filteredEvents.map(evt => {
                  const config = getCategoryConfig(evt.category);
                  const Icon = config.icon;
                  const isSelected = selectedEvent?.id === evt.id;

                  return (
                    <div
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-4 cursor-pointer transition-all ${
                        isSelected ? 'bg-[#F0F2FA] border-[#6264A7] shadow-xs' : 'bg-[#FAF9F8] border-[#EDEBE9] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg ${config.bg} ${config.text} flex items-center justify-center`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${evt.completed ? 'line-through text-[#605E5C]' : 'text-[#323130]'}`}>
                              {evt.title}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                              evt.priority === 'high' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {evt.priority.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#605E5C] flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {evt.date} • {evt.time}</span>
                            <span>👤 {evt.assignedTo}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleComplete(evt.id);
                        }}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          evt.completed ? 'bg-[#107C10] text-white border-[#107C10]' : 'border-[#C8C6C4] text-[#605E5C] hover:bg-white'
                        }`}
                        title="Toggle status"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDE: SELECTED EVENT INSPECTOR & AI INSIGHTS (4 COLS) */}
        <div className="lg:col-span-4 space-y-4">
          {selectedEvent ? (
            <div className="bg-white rounded-xl border border-[#E1DFDD] p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getCategoryConfig(selectedEvent.category).bg} ${getCategoryConfig(selectedEvent.category).text}`}>
                    {getCategoryConfig(selectedEvent.category).label}
                  </span>
                  <h3 className="text-base font-bold text-[#323130] mt-1.5">{selectedEvent.title}</h3>
                </div>

                <button
                  onClick={() => handleToggleComplete(selectedEvent.id)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold shadow-xs transition-all ${
                    selectedEvent.completed
                      ? 'bg-[#107C10] text-white'
                      : 'bg-[#F3F2F1] text-[#323130] hover:bg-[#107C10]/10 hover:text-[#107C10]'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{selectedEvent.completed ? 'Completed' : 'Mark Done'}</span>
                </button>
              </div>

              <div className="space-y-2 text-xs text-[#605E5C] bg-[#F8F8F8] p-3 rounded-lg border border-[#EDEBE9]">
                <div className="flex justify-between">
                  <span className="font-semibold">Date & Time:</span>
                  <span className="font-bold text-[#323130]">{selectedEvent.date} at {selectedEvent.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Assigned Lead:</span>
                  <span className="font-bold text-[#323130]">{selectedEvent.assignedTo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Priority Level:</span>
                  <span className="font-bold capitalize text-[#D13438]">{selectedEvent.priority} Priority</span>
                </div>
                {selectedEvent.syncedTRA && (
                  <div className="flex justify-between text-[#107C10] font-bold">
                    <span>TRA Status:</span>
                    <span>EFD Compliance Verified</span>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-[#323130] uppercase tracking-wider mb-1">Description & Tasks</h4>
                <p className="text-xs text-[#605E5C] leading-relaxed bg-[#FAF9F8] p-3 rounded-lg border border-[#EDEBE9]">
                  {selectedEvent.description || 'No additional instructions attached to this event.'}
                </p>
              </div>

              <div className="pt-2 border-t border-[#F3F2F1] flex gap-2">
                <button
                  onClick={() => {
                    if (onOpenAIChatWithPrompt) {
                      onOpenAIChatWithPrompt(`Nipe ushauri wa utekelezaji bora wa tukio hili: ${selectedEvent.title}.`);
                    }
                  }}
                  className="flex-1 py-2 rounded-lg bg-[#6264A7] hover:bg-[#555793] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>AI Execution Advice</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 text-center text-[#605E5C] border border-[#E1DFDD]">
              Click any calendar day or event to inspect operational details.
            </div>
          )}

          {/* Smart Telemetry Sync Banner */}
          <div className="bg-gradient-to-br from-[#FAF9F8] to-[#F0F2FA] rounded-xl p-4 border border-[#E1DFDD] shadow-xs text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-[#323130]">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Smart Event Telemetry</span>
            </div>
            <p className="text-[11px] text-[#605E5C]">
              The calendar automatically syncs with your low-stock thresholds ({lowStockCount} items) and customer credit overdue alerts ({overdueCreditCount} accounts).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
