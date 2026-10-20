"""09:00 Dubai publication gate. No research, model calls or public sends.

Approval and publication are distinct. Only explicitly staged approval markers are released.
A Notion ledger survives runners and prevents a timed-out build being blindly requested again.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import re
from pathlib import Path
from zoneinfo import ZoneInfo
import requests

POLICY = json.loads((Path(__file__).resolve().parents[1] /
    'navvyasignal-v2-starter/src/lib/regional-policy.json').read_text())
PENDING = 'V2_RELEASE_PENDING:'
RELEASED = 'V2_RELEASED:'
LEDGER = 'V2_RELEASE_LEDGER:'
TZ = ZoneInfo(POLICY['timezone'])
DESKS = {d['notion'] for d in POLICY['desks']}


def next_release(now=None):
    local = (now or dt.datetime.now(TZ)).astimezone(TZ)
    date = local.date()
    if local.time() >= dt.time(9):
        date += dt.timedelta(days=1)
    return date.isoformat()


def pending_note(note='', target=None, edition=None):
    state = {'policy': POLICY['version'], 'edition': edition or next_release(),
             'approved': True, 'target': target}
    return PENDING + json.dumps(state, separators=(',', ':')) + '\n' + note


def text(page, name):
    p = page.get('properties', {}).get(name, {})
    return ''.join(t.get('plain_text', t.get('text', {}).get('content', ''))
                   for t in p.get('title', p.get('rich_text', [])))


def rich(value):
    if len(value) > 190000:
        raise ValueError('Release note exceeds storage limit')
    return [{'text': {'content': value[i:i+1900]}} for i in range(0, len(value), 1900)]


def pending(page, edition):
    if page.get('archived') or page.get('in_trash'):
        return None
    if page.get('properties', {}).get('Ready to Post', {}).get('checkbox') is not False:
        return None
    line = text(page, 'Internal Note').split('\n', 1)[0]
    if not line.startswith(PENDING):
        return None
    try:
        state = json.loads(line[len(PENDING):])
        date = dt.date.fromisoformat(state['edition']).isoformat()
    except (ValueError, KeyError, TypeError):
        raise ValueError('Malformed scheduled approval; manual review required')
    desk = (page.get('properties', {}).get('Category', {}).get('select') or {}).get('name')
    if state.get('policy') != POLICY['version'] or state.get('approved') is not True or desk not in DESKS:
        return None
    return state if date <= edition else None


class Notion:
    def __init__(self):
        missing = [key for key in ('NOTION_DATA_SOURCE_ID','NOTION_API_KEY') if not os.environ.get(key,'').strip()]
        if missing:
            raise RuntimeError('Missing required configuration: '+', '.join(missing))
        self.source = os.environ['NOTION_DATA_SOURCE_ID'].strip()
        self.headers = {'Authorization': 'Bearer ' + os.environ['NOTION_API_KEY'].strip(),
                        'Notion-Version': '2025-09-03', 'Content-Type': 'application/json'}

    def call(self, path, method='GET', body=None):
        r = requests.request(method, 'https://api.notion.com/v1'+path,
                             headers=self.headers, json=body, timeout=30)
        if r.status_code not in (200, 201):
            raise RuntimeError('Release Notion operation failed: HTTP '+str(r.status_code))
        return r.json()

    def query(self, filter):
        pages, cursor, seen = [], None, set()
        for _ in range(500):
            q = {'page_size': 100, 'filter': filter}
            if cursor: q['start_cursor'] = cursor
            data = self.call('/data_sources/'+self.source+'/query', 'POST', q)
            pages.extend(data['results'])
            if not data.get('has_more'): return pages
            cursor = data.get('next_cursor')
            if not cursor or cursor in seen: raise RuntimeError('Invalid release pagination')
            seen.add(cursor)
        raise RuntimeError('Release pagination safety ceiling exceeded')

    def ensure_schema(self):
        source = self.call('/data_sources/'+self.source)
        changes = {}
        for name,kind in [('Category','select'),('Related Desks','multi_select')]:
            prop = source.get('properties',{}).get(name,{})
            if prop.get('type') != kind:
                raise RuntimeError('Signal Feed '+name+' schema is incompatible')
            existing = prop[kind].get('options',[])
            missing = [d['notion'] for d in POLICY['desks'] if d['notion'] not in {o['name'] for o in existing}]
            if missing:
                changes[name] = {kind:{'options':[{'id':o['id'],'name':o['name'],'color':o.get('color','default')} for o in existing]+[{'name':n} for n in missing]}}
        if changes: self.call('/data_sources/'+self.source,'PATCH',{'properties':changes})

    def patch(self, id, body):
        return self.call('/pages/'+id, 'PATCH', body)

    def ledger(self, key):
        marker = LEDGER + key + '\n'
        found = self.query({'property': 'Internal Note', 'rich_text': {'starts_with': marker}})
        if len(found) > 1: raise RuntimeError('Duplicate release ledgers; inspect before continuing')
        if found:
            return found[0], json.loads(text(found[0], 'Internal Note').split('\n', 1)[1])
        state = {'phase': 'staging', 'key': key}
        page = self.call('/pages', 'POST', {'parent': {'type':'data_source_id','data_source_id':self.source},
            'properties': {'Name': {'title': rich('[SYSTEM] '+key)},
                           'Ready to Post': {'checkbox': False},
                           'Internal Note': {'rich_text': rich(marker+json.dumps(state))}}})
        return page, state

    def save_ledger(self, page, state):
        self.patch(page['id'], {'properties': {'Internal Note': {'rich_text': rich(
            LEDGER+state['key']+'\n'+json.dumps(state, separators=(',', ':')))}}})


def release_page(api, page, edition):
    """Never interpret an unverified draft or arbitrary unchecked page as approved."""
    fresh = api.call('/pages/'+page['id'])
    state = pending(fresh, edition)
    if state is None: return None
    props = fresh['properties']
    note = text(fresh, 'Internal Note').split('\n', 1)
    stamp = RELEASED+json.dumps({'edition':edition,'policy':POLICY['version']})
    public = {'Ready to Post': {'checkbox': True},
              'Internal Note': {'rich_text': rich(stamp+'\n'+(note[1] if len(note)>1 else ''))}}
    target = state.get('target')
    if target:
        if not re.fullmatch(r'[a-f0-9-]{32,36}', target): raise ValueError('Invalid staged update target')
        original = api.call('/pages/'+target)
        source = (original.get('parent', {}).get('data_source_id') or '').replace('-', '')
        if source != api.source.replace('-', '') or original.get('archived') or original.get('in_trash'):
            raise ValueError('Staged target is outside Signal Feed or deleted')
        for name in ('Name','Category','Signal Brief','Text 1','Content Type','Long Read',
                     'Coverage Theme','Related Desks','Watchlist','Watch Status','Watch Trigger','Next Review'):
            if name in props:
                prop = props[name]; kind = prop.get('type')
                if kind in ('title','rich_text'):
                    public[name] = {kind: rich(text(fresh, name))}
                elif kind in ('select','multi_select','checkbox','date','number'):
                    value = prop[kind]
                    if kind == 'select' and value: value = {'name':value['name']}
                    if kind == 'multi_select': value = [{'name':v['name']} for v in value]
                    public[name] = {kind:value}
        api.patch(target, {'properties':public})
        api.patch(fresh['id'], {'in_trash':True})
        return target
    api.patch(fresh['id'], {'properties':public})
    return fresh['id']


def select_homepage(api, edition):
    """Deterministic regional representation; no extra paid selection or synthesis."""
    pages = api.query({'property':'Ready to Post','checkbox':{'equals':True}})
    candidates = []
    for p in pages:
        if (p['properties'].get('Content Type',{}).get('select') or {}).get('name') in ('Cross-Desk','Briefing','Long Read'):
            continue
        note = text(p,'Internal Note').split('\n',1)[0]
        if not note.startswith(RELEASED): continue
        try: state = json.loads(note[len(RELEASED):])
        except ValueError: raise ValueError('Malformed release record')
        if state.get('edition') == edition and (p['properties'].get('Category',{}).get('select') or {}).get('name') in DESKS:
            candidates.append(p)
    candidates.sort(key=lambda p:(p['created_time'],p['id']),reverse=True)
    selected = []
    for desk in POLICY['desks']:
        choice = next((p for p in candidates if (p['properties']['Category'].get('select') or {}).get('name') == desk['notion']),None)
        if choice: selected.append(choice)
    selected.extend(p for p in candidates if p not in selected)
    selected = selected[:7]
    # Only touch this edition; prior editions remain available if no candidates exist.
    for priority,p in enumerate(selected,1):
        api.patch(p['id'], {'properties': {"Today's Intelligence":{'checkbox':True},
            'Homepage Date':{'date':{'start':edition}}, 'Homepage Priority':{'number':priority}}})
    return [p['id'] for p in candidates]


def publish_once(api, ledger, state, force_build=False):
    try:
        from pipeline import refresh_publication as refresh
    except ImportError:
        import refresh_publication as refresh
    current = refresh.fetch_entries()
    live = refresh.request('https://navvyasignal.com/publication-state')
    if live.get('version') != 1 or not isinstance(live.get('entries'),list):
        raise RuntimeError('Invalid production snapshot; no blind build')
    digest = hashlib.sha256(json.dumps(current,sort_keys=True).encode()).hexdigest()
    if live['entries'] == current and (not force_build or state.get('phase') == 'verified'):
        state.update(phase='verified',fingerprint=digest)
        api.save_ledger(ledger,state)
        print('Release verified: approved public content matches production.')
        return
    if state.get('phase') == 'verified':
        raise RuntimeError('This release already completed; new changes await next release or explicit Now action')
    if state.get('phase') != 'build_requested':
        hook = os.environ['V2_NETLIFY_BUILD_HOOK'].strip()
        if not re.fullmatch(r'https://api\.netlify\.com/build_hooks/[A-Za-z0-9]+',hook):
            raise ValueError('Invalid build hook')
        # Persist BEFORE the external side effect: ambiguous failures never blindly replay.
        state.update(phase='build_requested',fingerprint=digest)
        api.save_ledger(ledger,state)
        import urllib.request
        with urllib.request.urlopen(urllib.request.Request(hook,data=b'',method='POST'),timeout=30) as r:
            if r.status not in (200,201,202): raise RuntimeError('Build request rejected')
    elif state.get('fingerprint') != digest:
        raise RuntimeError('Content changed during pending build; reconcile before another build')
    refresh.wait_for_publication(current)
    state['phase']='verified';api.save_ledger(ledger,state)


def require_completed_desks(api, edition):
    """A matching old public snapshot is not evidence that today's research ran."""
    missing = []
    for desk in POLICY['desks']:
        marker = LEDGER+POLICY['version']+'/desk/'+edition+'/'+desk['key']+'\n'
        rows = api.query({'property':'Internal Note','rich_text':{'starts_with':marker}})
        if len(rows) != 1 or json.loads(text(rows[0],'Internal Note').split('\n',1)[1]).get('phase') != 'completed':
            missing.append(desk['key'])
    if missing:
        raise RuntimeError('Edition incomplete; desk runs not completed: '+', '.join(missing))


