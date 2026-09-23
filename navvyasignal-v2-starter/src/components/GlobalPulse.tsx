'use client';
import { useEffect, useRef, useState } from 'react';

const CITIES = [
  { name: 'New York', zone: 'America/New_York' },
  { name: 'London', zone: 'Europe/London' },
  { name: 'Dubai', zone: 'Asia/Dubai' },
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
      <time className="pulse-time">{now ? CLOCK_FORMATS[index].format(now) : '--:--'}</time>
      <span className="pulse-day">{now ? DAY_FORMATS[index].format(now) : 'Local time'}</span>
    </div>)}
  </div>;
}
const MARKETS = [
  { symbol: 'AMEX:SPY', label: 'S&P 500 ETF (SPY)' },
  { symbol: 'BINANCE:BTCUSDT', label: 'Bitcoin / USDT' },
  { symbol: 'TVC:UKOIL', label: 'Brent crude oil' },
  { symbol: 'TVC:GOLD', label: 'Gold spot' },
  { symbol: 'BSE:SENSEX', label: 'BSE Sensex' },
] as const;
function TradingViewQuote({ symbol, label }: { symbol: string; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    container.appendChild(widget);
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js';
    script.type = 'text/javascript';
    script.async = true;
    script.textContent = JSON.stringify({
      symbol, width: '100%', isTransparent: true, colorTheme: 'dark', locale: 'en',
    });
    container.appendChild(script);
    element.appendChild(container);
    return () => { element.replaceChildren(); };
  }, [symbol]);
  return <div className="pulse-quote" aria-label={label}>
    <span className="pulse-quote-label">{label}</span>
    <div ref={host} className="pulse-quote-embed">
      <span className="pulse-quote-loading">Quote provided by TradingView</span>
    </div>
  </div>;
}
export default function GlobalPulse() {
  return <section className="global-pulse" aria-label="Global clocks and market pulse">
    <div className="container">
      <div className="pulse-heading"><span>GLOBAL CLOCK</span><span className="pulse-note">Local times · Daylight-saving adjustments automatic</span></div>
      <ClockStrip />
      <div className="pulse-market">
        <div className="pulse-market-title"><strong>MARKETS PULSE</strong><span>TradingView quotes · Exchange delays may apply</span></div>
        <div className="pulse-instruments">{MARKETS.map(item =>
          <TradingViewQuote key={item.symbol} symbol={item.symbol} label={item.label} />
        )}</div>
        <p className="pulse-disclosure">Third-party TradingView embeds. Quotes may be delayed or unavailable; check the source exchange and TradingView for data timing. Not investment advice.</p>
      </div>
    </div>
  </section>;
}
