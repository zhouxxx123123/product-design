"""
ai/tests/test_asr.py

Unit tests for ai/services/asr.py.

Coverage scope:
  - _get_voice_format()       — pure function, filename → VoiceFormat string
  - _split_by_speaker()       — pure function, WordList objects → segment list
  - _mock_recognize_file()    — pure function, bytes → mock response dict
  - _mock_recognize_url()     — pure function, url str → mock response dict
  - TencentASRService.recognize_file()    — mock fallback path (no real keys)
  - TencentASRService.recognize_url()    — mock fallback path (no real keys)
  - TencentASRService.recognize_realtime() — always mock

Out of scope (require real Tencent credentials — left for integration tests):
  - _recognize_file_real()
  - _recognize_url_real()
  - _call_sentence_recognition()
"""

import hashlib
from types import SimpleNamespace

import pytest

from services.asr import (
    _get_voice_format,
    _mock_recognize_file,
    _mock_recognize_url,
    _split_by_speaker,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_word(word: str, start: int, end: int, speaker: int) -> SimpleNamespace:
    """Create a fake SDK WordList item with the same attribute interface."""
    return SimpleNamespace(Word=word, StartTime=start, EndTime=end, SpeakerTag=speaker)


# ---------------------------------------------------------------------------
# TestGetVoiceFormat — pure function, no async
# ---------------------------------------------------------------------------


class TestGetVoiceFormat:
    def test_wav_extension(self):
        assert _get_voice_format("audio.wav") == "wav"

    def test_mp3_extension(self):
        assert _get_voice_format("music.mp3") == "mp3"

    def test_m4a_extension(self):
        assert _get_voice_format("recording.m4a") == "m4a"

    def test_aac_extension(self):
        assert _get_voice_format("clip.aac") == "aac"

    def test_pcm_extension(self):
        assert _get_voice_format("raw.pcm") == "pcm"

    def test_unknown_extension_defaults_to_wav(self):
        assert _get_voice_format("video.webm") == "wav"

    def test_uppercase_extension(self):
        """Extension lookup must be case-insensitive."""
        assert _get_voice_format("AUDIO.WAV") == "wav"

    def test_mixed_case_extension(self):
        assert _get_voice_format("Podcast.MP3") == "mp3"

    def test_no_extension_defaults_to_wav(self):
        assert _get_voice_format("audiofile") == "wav"

    def test_dot_only_filename_defaults_to_wav(self):
        """Edge case: filename starts with dot and has no real extension."""
        assert _get_voice_format(".hidden") == "wav"

    def test_multiple_dots_uses_last_segment(self):
        """Only the part after the last dot is treated as extension."""
        assert _get_voice_format("interview.2024.mp3") == "mp3"


# ---------------------------------------------------------------------------
# TestSplitBySpeaker — pure function, no async
# ---------------------------------------------------------------------------


class TestSplitBySpeaker:
    def test_single_speaker_no_split(self):
        """Three words from the same speaker → one segment."""
        words = [
            make_word("你好", 0, 500, 0),
            make_word("我是", 600, 1000, 0),
            make_word("测试", 1100, 1500, 0),
        ]
        result = _split_by_speaker(words, "你好我是测试")

        assert len(result) == 1
        seg = result[0]
        assert seg["text"] == "你好我是测试"
        assert seg["speaker_tag"] == 0
        assert seg["begin_time"] == 0
        assert seg["end_time"] == 1500

    def test_two_speakers_split_correctly(self):
        """First two words tag=0, last two words tag=1 → two segments."""
        words = [
            make_word("您好", 0, 500, 0),
            make_word("感谢", 600, 1000, 0),
            make_word("不客气", 1100, 1800, 1),
            make_word("很高兴", 1900, 2400, 1),
        ]
        result = _split_by_speaker(words, "您好感谢不客气很高兴")

        assert len(result) == 2

        seg0 = result[0]
        assert seg0["speaker_tag"] == 0
        assert seg0["text"] == "您好感谢"
        assert seg0["begin_time"] == 0
        assert seg0["end_time"] == 1000

        seg1 = result[1]
        assert seg1["speaker_tag"] == 1
        assert seg1["text"] == "不客气很高兴"
        assert seg1["begin_time"] == 1100
        assert seg1["end_time"] == 2400

    def test_three_speakers_split_correctly(self):
        """Alternating tags: 0, 1, 0 → three segments."""
        words = [
            make_word("A", 0, 100, 0),
            make_word("B", 200, 300, 1),
            make_word("C", 400, 500, 0),
        ]
        result = _split_by_speaker(words, "ABC")

        assert len(result) == 3
        assert result[0]["speaker_tag"] == 0
        assert result[1]["speaker_tag"] == 1
        assert result[2]["speaker_tag"] == 0

    def test_empty_word_list_none_falls_back_to_full_text(self):
        """word_list=None → single segment whose text equals full_text."""
        result = _split_by_speaker(None, "完整转写文字")

        assert len(result) == 1
        assert result[0]["text"] == "完整转写文字"
        assert result[0]["speaker_tag"] == 0
        assert result[0]["begin_time"] == 0
        assert result[0]["end_time"] == 0

    def test_empty_list_falls_back_to_full_text(self):
        """word_list=[] → single segment whose text equals full_text."""
        result = _split_by_speaker([], "完整转写文字")

        assert len(result) == 1
        assert result[0]["text"] == "完整转写文字"

    def test_segment_confidence_is_float(self):
        """Each segment produced by _split_by_speaker must have a float confidence."""
        words = [make_word("词", 0, 300, 0)]
        result = _split_by_speaker(words, "词")

        assert isinstance(result[0]["confidence"], float)

    def test_single_word_single_segment(self):
        """One word → one segment with correct timing."""
        words = [make_word("单词", 100, 800, 1)]
        result = _split_by_speaker(words, "单词")

        assert len(result) == 1
        assert result[0]["text"] == "单词"
        assert result[0]["begin_time"] == 100
        assert result[0]["end_time"] == 800
        assert result[0]["speaker_tag"] == 1


# ---------------------------------------------------------------------------
# TestMockRecognizeFile — pure function, no async
# ---------------------------------------------------------------------------


class TestMockRecognizeFile:
    def test_returns_completed_status(self):
        result = _mock_recognize_file(b"some bytes")
        assert result["status"] == "completed"

    def test_returns_segments_list(self):
        result = _mock_recognize_file(b"ab")
        assert isinstance(result["segments"], list)
        assert len(result["segments"]) > 0

    def test_returns_positive_duration(self):
        result = _mock_recognize_file(b"data")
        assert result["duration"] > 0

    def test_even_byte_count_selects_scenario_a(self):
        """Even content length → scenario A (14 segments)."""
        even_bytes = b"x" * 14  # len == 14, even
        result = _mock_recognize_file(even_bytes)
        assert len(result["segments"]) == 14

    def test_odd_byte_count_selects_scenario_b(self):
        """Odd content length → scenario B (12 segments)."""
        odd_bytes = b"x" * 13  # len == 13, odd
        result = _mock_recognize_file(odd_bytes)
        assert len(result["segments"]) == 12

    def test_returns_independent_list_copy(self):
        """Each call returns a fresh list, not the same module-level reference."""
        result_a = _mock_recognize_file(b"even00")
        result_b = _mock_recognize_file(b"even00")
        assert result_a["segments"] is not result_b["segments"]

    def test_segment_shape(self):
        """Every segment must contain the expected keys."""
        required_keys = {"text", "begin_time", "end_time", "speaker_tag", "confidence"}
        result = _mock_recognize_file(b"ok")
        for seg in result["segments"]:
            assert required_keys.issubset(seg.keys()), f"Missing keys in: {seg}"


# ---------------------------------------------------------------------------
# TestMockRecognizeUrl — pure function, no async
# ---------------------------------------------------------------------------


class TestMockRecognizeUrl:
    def test_returns_completed_status(self):
        result = _mock_recognize_url("https://example.com/audio.wav")
        assert result["status"] == "completed"

    def test_returns_segments_list(self):
        result = _mock_recognize_url("https://example.com/audio.wav")
        assert isinstance(result["segments"], list)
        assert len(result["segments"]) > 0

    def test_returns_positive_duration(self):
        result = _mock_recognize_url("https://example.com/audio.wav")
        assert result["duration"] > 0

    def test_url_hash_determines_scenario(self):
        """Even hash → scenario A (14 segs), odd hash → scenario B (12 segs)."""
        url = "https://example.com/audio.wav"
        url_hash = int(hashlib.md5(url.encode()).hexdigest(), 16)
        expected_len = 14 if url_hash % 2 == 0 else 12

        result = _mock_recognize_url(url)
        assert len(result["segments"]) == expected_len

    def test_different_urls_may_yield_different_scenarios(self):
        """Two URLs with different hash parity should return different segment counts."""
        # Find one URL from each parity class
        url_a = "https://example.com/audio.wav"  # we already know its hash parity
        url_b = "https://other.com/other.mp3"
        hash_a = int(hashlib.md5(url_a.encode()).hexdigest(), 16) % 2
        hash_b = int(hashlib.md5(url_b.encode()).hexdigest(), 16) % 2

        if hash_a != hash_b:
            result_a = _mock_recognize_url(url_a)
            result_b = _mock_recognize_url(url_b)
            assert len(result_a["segments"]) != len(result_b["segments"])
        else:
            # Both happen to have same parity — test is vacuously satisfied
            pass

    def test_segment_shape(self):
        required_keys = {"text", "begin_time", "end_time", "speaker_tag", "confidence"}
        result = _mock_recognize_url("https://example.com/test.mp3")
        for seg in result["segments"]:
            assert required_keys.issubset(seg.keys()), f"Missing keys in: {seg}"


# ---------------------------------------------------------------------------
# TestASRServiceMockFallback — async, requires no real Tencent credentials
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestASRServiceMockFallback:
    async def test_recognize_file_returns_mock_when_unconfigured(self):
        """When secret_id/secret_key are empty, TencentASRService.recognize_file() returns mock data."""
        from services.asr import TencentASRService

        svc = TencentASRService()
        svc.secret_id = ""
        svc.secret_key = ""

        result = await svc.recognize_file(b"even_bytes_00")

        assert result["status"] == "completed"
        assert isinstance(result["segments"], list)
        assert len(result["segments"]) > 0
        assert result["duration"] > 0

    async def test_recognize_file_returns_scenario_based_on_content_parity(self):
        """Mock fallback selects scenario A for even-length content."""
        from services.asr import TencentASRService

        svc = TencentASRService()
        svc.secret_id = ""
        svc.secret_key = ""

        even_result = await svc.recognize_file(b"x" * 14)  # even
        odd_result = await svc.recognize_file(b"x" * 13)   # odd

        assert len(even_result["segments"]) == 14
        assert len(odd_result["segments"]) == 12

    async def test_recognize_url_returns_mock_when_unconfigured(self):
        """When secret_id/secret_key are empty, TencentASRService.recognize_url() returns mock data."""
        from services.asr import TencentASRService

        svc = TencentASRService()
        svc.secret_id = ""
        svc.secret_key = ""

        result = await svc.recognize_url("https://example.com/interview.wav")

        assert result["status"] == "completed"
        assert isinstance(result["segments"], list)
        assert len(result["segments"]) > 0
        assert result["duration"] > 0

    async def test_recognize_url_segment_keys(self):
        """Every segment from mock URL recognition has the expected fields."""
        from services.asr import TencentASRService

        svc = TencentASRService()
        svc.secret_id = ""
        svc.secret_key = ""

        result = await svc.recognize_url("https://example.com/test.mp3")

        required_keys = {"text", "begin_time", "end_time", "speaker_tag", "confidence"}
        for seg in result["segments"]:
            assert required_keys.issubset(seg.keys())

    async def test_recognize_realtime_returns_partial_or_final(self):
        """recognize_realtime() on module-level asr_service returns expected shape."""
        import services.asr as asr_module

        result = await asr_module.asr_service.recognize_realtime(b"\x00" * 1024)

        assert result["status"] in {"partial", "final"}
        assert isinstance(result["text"], str)   # text may be empty for whisper partial
        assert isinstance(result["is_final"], bool)
        assert result["is_final"] == (result["status"] == "final")
        assert "begin_time" in result
        assert "end_time" in result

    async def test_recognize_realtime_alternates_partial_and_final(self):
        """Every 3rd call should be 'final'; others 'partial'."""
        import services.asr as asr_module

        # Reset the counter on a fresh service instance to get predictable results
        from services.asr import TencentASRService

        svc = TencentASRService()
        chunk = b"\x00" * 512

        results = [await svc.recognize_realtime(chunk) for _ in range(6)]

        # calls 1,2 → partial; call 3 → final; calls 4,5 → partial; call 6 → final
        assert results[0]["status"] == "partial"   # count=1
        assert results[1]["status"] == "partial"   # count=2
        assert results[2]["status"] == "final"     # count=3  (3 % 3 == 0)
        assert results[3]["status"] == "partial"   # count=4
        assert results[4]["status"] == "partial"   # count=5
        assert results[5]["status"] == "final"     # count=6  (6 % 3 == 0)

    async def test_recognize_realtime_cycles_through_scenario_a_segments(self):
        """Consecutive calls should cycle through all 14 scenario-A segments."""
        from services.asr import TencentASRService, _MOCK_SEGMENTS_SCENARIO_A

        svc = TencentASRService()
        n = len(_MOCK_SEGMENTS_SCENARIO_A)  # 14

        texts = [
            (await svc.recognize_realtime(b"x"))["text"] for _ in range(n)
        ]
        expected_texts = [seg["text"] for seg in _MOCK_SEGMENTS_SCENARIO_A]

        assert texts == expected_texts
