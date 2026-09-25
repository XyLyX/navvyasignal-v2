# Arabic edition: editorial publication policy (V2)

Status: implementation groundwork; no Arabic news article is approved for publication.

## Editorial rule
Arabic is an independently edited edition, not an automated translation of English. Editors write Arabic headlines, decks and article bodies in idiomatic Modern Standard Arabic suitable for a UAE and wider Arabic-speaking readership. Preserve the meaning and evidence of the source reporting without copying English sentence structure. Review transliterations, official Arabic names, quotations, dates, currencies, figures, uncertainty, attribution and geopolitical terminology. Avoid literal calques, machine-translation residue and English-first syntax.

## Publication gate
An Arabic article must have: source Notion story UUID or original editorial identifier; an independently written Arabic title, deck and body; an explicit Arabic editorial approval; reviewer and approval date; a verified Arabic publication date; and checked source links. Never generate an Arabic article automatically from an approved English story. A missing approved Arabic edition produces no /ar article route and no Arabic headline card; link to the English original with an English-language disclosure instead.

## Architecture
- English story remains the canonical source record; Arabic copy is a separately approved editorial edition, linked by immutable story ID.
- Once approved Arabic articles exist, store them in an explicit, read-only approved Arabic collection or checked-in editorial files. Do not overload English Notion Text 1 or infer Arabic readiness from Ready to Post.
- Build /ar/signals/[id] only for records passing the Arabic approval gate. No automatic machine translation or fabricated placeholder text.
- Add /ar/desks/[slug] only when its navigation and content are fully Arabic; until then, the /ar landing page labels links to existing English desks.
- Arabic pages use lang=ar and dir=rtl on the page/document; English pages use lang=en and dir=ltr. At present the /ar page is RTL-scoped inside the English root document. Document-level locale requires a routing/layout refactor before production.
- Only published paired pages receive reciprocal hreflang=ar/en and self-referencing canonical URLs. Do not claim Arabic equivalents exist when they do not.
- Review Arabic text on mobile, Arabic search/input, bidirectional numerals/URLs, screen readers and RTL keyboard focus before production.

## Current scope
The Arabic landing page and navigation switch are implemented on notion-readonly. The Arabic reporting collection, article routes and Arabic editorial approval process are NOT operational. Preview stays noindex; no production deploy or merge is authorized.
