import ast, json, os, tempfile, unittest, importlib.util
from unittest.mock import patch
from pathlib import Path
spec=importlib.util.spec_from_file_location('refresh', Path(__file__).with_name('refresh_publication.py'))
refresh=importlib.util.module_from_spec(spec); spec.loader.exec_module(refresh)
class Tests(unittest.TestCase):
 def test_only_public_fields_change_digest(self):
  page={'id':'one','created_time':'2026-10-01T00:00:00.000Z','properties':{'Name':{'title':[{'plain_text':'Café — signal'}]},'Ready to Post':{'checkbox':True}}}
  first=refresh.entry(page)
  page['properties']['Internal Note']={'rich_text':[{'plain_text':'private change'}]}
  self.assertEqual(first,refresh.entry(page))
  page['properties']['Signal Brief']={'rich_text':[{'plain_text':'new report'}]}
  self.assertNotEqual(first,refresh.entry(page))
  page['properties']['Ready to Post']['checkbox']=False
  self.assertIsNone(refresh.entry(page))
 def test_no_change_or_dry_run_never_calls_hook(self):
  for dry,current in [('false',[]),('true',[{'id':'new','digest':'abc'}])]:
   with patch.object(refresh,'fetch_entries',return_value=current),patch.object(refresh,'request',return_value={'version':1,'entries':[]}),patch.object(refresh.urllib.request,'urlopen') as hook,patch.dict(os.environ,{'DRY_RUN':dry}):
    refresh.main(); hook.assert_not_called()
 def test_invalid_manifest_fails_closed(self):
  with patch.object(refresh,'fetch_entries',return_value=[]),patch.object(refresh,'request',return_value={}):
   with self.assertRaises(ValueError):refresh.main()
 def test_marker_live_and_dry_run(self):
  tree=ast.parse(Path(__file__).with_name('main.py').read_text())
  function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='mark_publication_changed')
  namespace={'os':os,'json':json,'DRY_RUN':False,'dubai_today':lambda:'2026-10-01'}
  exec(compile(ast.Module(body=[function],type_ignores=[]),'marker','exec'),namespace)
  with tempfile.TemporaryDirectory() as d:
   previous=os.getcwd();os.chdir(d)
   try:
    with patch.dict(os.environ,{'GITHUB_OUTPUT':str(Path(d)/'output'),'GITHUB_RUN_ID':'42','GITHUB_RUN_ATTEMPT':'1'}):
     namespace['DRY_RUN']=True;namespace['mark_publication_changed']();self.assertFalse(Path('output').exists())
     namespace['DRY_RUN']=False;namespace['mark_publication_changed']();self.assertEqual(json.loads(Path('notion-stage-attempted.json').read_text())['run_id'],'42')
   finally:os.chdir(previous)
if __name__=='__main__':unittest.main()
