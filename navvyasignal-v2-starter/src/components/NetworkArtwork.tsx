'use client';
import { useState } from 'react';
export default function NetworkArtwork({name,slug,image,siteUrl,alt=''}:{name:string;slug:string;image:string|null;siteUrl:string;alt?:string}) {
 const [failed,setFailed] = useState(false);
 const [faviconFailed,setFaviconFailed] = useState(false);
 const favicon = new URL('/favicon.ico',siteUrl).toString();
 if (image && !failed) return <img src={image} alt={alt || `${name} website artwork`} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;
 if ((slug==='d6-kitchens'||slug==='the-wasam') && !faviconFailed) return <span className="network-brand-icon"><img src={favicon} alt={`${name} website icon`} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFaviconFailed(true)}/><strong>{name}</strong></span>;
 return <span className={`network-visual-fallback network-visual-${slug}`} aria-hidden="true"><span>{name}</span></span>;
}