def run(edition=None, now=None, exceptional=False, manual_key=None, force_build=False, repair_empty=False):
    now = (now or dt.datetime.now(TZ)).astimezone(TZ)
    edition = edition or now.date().isoformat()
    if dt.date.fromisoformat(edition).isoformat()!=edition or edition>now.date().isoformat():
        raise ValueError('Invalid release edition date')
    if manual_key is not None and not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',manual_key):
        raise ValueError('Invalid explicit manual release key')
    if not exceptional and not manual_key and edition==now.date().isoformat() and now.time()<dt.time(9):
        raise ValueError('Publication cannot run before 09:00 Dubai')
    if force_build and not manual_key:
        raise ValueError('A forced code rollout requires an explicit manual release key')
    api=Notion()
    if os.environ.get('DRY_RUN','true').lower()=='true':
        pages=api.query({'property':'Ready to Post','checkbox':{'equals':False}})
        print('DRY RUN: eligible staged stories:',sum(pending(p,edition) is not None for p in pages))
        return
    api.ensure_schema()
    if not exceptional and not manual_key:
        require_completed_desks(api,edition)
    if exceptional:
        # Immediate approvals have already saved Ready to Post. Key by full public snapshot.
        try: from pipeline import refresh_publication as refresh
        except ImportError: import refresh_publication as refresh
        key=POLICY['version']+'/now/'+hashlib.sha256(json.dumps(refresh.fetch_entries(),sort_keys=True).encode()).hexdigest()
    elif manual_key: key=POLICY['version']+'/manual/'+manual_key
    else: key=POLICY['version']+'/'+edition
    ledger,state=api.ledger(key)
    if repair_empty:
        if exceptional or manual_key:
            raise ValueError('Empty-edition repair applies only to the daily release')
        if state.get('phase') == 'verified' and not state.get('entry_ids'):
            state.update(phase='staging', repaired_empty_release=True)
    if not exceptional and state['phase']=='staging':
        pages=api.query({'property':'Ready to Post','checkbox':{'equals':False}})
        for page in pages:
            if pending(page,edition): release_page(api,page,edition)
        state['entry_ids']=select_homepage(api,edition)
        if not state['entry_ids']:
            raise RuntimeError('No approved Signals for this edition; release not verified')
        state['phase']='released';api.save_ledger(ledger,state)
    publish_once(api,ledger,state,force_build=force_build)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--exceptional',action='store_true')
    args=parser.parse_args()
    run(os.environ.get('V2_EDITION_DATE') or None,exceptional=args.exceptional)
