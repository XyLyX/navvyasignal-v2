'use client';
import { useEffect, useState } from 'react';

const CITIES = [
  { name: 'Dubai', zone: 'Asia/Dubai' },
  { name: 'London', zone: 'Europe/London' },
  { name: 'New York', zone: 'America/New_York' },
  { name: 'New Delhi', zone: 'Asia/Kolkata' },
  { name: 'Singapore', zone: 'Asia/Singapore' },
  { name: 'Tokyo', zone: 'Asia/Tokyo' },
] as const;
const CLOCK_FORMATS = CITIES.map(city => new Intl.DateTimeFormat('en-GB', {
  timeZone: city.zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}));
const DAY_FORMATS = CITIES.map(city => new Intl.DateTimeFormat('en-GB', {
  timeZone: city.zone, weekday: 'short', day: 'numeric', month: 'short',
}));
function ClockStrip() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  return <div className="pulse-clocks" aria-label="World clocks">
    {CITIES.map((city, index) => <div className="pulse-clock" key={city.zone}>
      <span className="pulse-city">{city.name}</span>
      <time className="pulse-time" suppressHydrationWarning>{now ? CLOCK_FORMATS[index].format(now) : '– – : – –'}</time>
      <span className="pulse-day">{now ? DAY_FORMATS[index].format(now) : 'Local time'}</span>
    </div>)}
  </div>;
}
const WATCHED = [
  { label: 'S&P 500', category: 'Equities' },
  { label: 'Nifty 50', category: 'Equities' },
  { label: 'DFM General', category: 'Equities' },
  { label: 'Brent crude', category: 'Energy' },
  { label: 'Gold', category: 'Commodities' },
  { label: 'USD/INR', category: 'Currencies' },
] as const;
export default function GlobalPulse() {
  return <section className="global-pulse" aria-label="Global clocks and market pulse">
    <div className="container">
      <div className="pulse-heading"><span>GLOBAL CLOCK</span><span className="pulse-note">Local market times · Automatically adjusts for daylight saving</span></div>
      <ClockStrip />
      <div className="pulse-market">
        <div className="pulse-market-title"><strong>MARKETS PULSE</strong><span>Indicative watchlist · Live feed not yet connected</span></div>
        <div className="pulse-instruments">{WATCHED.map(item => <span className="pulse-instrument" key={item.label}>
          <b>{item.label}</b><small>{item.category}</small><em>Feed pending</em>
        </span>)}</div>
      </div>
    </div>
  </section>;
}
