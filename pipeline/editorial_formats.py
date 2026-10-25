"""Daily cross-desk assessment and weekly synthesis. Stage only; never build or send."""
import datetime as dt
import json
import os
import re
import time
from collections import defaultdict
from zoneinfo import ZoneInfo
from pipeline import regional_release as release

PREFIX = 'V2_EDITORIAL_FORMAT:'
KINDS = ('Cross-Desk', 'Briefing', 'Long Read')
TERMINAL = {'staged', 'held', 'no_connection'}
TZ = ZoneInfo('Asia/Dubai')


def periods(edition):
    day = dt.date.fromisoformat(edition)
    monday = day - dt.timedelta(days=day.weekday())
    return {'Cross-Desk': (day, day),
            'Briefing': (monday-dt.timedelta(days=7), monday-dt.timedelta(days=1)),
            'Long Read': (monday-dt.timedelta(days=7), monday-dt.timedelta(days=1))}


def stamp(page):
    note = release.text(page, 'Internal Note').split('\n', 1)[0]
    for marker in (release.RELEASED, release.PENDING):
        if note.startswith(marker):
            try:
                state = json.loads(note[len(marker):])
                if state.get('policy') == release.POLICY['version']:
                    return state.get('edition')
            except (ValueError, TypeError):
                return None
    value = page.get('created_time', '')
    try:
        return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(TZ).date().isoformat()
    except (ValueError, TypeError):
        return None


def inputs(api, start, end, edition):
    rows = api.query({'property': 'Content Type', 'select': {'equals': 'Signal'}})
    found = {}
    for page in rows:
        p = page.get('properties', {})
        if page.get('archived') or page.get('in_trash'):
            continue
        ready = p.get('Ready to Post', {}).get('checkbox') is True
        if not ready and release.pending(page, edition) is None:
            continue
        day = stamp(page)
        if not day or not start.isoformat() <= day <= end.isoformat():
            continue
        title, body, sources = [release.text(page, name) for name in ('Name','Signal Brief','Text 1')]
        if not title or title.startswith(('[SYSTEM]', '[TEST', '[DUPLICATE')) or not body or not urls(sources):
            continue
        target = page['id']
        if not ready:
            state = release.pending(page, edition)
            target = state.get('target') or target
        # A staged update supersedes its public original only in this private input set.
        entry = {'id': target, 'title': title, 'body': body, 'sources': sources,
                 'desk': (p.get('Category', {}).get('select') or {}).get('name', ''),
                 'date': day, 'staged': not ready}
        if target not in found or entry['staged']:
            found[target] = entry
    return sorted(found.values(), key=lambda e: (e['date'], e['desk'], e['id']))


def urls(value):
    return list(dict.fromkeys(u.rstrip('.,;') for u in re.findall(r'https://[^\s<>"\]]+', value)))


def balanced(rows, limit=100):
    buckets = defaultdict(list)
    for row in rows:
        buckets[(row['date'], row['desk'])].append(row)
    chosen = []
    while buckets and len(chosen) < limit:
        for key in sorted(list(buckets)):
            chosen.append(buckets[key].pop(0))
            if not buckets[key]:
                del buckets[key]
            if len(chosen) == limit:
                break
    return chosen


