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
function ClockStrip({locale = 'en'}: {locale?: 'en' | 'ar'}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  const arabicCities = ['نيويورك','لندن','دبي','نيودلهي','سنغافورة','طوكيو'];
  const arabicDays = CITIES.map(city => new Intl.DateTimeFormat('ar-AE', {timeZone:city.zone,weekday:'short',day:'numeric',month:'short'}));
  return <div className="pulse-clocks" aria-label={locale === 'ar' ? 'التوقيت العالمي' : 'World clocks'}>
    {CITIES.map((city, index) => <div className="pulse-clock" key={city.zone}>
      <span className="pulse-city">{locale === 'ar' ? arabicCities[index] : city.name}</span>
      <time className="pulse-time">{now ? CLOCK_FORMATS[index].format(now) : '--:--'}</time>
      <span className="pulse-day">{now ? (locale === 'ar' ? arabicDays[index] : DAY_FORMATS[index]).format(now) : (locale === 'ar' ? 'التوقيت المحلي' : 'Local time')}</span>
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
function TradingViewQuote({ symbol, label, locale = 'en' }: { symbol: string; label: string; locale?: 'en' | 'ar' }) {
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
      symbol, width: '100%', isTransparent: true, colorTheme: 'dark', locale,
    });
    container.appendChild(script);
    element.appendChild(container);
    return () => { element.replaceChildren(); };
  }, [symbol]);
  return <div className="pulse-quote" aria-label={label}>
    <span className="pulse-quote-label">{label}</span>
    <div ref={host} className="pulse-quote-embed">
      <span className="pulse-quote-loading">{locale === 'ar' ? 'بيانات الأسعار من TradingView' : 'Quote provided by TradingView'}</span>
    </div>
  </div>;
}
export default function GlobalPulse({locale = 'en'}: {locale?: 'en' | 'ar'}) {
  const ar = locale === 'ar';
  const arabicMarkets = ['صندوق مؤشر إس آند بي 500','بيتكوين / تيثر','خام برنت','الذهب الفوري','مؤشر سينسكس'];
  return <section className="global-pulse" aria-label={ar ? "التوقيت العالمي ونبض الأسواق" : "Global clocks and market pulse"}>
    <div className="container">
      <div className="pulse-heading"><span>{ar ? 'التوقيت العالمي' : 'GLOBAL CLOCK'}</span><span className="pulse-note">{ar ? 'التوقيت المحلي · تعديل التوقيت الصيفي تلقائياً' : 'Local times · Daylight-saving adjustments automatic'}</span></div>
      <ClockStrip locale={locale} />
      <div className="pulse-market">
        <div className="pulse-market-title"><strong>{ar ? 'نبض الأسواق' : 'MARKETS PULSE'}</strong><span>{ar ? 'أسعار TradingView · قد تتأخر بيانات البورصات' : 'TradingView quotes · Exchange delays may apply'}</span></div>
        <div className="pulse-instruments">{MARKETS.map((item,index) =>
          <TradingViewQuote key={item.symbol} symbol={item.symbol} label={ar ? arabicMarkets[index] : item.label} locale={locale} />
        )}</div>
        <p className="pulse-disclosure">{ar ? 'بيانات مقدمة من TradingView، وقد تتأخر أو لا تتوافر. يُرجى الرجوع إلى البورصة المعنية للتحقق من توقيت الأسعار. ليست نصيحة استثمارية.' : 'Third-party TradingView embeds. Quotes may be delayed or unavailable; check the source exchange and TradingView for data timing. Not investment advice.'}</p>
      </div>
    </div>
  </section>;
}
