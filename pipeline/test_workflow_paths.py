"""Regression checks for scripts resolved relative to workflow working directories."""
from pathlib import Path
import unittest


class DeliveryWorkflowPathTests(unittest.TestCase):
    def test_desk_receives_required_data_source(self):
        root=Path(__file__).resolve().parents[1]
        for filename,step in [('v2-editorial-pipeline.yml','Research, verify and stage for 09:00'),('v2-manual-desk.yml','Publish selected desk to Notion')]:
            workflow=(root/'.github/workflows'/filename).read_text()
            block=workflow.split('- name: '+step,1)[1]
            self.assertIn('NOTION_DATA_SOURCE_ID:',block)
            self.assertIn('secrets.NOTION_DATA_SOURCE_ID',block)

    def test_verify_script_resolves_from_pipeline_working_directory(self):
        root=Path(__file__).resolve().parents[1]
        workflow=(root/'.github/workflows/v2-daily-send.yml').read_text()
        block=workflow.split('- name: Verify release before delivery',1)[1].split('- name:',1)[0]
        command=next(line.strip()[5:] for line in block.splitlines() if line.strip().startswith('run: '))
        self.assertTrue(command.startswith('python '))
        script=command.split()[1]
        self.assertTrue((root/'pipeline'/script).is_file(), 'Workflow verification script must resolve from its configured working directory')

    def test_compile_guard_receives_data_source_without_exposing_credentials(self):
        root=Path(__file__).resolve().parents[1]
        workflow=(root/'.github/workflows/v2-daily-send.yml').read_text()
        block=workflow.split('- name: Compile and send one daily edition',1)[1]
        self.assertIn('NOTION_DATA_SOURCE_ID:',block)
        self.assertIn('secrets.NOTION_DATA_SOURCE_ID',block)
