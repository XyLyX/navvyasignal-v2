# V2.3 legacy article audit — 24 September 2026

Source: read-only query of the Notion Signal Feed data source (`35b11486-b145-80ac-891f-000bd4c62627`) and inspection of an individual historical page. No Notion records were changed.

Among 644 `Ready to Post` records, 642 have a nonempty `Signal Brief` and 575 have nonempty `Text 1`. `Text 1` is the legacy editorial-body field where present; it sometimes uses `<br>` separators. It is not safe to assume that every record has a complete article. The individual Notion page may also contain content blocks such as source statements, but these are not represented in the existing bulk data-source adapter. The V2.3 preview deliberately displays `Text 1` as plain text with paragraph breaks and does not silently add page blocks or internal notes. Where `Text 1` is absent, it explicitly labels the `Signal Brief` as a brief, not a full article.

The data source has no dedicated original-publication-date field. `created_time` is a Notion record creation timestamp, not proof of original publication. Historical pages label this date accordingly. Do not invent a publication date or import the Notion record creation date into a publication-date metadata field. Legacy Framer URL reconciliation remains pending.

The new `/signals/[id]` route uses the existing Notion page UUID as its stable preview identifier and generates static paths only for approved records. It is deliberately labeled historical and remains under the V2 preview's global `noindex` metadata. A fresh static deployment is needed for new approved records or changed text. A V2-only build must be checked for time and memory with the expanded route count before any merge.

Today's Intelligence remains empty until newly approved, correctly dated editorial selections arrive. No historical record is promoted to the current homepage. The V2 refresh workflow remains staged and inactive.
