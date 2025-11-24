import React, { useEffect, useState } from 'react';

interface DatePickerProps {
  value?: string; // expected ISO date 'YYYY-MM-DD'
  onChange?: (value: string) => void;
  required?: boolean;
  className?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, className }) => {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        setYear(parts[0]);
        setMonth(parts[1]);
        setDay(parts[2]);
        return;
      }
    }
    setDay('');
    setMonth('');
    setYear('');
  }, [value]);

  useEffect(() => {
    if (day && month && year) {
      const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      onChange && onChange(iso);
    } else {
      onChange && onChange('');
    }
  }, [day, month, year, onChange]);

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 100;
  const maxYear = currentYear - 18; // prefer >=18 by default
  const years: string[] = [];
  for (let y = maxYear; y >= startYear; y--) years.push(String(y));

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

  return (
    <div className={`${className || ''} w-full h-12 border border-gray-300 rounded-lg flex items-center px-3 bg-white`}>
      <select value={day} onChange={(e) => setDay(e.target.value)} className="bg-transparent border-none outline-none text-sm mr-2">
        <option value="">DD</option>
        {days.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      <select value={month} onChange={(e) => setMonth(e.target.value)} className="bg-transparent border-none outline-none text-sm mr-2">
        <option value="">MM</option>
        {months.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <select value={year} onChange={(e) => setYear(e.target.value)} className="bg-transparent border-none outline-none text-sm">
        <option value="">YYYY</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
};

export default DatePicker;
