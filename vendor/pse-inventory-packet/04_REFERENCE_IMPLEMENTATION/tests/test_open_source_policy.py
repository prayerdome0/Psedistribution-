import csv
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

class OpenSourcePolicyTests(unittest.TestCase):
    def test_open_source_policy_file_exists(self):
        self.assertTrue((ROOT / '05_INTEGRATION/00_NO_PROPRIETARY_AI_AND_OPEN_SOURCE_POLICY.md').is_file())

    def test_openapi_clarification_exists(self):
        text = (ROOT / '05_INTEGRATION/01_OPENAPI_STANDARD_CLARIFICATION.md').read_text(encoding='utf-8')
        self.assertIn('unrelated to OpenAI', text)
        self.assertIn('vendor-neutral', text)

    def test_dependency_register_is_all_open_source(self):
        with (ROOT / '10_OPEN_SOURCE/02_DEPENDENCY_LICENSE_REGISTER.csv').open(newline='', encoding='utf-8') as f:
            rows = list(csv.DictReader(f))
        self.assertGreaterEqual(len(rows), 8)
        self.assertTrue(all(row['Open Source'] == 'YES' for row in rows))
        self.assertTrue(all(row['License'] for row in rows))

    def test_reference_python_requirements_are_exactly_pinned(self):
        lines = [line.strip() for line in (ROOT / '04_REFERENCE_IMPLEMENTATION/requirements.lock').read_text().splitlines() if line.strip() and not line.startswith('#')]
        self.assertGreaterEqual(len(lines), 6)
        self.assertTrue(all(re.fullmatch(r'[A-Za-z0-9_.-]+==[^,;<>!~=]+', line) for line in lines))

    def test_no_proprietary_ai_runtime_dependency(self):
        forbidden = re.compile(r'(?i)(api\.openai\.com|OPENAI_API_KEY|\bfrom\s+openai\b|\bimport\s+openai\b|\bchatgpt\b|\bcodex\b)')
        findings = []
        allowed = {
            '05_INTEGRATION/00_NO_PROPRIETARY_AI_AND_OPEN_SOURCE_POLICY.md',
            '05_INTEGRATION/01_OPENAPI_STANDARD_CLARIFICATION.md',
            '10_OPEN_SOURCE/06_OPEN_SOURCE_ADOPTION_DECISION.md',
            '01_EXECUTIVE/06_OPEN_SOURCE_DECISION.md',
            '00_START_HERE.md',
            '02_IMPLEMENTATION/01_MASTER_GAMEPLAN.md',
            '02_IMPLEMENTATION/02_ENGINEERING_HANDOFF_PROMPT.txt',
            '09_RELEASE/01_RELEASE_NOTES.md',
            '04_REFERENCE_IMPLEMENTATION/tests/test_open_source_policy.py',
            '07_GAUNTLET/run_super_gauntlet.py',
        }
        for path in ROOT.rglob('*'):
            if not path.is_file() or path.suffix.lower() not in {'.py','.sh','.yml','.yaml','.json','.template','.txt','.md'}:
                continue
            rel = path.relative_to(ROOT).as_posix()
            if rel in allowed:
                continue
            if forbidden.search(path.read_text(encoding='utf-8', errors='replace')):
                findings.append(rel)
        self.assertEqual(findings, [])

    def test_gauntlet_is_self_contained_and_uses_open_source_visual_tools(self):
        text = (ROOT / '07_GAUNTLET/run_super_gauntlet.py').read_text(encoding='utf-8')
        self.assertNotIn('/' + 'home' + '/' + 'oai', text)
        self.assertIn('libreoffice', text)
        self.assertIn('pdftoppm', text)


    def test_open_source_stack_blueprint_is_deterministic_and_no_llm(self):
        text = (ROOT / '10_OPEN_SOURCE/01_OPEN_SOURCE_STACK_BLUEPRINT.md').read_text(encoding='utf-8')
        self.assertIn('No LLM is required', text)
        for component in ('PostgreSQL','Valkey','FastAPI','Prometheus'):
            self.assertIn(component, text)

    def test_sbom_is_spdx(self):
        sbom = json.loads((ROOT / '10_OPEN_SOURCE/03_SBOM.spdx.json').read_text(encoding='utf-8'))
        self.assertEqual(sbom['spdxVersion'], 'SPDX-2.3')
        self.assertGreaterEqual(len(sbom['packages']), 6)
        self.assertTrue(all(pkg.get('licenseConcluded') not in {None, 'NOASSERTION'} for pkg in sbom['packages']))

if __name__ == '__main__':
    unittest.main(verbosity=2)
