import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tempRange, setTempRange] = useState<DateRange>(value);
  const pickerRef = useRef<HTMLDivElement>(null);

  const quickRanges = [
    { label: 'Today', days: 0 },
    { label: 'Yesterday', days: 1 },
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'This Month', getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startDate: start, endDate: end };
    }},
    { label: 'Last Month', getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: start, endDate: end };
    }},
  ];

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getMonthDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = new Date(year, month, 1).getDay();
    
    const days = [];
    
    // Previous month days
    const prevMonthDays = getDaysInMonth(year, month - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      days.push({ date, isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true });
    }
    
    // Next month days
    const totalCells = 42; // 6 weeks
    const nextMonthDays = totalCells - days.length;
    for (let i = 1; i <= nextMonthDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false });
    }
    
    return days;
  };

  const handleDateClick = (date: Date) => {
    if (!tempRange.startDate || (tempRange.startDate && tempRange.endDate)) {
      // Start new selection
      setTempRange({ startDate: date, endDate: date });
    } else if (date < tempRange.startDate) {
      // Selected date is before start date
      setTempRange({ startDate: date, endDate: tempRange.startDate });
    } else {
      // Selected date is after start date
      setTempRange({ ...tempRange, endDate: date });
    }
  };

  const applyRange = () => {
    onChange(tempRange);
    setIsOpen(false);
  };

  const applyQuickRange = (range: any) => {
    let newRange: DateRange;
    
    if (range.getRange) {
      newRange = range.getRange();
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - range.days);
      newRange = { startDate: start, endDate: end };
    }
    
    setTempRange(newRange);
    onChange(newRange);
    setIsOpen(false);
  };

  const isInRange = (date: Date) => {
    if (!tempRange.startDate || !tempRange.endDate) return false;
    return date >= tempRange.startDate && date <= tempRange.endDate;
  };

  const isStart = (date: Date) => {
    return tempRange.startDate && date.toDateString() === tempRange.startDate.toDateString();
  };

  const isEnd = (date: Date) => {
    return tempRange.endDate && date.toDateString() === tempRange.endDate.toDateString();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const days = getMonthDays();
  const monthYear = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
      >
        <Calendar className="h-4 w-4 text-gray-400" />
        <span className="text-gray-700 dark:text-gray-300">
          {formatDate(value.startDate)} - {formatDate(value.endDate)}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            {/* Quick ranges */}
            <div className="border-b border-gray-200 p-4 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-2">
                {quickRanges.map((range, index) => (
                  <button
                    key={index}
                    onClick={() => applyQuickRange(range)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar */}
            <div className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={() => setCurrentMonth(
                    new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
                  )}
                  className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-semibold">{monthYear}</span>
                <button
                  onClick={() => setCurrentMonth(
                    new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
                  )}
                  className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Day headers */}
              <div className="mb-2 grid grid-cols-7">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, index) => {
                  const isSelected = isInRange(day.date);
                  const isStartDay = isStart(day.date);
                  const isEndDay = isEnd(day.date);
                  const isToday = day.date.toDateString() === new Date().toDateString();

                  return (
                    <button
                      key={index}
                      onClick={() => handleDateClick(day.date)}
                      className={cn(
                        'relative h-8 rounded text-sm',
                        !day.isCurrentMonth && 'text-gray-400 dark:text-gray-500',
                        isSelected && 'bg-blue-100 dark:bg-blue-900/30',
                        isStartDay && 'rounded-l-full bg-blue-600 text-white',
                        isEndDay && 'rounded-r-full bg-blue-600 text-white',
                        isToday && !isStartDay && !isEndDay && 'border border-blue-500',
                        !isStartDay && !isEndDay && 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      <span
                        className={cn(
                          'relative z-10',
                          (isStartDay || isEndDay) && 'text-white',
                          isToday && !isStartDay && !isEndDay && 'font-bold text-blue-600 dark:text-blue-400'
                        )}
                      >
                        {day.date.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Selected range display */}
              <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
                <div className="text-sm">
                  <div className="text-gray-500 dark:text-gray-400">Selected:</div>
                  <div className="font-medium">
                    {tempRange.startDate ? formatDate(tempRange.startDate) : 'Start date'} -{' '}
                    {tempRange.endDate ? formatDate(tempRange.endDate) : 'End date'}
                  </div>
                </div>
                <button
                  onClick={applyRange}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};