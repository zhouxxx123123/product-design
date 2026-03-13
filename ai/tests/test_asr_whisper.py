"""
ai/tests/test_asr_whisper.py

Unit tests for WhisperAsrService and related utility functions.
WhisperModel loading is mocked to avoid actual model initialization.
"""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from services.asr_whisper import (
    _build_segments,
    _ensure_nonempty,
    WhisperAsrService
)


class TestBuildSegments:
    """Test the _build_segments utility function."""

    def test_build_segments_converts_times_to_ms(self):
        """Should convert start/end times from seconds to milliseconds."""
        # Mock segment object
        mock_seg = MagicMock()
        mock_seg.text = "测试文本"
        mock_seg.start = 1.5  # seconds
        mock_seg.end = 3.0    # seconds

        segments = _build_segments([mock_seg])

        assert len(segments) == 1
        assert segments[0]["begin_time"] == 1500  # milliseconds
        assert segments[0]["end_time"] == 3000    # milliseconds
        assert segments[0]["text"] == "测试文本"

    def test_build_segments_filters_empty_text(self):
        """Should filter out segments with empty or whitespace-only text."""
        # Mock segments: one with content, one empty, one whitespace
        mock_seg1 = MagicMock()
        mock_seg1.text = "有内容"
        mock_seg1.start = 0.0
        mock_seg1.end = 1.0

        mock_seg2 = MagicMock()
        mock_seg2.text = ""
        mock_seg2.start = 1.0
        mock_seg2.end = 2.0

        mock_seg3 = MagicMock()
        mock_seg3.text = "   \t  "
        mock_seg3.start = 2.0
        mock_seg3.end = 3.0

        segments = _build_segments([mock_seg1, mock_seg2, mock_seg3])

        # Only the first segment should remain
        assert len(segments) == 1
        assert segments[0]["text"] == "有内容"

    def test_build_segments_sets_speaker_and_confidence(self):
        """Should set speaker_tag=0 and confidence=1.0 for all segments."""
        mock_seg = MagicMock()
        mock_seg.text = "测试"
        mock_seg.start = 0.0
        mock_seg.end = 1.0

        segments = _build_segments([mock_seg])

        assert segments[0]["speaker_tag"] == 0
        assert segments[0]["confidence"] == 1.0

    def test_build_segments_empty_input(self):
        """Should return empty list when given empty iterator."""
        segments = _build_segments([])
        assert segments == []


class TestEnsureNonempty:
    """Test the _ensure_nonempty utility function."""

    def test_ensure_nonempty_returns_segments_when_present(self):
        """Should return segments unchanged when list is not empty."""
        input_segments = [
            {
                "text": "测试",
                "begin_time": 0,
                "end_time": 1000,
                "speaker_tag": 0,
                "confidence": 1.0,
            }
        ]

        result = _ensure_nonempty(input_segments)

        assert result is input_segments  # Should be the same object
        assert len(result) == 1
        assert result[0]["text"] == "测试"

    def test_ensure_nonempty_returns_placeholder_when_empty(self):
        """Should return placeholder segment when list is empty."""
        result = _ensure_nonempty([])

        assert len(result) == 1
        assert result[0] == {
            "text": "",
            "begin_time": 0,
            "end_time": 0,
            "speaker_tag": 0,
            "confidence": 1.0,
        }


