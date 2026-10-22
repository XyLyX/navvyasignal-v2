'use client';

import { useState } from 'react';
import type { VenturePanel } from '@/lib/networkPanels';

/** A failed upstream asset never leaves a broken-image icon in the network grid. */
export default function VentureImage({ title, image }: Pick<VenturePanel, 'title' | 'image'>) {
  const [failed, setFailed] = useState(false);
  return <div className="np-venture-art">
    {image && !failed
      ? <img src={image.src} alt={image.alt} className={`np-venture-image np-venture-image--${image.fit}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : <span className="np-venture-wordmark">{title}</span>}
  </div>;
}
