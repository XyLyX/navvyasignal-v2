"""Explicit manual disposition, usable by Claude through the GitHub workflow."""
import argparse
import datetime as dt
import json
import os
import re
try:
    from pipeline.regional_release import Notion, POLICY, TZ, text, rich, pending_note, next_release, RELEASED
except ImportError:
    from regional_release import Notion, POLICY, TZ, text, rich, pending_note, next_release, RELEASED


def apply(api, page_id, action, resolution='', desk='', now=None):
    if not re.fullmatch(r'[a-f0-9-]{32,36}',page_id): raise ValueError('Invalid page ID')
    if action not in ('now','scheduled','delete'): raise ValueError('Choose now, scheduled or delete')
    page=api.call('/pages/'+page_id)
    source=(page.get('parent',{}).get('data_source_id') or '').replace('-','')
    if source!=api.source.replace('-','') or page.get('archived') or page.get('in_trash'):
        raise ValueError('Page is outside Signal Feed or deleted')
    note=text(page,'Internal Note')
    if not note.startswith('V2_UNVERIFIED_SIGNAL:') or page['properties'].get('Ready to Post',{}).get('checkbox') is not False:
        raise ValueError('Page is not an unverified private Signal')
    if action=='delete':
        api.patch(page_id,{'in_trash':True});return
    desk=desk or (page['properties'].get('Category',{}).get('select') or {}).get('name')
    if desk not in {d['notion'] for d in POLICY['desks']}:
        raise ValueError('Choose one of the four regional desks')
    if not resolution.strip() or not re.search(r'https://\S+',text(page,'Text 1')) or not text(page,'Name') or not text(page,'Signal Brief'):
        raise ValueError('Manual approval requires resolution, headline, brief and direct sources')
    now=(now or dt.datetime.now(TZ)).astimezone(TZ)
    audit='Manual approval '+now.isoformat()+': '+resolution+'\n'+note
    note=pending_note(audit,edition=next_release(now)) if action=='scheduled' else (
        RELEASED+json.dumps({'policy':POLICY['version'],'edition':now.date().isoformat()})+'\n'+audit)
    api.patch(page_id,{'properties':{'Category':{'select':{'name':desk}},
        'Internal Note':{'rich_text':rich(note)},'Ready to Post':{'checkbox':action=='now'}}})

if __name__=='__main__':
    apply(Notion(),os.environ['REVIEW_PAGE_ID'],os.environ['REVIEW_ACTION'],
          os.environ.get('REVIEW_RESOLUTION',''),os.environ.get('REVIEW_DESK',''))