@pytest.mark.asyncio
class TestWhisperAsrService:
    """Test the WhisperAsrService async methods."""

    async def test_recognize_file_returns_result(self):
        """recognize_file() should run transcription in executor and return result."""
        service = WhisperAsrService()

        expected_result = {
            "status": "completed",
            "duration": 3500,
            "segments": [
                {
                    "text": "测试文本",
                    "begin_time": 0,
                    "end_time": 3000,
                    "speaker_tag": 0,
                    "confidence": 1.0,
                }
            ]
        }

        with patch('asyncio.get_running_loop') as mock_get_loop:
            mock_loop = AsyncMock()
            mock_get_loop.return_value = mock_loop
            mock_loop.run_in_executor = AsyncMock(return_value=expected_result)

            result = await service.recognize_file(
                file_content=b"fake_audio_bytes",
                filename="test.wav"
            )

            assert result == expected_result
            # Verify run_in_executor was called with correct arguments
            mock_loop.run_in_executor.assert_called_once()
            call_args = mock_loop.run_in_executor.call_args[0]
            assert call_args[0] is service._executor
            assert call_args[1] == service._transcribe_bytes

    async def test_recognize_url_returns_result(self):
        """recognize_url() should run download+transcription in executor and return result."""
        service = WhisperAsrService()

        expected_result = {
            "status": "completed",
            "duration": 2500,
            "segments": [
                {
                    "text": "URL音频内容",
                    "begin_time": 0,
                    "end_time": 2000,
                    "speaker_tag": 0,
                    "confidence": 1.0,
                }
            ]
        }

        with patch('asyncio.get_running_loop') as mock_get_loop:
            mock_loop = AsyncMock()
            mock_get_loop.return_value = mock_loop
            mock_loop.run_in_executor = AsyncMock(return_value=expected_result)

            result = await service.recognize_url("http://example.com/audio.wav")

            assert result == expected_result
            # Verify run_in_executor was called
            mock_loop.run_in_executor.assert_called_once()
            call_args = mock_loop.run_in_executor.call_args[0]
            assert call_args[0] is service._executor
            assert call_args[1] == service._download_and_transcribe

    async def test_recognize_realtime_returns_partial_when_buffer_small(self):
        """recognize_realtime() should return partial status when buffer < threshold."""
        service = WhisperAsrService()

        # Reset buffer to ensure clean state
        service._realtime_buffer = b""

        # Send small chunk (< 96000 bytes)
        small_chunk = b"x" * 1000

        result = await service.recognize_realtime(small_chunk)

        assert result["status"] == "partial"
        assert result["text"] == ""
        assert result["is_final"] is False
        assert result["begin_time"] == 0
        assert result["end_time"] == 0

        # Buffer should contain our chunk
        assert len(service._realtime_buffer) == 1000

    async def test_recognize_realtime_returns_final_when_buffer_full(self):
        """recognize_realtime() should trigger transcription when buffer >= threshold."""
        service = WhisperAsrService()

        # Reset buffer
        service._realtime_buffer = b""

        # Create chunk that makes buffer >= threshold (96000 bytes)
        large_chunk = b"x" * 96001

        expected_transcription = {
            "status": "completed",
            "duration": 3000,
            "segments": [
                {
                    "text": "测试文本",
                    "begin_time": 0,
                    "end_time": 3000,
                    "speaker_tag": 0,
                    "confidence": 1.0,
                }
            ]
        }

        with patch('asyncio.get_running_loop') as mock_get_loop:
            mock_loop = AsyncMock()
            mock_get_loop.return_value = mock_loop
            mock_loop.run_in_executor = AsyncMock(return_value=expected_transcription)

            result = await service.recognize_realtime(large_chunk)

            # Should return final result
            assert result["status"] == "final"
            assert result["text"] == "测试文本"
            assert result["is_final"] is True
            assert result["begin_time"] == 0
            assert result["end_time"] == 3000

            # Buffer should be reset after flush
            assert len(service._realtime_buffer) == 0

            # Verify run_in_executor was called
            mock_loop.run_in_executor.assert_called_once()

    async def test_recognize_realtime_resets_buffer_after_flush(self):
        """After buffer flush, subsequent small chunks should return partial again."""
        service = WhisperAsrService()

        # Reset buffer
        service._realtime_buffer = b""

        # First: trigger full transcription
        large_chunk = b"x" * 96001

        expected_transcription = {
            "status": "completed",
            "duration": 1000,
            "segments": [
                {
                    "text": "第一次",
                    "begin_time": 0,
                    "end_time": 1000,
                    "speaker_tag": 0,
                    "confidence": 1.0,
                }
            ]
        }

        with patch('asyncio.get_running_loop') as mock_get_loop:
            mock_loop = AsyncMock()
            mock_get_loop.return_value = mock_loop
            mock_loop.run_in_executor = AsyncMock(return_value=expected_transcription)

            # First call - should trigger transcription and reset buffer
            result1 = await service.recognize_realtime(large_chunk)
            assert result1["status"] == "final"
            assert len(service._realtime_buffer) == 0

            # Second call with small chunk - should return partial
            small_chunk = b"y" * 1000
            result2 = await service.recognize_realtime(small_chunk)

            assert result2["status"] == "partial"
            assert result2["is_final"] is False
            assert len(service._realtime_buffer) == 1000

            # run_in_executor should only have been called once (first call)
            assert mock_loop.run_in_executor.call_count == 1

    async def test_recognize_realtime_with_multiple_segments(self):
        """recognize_realtime() should join multiple segments with spaces."""
        service = WhisperAsrService()
        service._realtime_buffer = b""

        large_chunk = b"x" * 96001

        expected_transcription = {
            "status": "completed",
            "duration": 5000,
            "segments": [
                {
                    "text": "第一段",
                    "begin_time": 0,
                    "end_time": 2000,
                    "speaker_tag": 0,
                    "confidence": 1.0,
                },
                {
                    "text": "第二段",
                    "begin_time": 2000,
                    "end_time": 4000,
                    "speaker_tag": 0,
                    "confidence": 1.0,
                }
            ]
        }

        with patch('asyncio.get_running_loop') as mock_get_loop:
            mock_loop = AsyncMock()
            mock_get_loop.return_value = mock_loop
            mock_loop.run_in_executor = AsyncMock(return_value=expected_transcription)

            result = await service.recognize_realtime(large_chunk)

            assert result["status"] == "final"
            assert result["text"] == "第一段 第二段"
            assert result["begin_time"] == 0  # First segment's begin_time
            assert result["end_time"] == 4000  # Last segment's end_time

    async def test_recognize_realtime_with_empty_segments(self):
        """recognize_realtime() should handle empty segments gracefully."""
        service = WhisperAsrService()
        service._realtime_buffer = b""

        large_chunk = b"x" * 96001

        expected_transcription = {
            "status": "completed",
            "duration": 1000,
            "segments": []  # Empty segments
        }

        with patch('asyncio.get_running_loop') as mock_get_loop:
            mock_loop = AsyncMock()
            mock_get_loop.return_value = mock_loop
            mock_loop.run_in_executor = AsyncMock(return_value=expected_transcription)

            result = await service.recognize_realtime(large_chunk)

            assert result["status"] == "final"
            assert result["text"] == ""
            assert result["begin_time"] == 0
            assert result["end_time"] == 0