def generate(editor, kind, rows, start, end, total):
    count = {'Cross-Desk': 2, 'Briefing': 4, 'Long Read': 8}[kind]
    instructions = f"""Write NavvyaSignal's {kind} from the supplied approved reporting.
There are FOUR regional desks: {', '.join(editor.DESKS)}.
Historical topic-desk labels in older source records are provenance, not active desks.
Choose a geographically justified primary desk and related desks from those four only.
Coverage period: {start} through {end}, inclusive. Source dates are authoritative.
Use only supplied documented facts; do not invent events, figures, sources or causal links.
Separate sourced facts, attributed claims, analysis, and uncertainty. No new research in this draft.
A Cross-Desk must connect at least two regional desks in a substantive, supported way.
If there is no publishable connection or sufficiently supported topic, return {{"has_report":false}}.
Weekly Briefing summarizes patterns and limits of the completed Monday-Sunday week, not a rolling week.
Long Read examines one supported question in depth rather than stretching a short news summary.
Only {len(rows)} of {total} eligible source records are supplied; their dates are {sorted(set(e['date'] for e in rows))}.
When coverage is incomplete, explicitly describe its limits; never imply a comprehensive week.
Output ONLY JSON with has_report:true, title (precise, factual), primary_desk, related_desks,
paragraphs (exactly {count} plain-prose paragraphs, each at most 750 characters),
source_ids (1 to 8 distinct IDs copied exactly from supplied source records).
Do not output Markdown, headings or invented citations. The final paragraph states supported implications and limitations."""
    from anthropic import APIConnectionError, APITimeoutError, InternalServerError, RateLimitError
    model = os.environ.get('V2_EDITORIAL_MODEL', 'claude-sonnet-4-5')
    for attempt in range(3):
        try:
            with editor.client.messages.stream(model=model, max_tokens=8000,
                    system=instructions, messages=[{'role':'user','content':json.dumps(rows, ensure_ascii=False)}]) as stream:
                response = stream.get_final_message()
            break
        except (APIConnectionError, APITimeoutError, InternalServerError, RateLimitError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
    output = '\n'.join(b.text for b in response.content if b.type == 'text')
    return json.loads(output[output.index('{'):output.rindex('}')+1])


def draft(data, rows, kind, start, end, editor):
    if data.get('has_report') is False:
        return None
    if data.get('has_report') is not True:
        raise ValueError('Missing explicit editorial outcome')
    paragraphs = data.get('paragraphs')
    count = {'Cross-Desk': 2, 'Briefing': 4, 'Long Read': 8}[kind]
    if (not isinstance(paragraphs, list) or len(paragraphs) != count
            or any(not isinstance(p, str) or not p.strip() or len(p) > 4000 for p in paragraphs)
            or any(label in p.lower() for p in paragraphs for label in ('##','**','what happened:','why it matters:'))):
        raise ValueError('Editorial paragraphs do not meet the requested format')
    title = data.get('title')
    if not isinstance(title, str) or not 0 < len(title) <= 300:
        raise ValueError('Invalid editorial title')
    desk = data.get('primary_desk')
    related = data.get('related_desks')
    if desk not in editor.DESKS or not isinstance(related, list) or any(d not in editor.DESKS for d in related):
        raise ValueError('Editorial regional classification unresolved')
    involved = set(related + [desk])
    if kind == 'Cross-Desk' and len(involved) < 2:
        raise ValueError('Cross-desk report does not establish two regional desks')
    by_id = {e['id']:e for e in rows}
    ids = data.get('source_ids')
    if (not isinstance(ids, list) or not 1 <= len(ids) <= 8 or len(set(ids)) != len(ids)
            or any(i not in by_id for i in ids)):
        raise ValueError('Editorial citations are not supplied source records')
    citations = list(dict.fromkeys(urls(by_id[i]['sources'])[0] for i in ids))
    sources = '\n'.join(citations)
    if len(sources) > 1900:
        raise ValueError('Editorial source list exceeds review format; not truncated')
    if kind == 'Briefing':
        title = f'Weekly Briefing — {start.isoformat()} to {end.isoformat()}'
    return {'title':title, 'body_markdown':'\n\n'.join(p.strip() for p in paragraphs),
            'sources_text':sources, 'desk':desk, 'desk_ambiguous':False,
            'action':'create', 'existing_id':None, 'coverage_theme':[],
            'related_desks':sorted(involved-{desk}), 'watchlist':False,
            'watch_trigger':'', 'next_review':'', 'content_type':kind,
            'notes':f'{kind}; coverage {start} to {end}; source IDs: '+','.join(ids)}


def review(editor, entry):
    """Review each two-paragraph section without compressing a long-form article into a Signal."""
    paragraphs = entry['body_markdown'].split('\n\n')
    reviewed, sources, title = [], [], entry['title']
    for index in range(0, len(paragraphs), 2):
        section = dict(entry, body_markdown='\n\n'.join(paragraphs[index:index+2]),
                       full_draft=entry, notes=entry['notes']+f'; section {index//2+1}')
        result = editor.verify_with_gemini_loop({'notion_entries':[section]})
        if not result['notion_entries']:
            return None
        checked = result['notion_entries'][0]
        if checked.get('desk') != entry['desk'] or checked.get('action') != 'create':
            raise ValueError('Editorial identity changed during review')
        reviewed.append(checked['body_markdown'])
        sources.extend(urls(checked['sources_text']))
        if index == 0:
            title = checked['title']
    return dict(entry, title=title, body_markdown='\n\n'.join(reviewed),
                sources_text='\n'.join(dict.fromkeys(sources)))


def stage(api, entry, key, edition, start, end, total, supplied):
    metadata = {'key':key,'format':entry['content_type'],'edition':edition,
                'period_start':start.isoformat(),'period_end':end.isoformat(),
                'source_count':total,'supplied_count':supplied}
    note = PREFIX+json.dumps(metadata, separators=(',',':'))+'\n'+entry['notes']
    properties = {'Name':{'title':release.rich(entry['title'])},
        'Category':{'select':{'name':entry['desk']}},
        'Signal Brief':{'rich_text':release.rich(entry['body_markdown'])},
        'Text 1':{'rich_text':release.rich(entry['sources_text'])},
        'Content Type':{'select':{'name':entry['content_type']}},
        'Long Read':{'checkbox':entry['content_type']=='Long Read'},
        'Related Desks':{'multi_select':[{'name':d} for d in entry['related_desks']]},
        'Ready to Post':{'checkbox':False}, "Today's Intelligence":{'checkbox':False},
        'Internal Note':{'rich_text':release.rich(release.pending_note(note, edition=edition))}}
    return api.call('/pages','POST',{'parent':{'type':'data_source_id','data_source_id':api.source},
                                   'properties':properties})['id']


def run(edition, api=None, editor=None, retry_technical=False):
    day = dt.date.fromisoformat(edition)
    if day.isoformat() != edition or day > dt.datetime.now(TZ).date():
        raise ValueError('Invalid editorial edition')
    if os.environ.get('DRY_RUN','true').lower() == 'true':
        print('DRY RUN: editorial assessments only; no provider calls, writes, builds or sends')
        return {}
    if api is None:
        api = release.Notion()
    if editor is None:
        from pipeline import main as editor
    os.environ['V2_EDITION_DATE'] = edition
    editor.RUN_TYPE = 'editorial_formats'
    results = {}
    for kind, (start, end) in periods(edition).items():
        key = f'editorial-formats-v1/{kind}/{start}/{end}'
        ledger, state = api.ledger(key)
        if (retry_technical and state.get('status') == 'held' and state.get('error_type') == 'ValueError'
                and not state.get('completed_at') and not state.get('page_id')):
            # The first rollout classified pre-review generation failures as holds.
            # Reconcile only its exact technical placeholder, never an editorially rejected draft.
            placeholders = api.query({'and':[
                {'property':'Name','title':{'equals':kind+' generation unavailable — '+edition}},
                {'property':'Ready to Post','checkbox':{'equals':False}}]})
            if any(release.text(p,'Signal Brief') == 'No report was approved. Editorial generation requires manual attention.'
                   and release.text(p,'Internal Note').startswith('V2_UNVERIFIED_SIGNAL:') for p in placeholders):
                state.update(status='failed',legacy_technical_recovery=True)
        if state.get('status') in TERMINAL:
            results[kind] = state['status']
            print('EDITORIAL EXISTING: '+json.dumps({'format':kind,'status':state['status']}), flush=True)
            continue
        state.update(format=kind, edition=edition, period_start=str(start), period_end=str(end))
        entry = None
        raw = None
        phase = 'input'
        try:
            # Reconcile an interrupted write before spending on another model call.
            matches = api.query({'and':[
                {'property':'Internal Note','rich_text':{'contains':PREFIX}},
                {'property':'Internal Note','rich_text':{'contains':'"key":"'+key+'"'}}]})
            if len(matches) > 1:
                raise ValueError('Duplicate editorial drafts; manual reconciliation required')
            if matches:
                state.update(status='staged', page_id=matches[0]['id'])
            else:
                rows = inputs(api, start, end, edition)
                chosen = balanced(rows)
                state.update(source_count=len(rows), supplied_count=len(chosen))
                if not chosen:
                    state['status'] = 'no_inputs'
                elif kind == 'Cross-Desk' and len({r['desk'] for r in chosen if r['desk'] in editor.DESKS}) < 2:
                    state['status'] = 'no_connection'
                else:
                    phase = 'generation'
                    raw = generate(editor, kind, chosen, start, end, len(rows))
                    if not isinstance(raw,dict):
                        raise ValueError('Editorial response must be a JSON object')
                    state['draft_shape'] = {
                        'keys':sorted(raw) if isinstance(raw,dict) else [],
                        'paragraph_count':len(raw.get('paragraphs',[])) if isinstance(raw.get('paragraphs'),list) else None,
                        'max_paragraph_length':max((len(p) for p in (raw.get('paragraphs') or []) if isinstance(p,str)),default=0),
                        'source_id_count':len(raw.get('source_ids',[])) if isinstance(raw.get('source_ids'),list) else None}
                    phase = 'validation'
                    entry = draft(raw, chosen, kind, start, end, editor)
                    if entry is None:
                        state['status'] = 'no_connection'
                    else:
                        phase = 'review'
                        checked = review(editor, entry)
                        if checked is None:
                            state['status'] = 'held'
                        else:
                            phase = 'write'
                            state.update(status='staged',page_id=stage(api,checked,key,edition,start,end,len(rows),len(chosen)))
            state['completed_at'] = dt.datetime.now(dt.timezone.utc).isoformat()
        except (Exception, SystemExit) as error:
            # Report safe error classes, retain any complete draft privately, and continue other formats.
            state.update(status='failed',error_type=type(error).__name__,error_phase=phase,
                         error_reason=str(error)[:300] if isinstance(error,ValueError) else type(error).__name__)
            if entry is None:
                entry = {'title':kind+' generation unavailable — '+edition, 'body_markdown':'No report was approved. Editorial generation requires manual attention.',
                         'sources_text':'', 'content_type':kind, 'original_draft':raw}
            if entry is not None:
                editor.save_unverified_signal(entry,'Editorial format incomplete at '+phase+': '+state['error_reason']+'; available draft output retained privately.')
                if phase == 'review':
                    state['status'] = 'held'
            state['completed_at'] = dt.datetime.now(dt.timezone.utc).isoformat()
            print('EDITORIAL ERROR: '+json.dumps({'format':kind,'phase':phase,'reason':state['error_reason'],'shape':state.get('draft_shape')}), flush=True)
        api.save_ledger(ledger,state)
        results[kind] = state['status']
        print('EDITORIAL FORMAT RESULT: '+json.dumps(state), flush=True)
    return results


if __name__ == '__main__':
    outcome = run(os.environ.get('V2_EDITION_DATE') or dt.datetime.now(TZ).date().isoformat())
    if any(status in {'held','failed','no_inputs'} for status in outcome.values()):
        raise SystemExit('Some editorial formats remain unpublished; inspect private queue and audit ledger')
