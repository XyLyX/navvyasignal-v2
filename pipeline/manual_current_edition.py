"""Explicit four-region research request followed by one exceptional verified site release.
Runs inside GitHub Actions with stored credentials; never pulls keys into a client.
"""
import datetime as dt
import json
import os
from pathlib import Path
try:
    from pipeline import regional_release as release
except ImportError:
    import regional_release as release


def request():
    if os.environ.get('GITHUB_EVENT_NAME') == 'push':
        value=json.loads(Path('ops/manual-edition-request.json').read_text())
        if value.get('policy')!=release.POLICY['version'] or value.get('action')!='research-and-release-now':
            raise ValueError('Not an explicit current-policy manual request')
        requested=dt.datetime.fromisoformat(value['requested_at'].replace('Z','+00:00'))
        age=(dt.datetime.now(dt.timezone.utc)-requested).total_seconds()
        if not 0<=age<86400:raise ValueError('Manual request is stale or future-dated')
        if value.get('full_recovery') is True:
            os.environ['V2_FULL_RECOVERY'] = 'true'
        resume = value.get('resume_research_run_id')
        if resume is not None:
            if value.get('full_recovery') is not True or not str(resume).isdigit():
                raise ValueError('Invalid explicit research checkpoint resume')
            os.environ['V2_RESUME_RESEARCH_RUN_ID'] = str(resume)
        return value['edition_date']
    return os.environ.get('V2_EDITION_DATE') or dt.datetime.now(release.TZ).date().isoformat()


def run(edition,run_id):
    if os.environ.get('DRY_RUN','true').lower()=='true':
        print('DRY RUN: four regional research runs, followed by one explicit release: '+edition)
        return
    try:
        from pipeline import main as editor
    except ImportError:
        import main as editor
    api=release.Notion()
    resume = os.environ.get('V2_RESUME_RESEARCH_RUN_ID')
    research_id = resume or run_id
    research_key = release.POLICY['version']+'/manual-research/'+research_id
    if resume:
        release.require_completed_desks(api,edition)
        records = api.query({'property':'Internal Note','rich_text':{'starts_with':release.LEDGER+research_key+'\n'}})
        if len(records) != 1:
            raise RuntimeError('Research checkpoint is missing or ambiguous; no research replay')
        checkpoint = json.loads(release.text(records[0],'Internal Note').split('\n',1)[1])
        if set(checkpoint.get('completed',{})) != {d['key'] for d in release.POLICY['desks']}:
            raise RuntimeError('Research checkpoint is incomplete; no blind resume')
    ledger,state=api.ledger(research_key)
    if state.get('edition') not in (None,edition):
        raise ValueError('Research checkpoint belongs to another edition')
    state['edition'] = edition
    completed=state.setdefault('completed',{})
    failures={}
    for desk in release.POLICY['desks']:
        key=desk['key']
        if key in completed:
            print('Already completed for this manual request: '+key,flush=True)
            continue
        editor.RUN_TYPE=key
        os.environ['V2_EDITION_DATE']=edition
        try:
            result=editor.run_group(key)
            completed[key]={'approved':result['entry_count'],'saved':len(result['notion_summary'])}
            api.save_ledger(ledger,state)
            print('MANUAL DESK RESULT: '+json.dumps({key:completed[key]}),flush=True)
        except (Exception,SystemExit) as error:
            failures[key]=type(error).__name__
            print('MANUAL DESK FAILED: '+key+' ('+type(error).__name__+')',flush=True)
    if not any(v.get('saved',0)>0 for v in completed.values()):
        raise RuntimeError('No fresh verified stories saved; no site release requested')
    if os.environ.get('V2_FULL_RECOVERY') == 'true':
        if failures:
            raise RuntimeError('Full recovery withheld: one or more desks failed')
        from pipeline import editorial_formats as formats
        outcome = formats.run(edition, editor=editor)
        if any(status in {'held','failed','no_inputs'} for status in outcome.values()):
            raise RuntimeError('Editorial recovery needs attention; no release or send attempted')
        release.run(edition,repair_empty=True)
        os.environ['V2_SEND_EDITION_DATE'] = edition
        editor.RUN_TYPE = 'compile_send'
        editor.main()
    else:
        release.run(edition,manual_key=run_id)
    print('MANUAL EDITION RESULT: '+json.dumps({'edition':edition,'completed':completed,'failed':failures}),flush=True)
    if failures:raise RuntimeError('Partial manual edition published; failed desks listed above')


if __name__=='__main__':
    run(request(),os.environ['GITHUB_RUN_ID'])
