"""
ai/tests/test_json_parser.py

Unit tests for the _parse_json_safe / _strip_markdown_json utilities.
"""
import pytest
from utils.json_parser import _parse_json_safe, _strip_markdown_json


class TestStripMarkdownJson:
    def test_plain_json_unchanged(self):
        raw = '{"key": "value"}'
        assert _strip_markdown_json(raw) == raw

    def test_fenced_json_block_stripped(self):
        raw = '```json\n{"key": "value"}\n```'
        assert _strip_markdown_json(raw) == '{"key": "value"}'

    def test_fenced_block_no_language_tag(self):
        raw = '```\n{"key": "value"}\n```'
        assert _strip_markdown_json(raw) == '{"key": "value"}'

    def test_leading_trailing_whitespace_trimmed(self):
        raw = '  \n  {"key": "value"}  \n  '
        assert _strip_markdown_json(raw) == '{"key": "value"}'


class TestParseJsonSafe:
    def test_plain_json_string_returns_dict(self):
        raw = '{"themes": [], "summary": "test"}'
        result = _parse_json_safe(raw)
        assert isinstance(result, dict)
        assert result["themes"] == []
        assert result["summary"] == "test"

    def test_markdown_wrapped_json_returns_dict(self):
        raw = '```json\n{"themes": [{"title": "t1"}], "summary": "ok"}\n```'
        result = _parse_json_safe(raw)
        assert isinstance(result, dict)
        assert result["themes"][0]["title"] == "t1"

    def test_plain_text_returns_original_string(self):
        raw = "这是一段无法解析的纯文本，没有JSON结构。"
        result = _parse_json_safe(raw)
        assert isinstance(result, str)
        assert result == raw

    def test_malformed_json_returns_original_string(self):
        raw = '{"key": "value"'  # missing closing brace
        result = _parse_json_safe(raw)
        assert isinstance(result, str)

    def test_empty_string_returns_empty_string(self):
        result = _parse_json_safe("")
        assert result == ""

    def test_json_array_parsed(self):
        raw = '[1, 2, 3]'
        result = _parse_json_safe(raw)
        assert result == [1, 2, 3]
