"""One-time WhatsApp-only recovery for the 2026-09-29 edition."""

import os
import main


if __name__ == "__main__":
    if main.dubai_today() != "2026-09-29":
        raise SystemExit("This recovery is restricted to the 2026-09-29 Dubai edition")
    if (os.environ.get("V2_SENDER_ENABLED") != "true" or
            os.environ.get("V2_LEGACY_SENDER_DISABLED") != "true"):
        raise SystemExit("V2 sender gates are not enabled")
    if not main.NOTION_API_KEY or not main.NOTION_DATABASE_ID:
        raise SystemExit("Notion credentials are required")
    if not main.WHAPI_TOKEN or not main.WHAPI_CHANNEL_ID:
        raise SystemExit("Whapi credentials are required")
    entries = main.fetch_todays_entries_for_compile()
    if not entries:
        raise SystemExit("No approved Signals for the current Dubai edition")
    edition = main.assemble_daily_send(entries)
    main.log(f"WhatsApp-only recovery: {len(entries)} approved Signals; no Kit call")
    main.send_whapi(edition["whatsapp_text"])
