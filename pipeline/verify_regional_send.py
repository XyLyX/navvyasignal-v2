"""Read-only guard: never send an edition that has not been verified on production."""
import os
try:
    from pipeline.regional_release import Notion, POLICY
    from pipeline import refresh_publication as refresh
except ImportError:
    from regional_release import Notion, POLICY
    import refresh_publication as refresh


def check():
    import datetime as dt
    from zoneinfo import ZoneInfo
    local=dt.datetime.now(ZoneInfo('Asia/Dubai'))
    edition=os.environ.get('V2_SEND_EDITION_DATE') or (local.date()-dt.timedelta(days=local.hour<10)).isoformat()
    api=Notion()
    records=api.query({'property':'Internal Note','rich_text':{'starts_with':
        'V2_RELEASE_LEDGER:'+POLICY['version']+'/'+edition+'\n'}})
    import json
    try:
        from pipeline.regional_release import text
    except ImportError:
        from regional_release import text
    if len(records)!=1 or json.loads(text(records[0],'Internal Note').split('\n',1)[1]).get('phase')!='verified':
        raise RuntimeError('Daily Brief withheld: intended edition has no verified release')
    live=refresh.request('https://navvyasignal.com/publication-state')
    if live.get('version')!=1 or live.get('entries')!=refresh.fetch_entries():
        raise RuntimeError('Daily Brief withheld: approved content does not match production')
    print('Verified regional edition eligible for delivery: '+edition)

if __name__=='__main__':check()
