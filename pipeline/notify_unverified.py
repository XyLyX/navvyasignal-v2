"""Retry unsent private alerts at release time; never review or approve a draft."""
import os
try:
    from pipeline.regional_release import Notion, text
    from pipeline.queue_notifications import notify_private_draft
except ImportError:
    from regional_release import Notion, text
    from queue_notifications import notify_private_draft


def run():
    if os.environ.get('DRY_RUN','true').lower()=='true':
        print('Dry run: private alerts suppressed');return
    api=Notion();errors=0
    pages=api.query({'and':[{'property':'Ready to Post','checkbox':{'equals':False}},
        {'property':'Internal Note','rich_text':{'starts_with':'V2_UNVERIFIED_SIGNAL:'}}]})
    for page in pages:
        entry={'title':text(page,'Name'),'desk':(page['properties'].get('Category',{}).get('select') or {}).get('name','Unconfirmed')}
        try:notify_private_draft(page['id'],entry,text(page,'Internal Note'),api.headers)
        except Exception as error:
            errors+=1;print('Private alert failed: '+type(error).__name__)
    if errors:raise RuntimeError('One or more private alerts failed; drafts remain private')

if __name__=='__main__':run()
