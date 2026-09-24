import gzip
import json
import math
import tempfile
import unittest
from pathlib import Path

from build_text_embeddings import (
    DIMENSIONS, MODEL_ID, MODEL_REVISION, PREPROCESS_VERSION,
    chunk_field, display_text, iter_fields, sha256, validate_vector,
)
from sync_text_embeddings import read_artifact


class CharacterTokenizer:
    def encode(self, text, **_):
        return list(map(ord, text))

    def decode(self, tokens, **_):
        return ''.join(map(chr, tokens))


class EmbeddingTests(unittest.TestCase):
    def test_locale_coverage_skips_only_empty_without_fallback(self):
        source = {
            'gifts': [{'game_id': 4, 'name': '선물', 'name_en': 'Gift', 'name_jp': '  '}],
            'events': [{'id': 5, 'desc_text': '<color=red>달빛</color> <…?>'}],
            'choices': [{'id': 6, 'message_en': 'Look closer.'}],
        }
        fields = list(iter_fields(source))
        self.assertEqual({(f['entity_kind'], f['locale']) for f in fields},
                         {('gift', 'ko'), ('gift', 'en'), ('event', 'ko'), ('choice', 'en')})
        self.assertEqual(fields[0]['source_hash'], sha256('선물'.encode()))
        self.assertEqual(display_text('<color=red>달빛</color> <…?>'), '달빛 <…?>')

    def test_long_field_chunks_cover_every_token_with_overlap(self):
        field = {'content': '가' * 800, 'entity_kind': 'event', 'entity_id': 1,
                 'locale': 'ko', 'field_name': 'desc_text', 'source_hash': 'a' * 64}
        chunks = chunk_field(field, CharacterTokenizer())
        self.assertEqual([(c['token_start'], c['token_end']) for c in chunks],
                         [(0, 384), (352, 736), (704, 800)])
        self.assertEqual(''.join(chunks[i]['content'][32:] if i else chunks[i]['content'] for i in range(3)), field['content'])

    def test_vector_rejects_wrong_size_nonfinite_and_nonunit(self):
        valid = [1.0] + [0.0] * (DIMENSIONS - 1)
        validate_vector(valid)
        for invalid in (valid[:-1], [math.nan] + valid[1:], [0.0] * DIMENSIONS):
            with self.assertRaises(ValueError):
                validate_vector(invalid)

    def test_artifact_requires_complete_eof_and_unique_keys(self):
        row = {'model_id': MODEL_ID, 'model_revision': MODEL_REVISION,
               'preprocess_version': PREPROCESS_VERSION, 'entity_kind': 'gift',
               'entity_id': 1, 'locale': 'ko', 'field_name': 'name', 'chunk_index': 0,
               'token_start': 0, 'token_end': 2, 'source_hash': 'a' * 64,
               'content_hash': 'b' * 64, 'content': '선물',
               'embedding': [1.0] + [0.0] * (DIMENSIONS - 1)}
        manifest = {'model_id': MODEL_ID, 'model_revision': MODEL_REVISION,
                    'preprocess_version': PREPROCESS_VERSION, 'dimensions': DIMENSIONS,
                    'field_count': 1, 'chunk_count': 1}
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            (folder / 'manifest.json').write_text(json.dumps(manifest))
            with gzip.open(folder / 'vectors.jsonl.gz', 'wt') as output:
                output.write(json.dumps(row) + '\n')
            self.assertEqual(len(read_artifact(folder)[1]), 1)
            with gzip.open(folder / 'vectors.jsonl.gz', 'wt') as output:
                output.write(json.dumps(row) + '\n' + json.dumps(row) + '\n')
            with self.assertRaises(ValueError):
                read_artifact(folder)


if __name__ == '__main__':
    unittest.main()
