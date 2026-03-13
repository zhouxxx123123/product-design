"""
ai/tests/test_llm.py

Unit tests for LLMService.chat() and LLMService.chat_stream().
OpenAI client calls are mocked via AsyncMock so no real API key is needed.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.mark.asyncio
class TestLLMService:

    async def test_chat_returns_formatted_response(self):
        """chat() should return formatted response with choices structure."""
        import services.llm as llm_module

        original_client = llm_module.llm_service.client
        original_model = llm_module.llm_service.model

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "这是测试回答"
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        llm_module.llm_service.client = mock_client
        # Use a non-kimi model so temperature is not forced to 1.0
        llm_module.llm_service.model = "moonshot-v1-8k"

        try:
            result = await llm_module.llm_service.chat(
                messages=[{"role": "user", "content": "你好"}]
            )

            assert result == {
                "choices": [{"message": {"content": "这是测试回答"}}]
            }

            mock_client.chat.completions.create.assert_called_once()
            call_args = mock_client.chat.completions.create.call_args
            assert call_args[1]["messages"] == [{"role": "user", "content": "你好"}]
            assert call_args[1]["temperature"] == 0.7
            assert call_args[1]["max_tokens"] == 2000

        finally:
            llm_module.llm_service.client = original_client
            llm_module.llm_service.model = original_model

    async def test_chat_kimi_forces_temperature_1(self):
        """When model is 'kimi-k2.5', temperature should be forced to 1.0."""
        import services.llm as llm_module

        original_client = llm_module.llm_service.client
        original_model = llm_module.llm_service.model

        # Set model to kimi-k2.5
        llm_module.llm_service.model = "kimi-k2.5"

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "测试回答"
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        llm_module.llm_service.client = mock_client

        try:
            await llm_module.llm_service.chat(
                messages=[{"role": "user", "content": "测试"}],
                temperature=0.5  # Should be overridden to 1.0
            )

            # Verify temperature was forced to 1.0
            call_args = mock_client.chat.completions.create.call_args
            assert call_args[1]["temperature"] == 1.0

        finally:
            llm_module.llm_service.client = original_client
            llm_module.llm_service.model = original_model

    async def test_chat_non_kimi_keeps_temperature(self):
        """When model is NOT 'kimi-k2.5', temperature should be passed through unchanged."""
        import services.llm as llm_module

        original_client = llm_module.llm_service.client
        original_model = llm_module.llm_service.model

        # Set model to something other than kimi-k2.5
        llm_module.llm_service.model = "moonshot-v1-8k"

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "测试回答"
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        llm_module.llm_service.client = mock_client

        try:
            await llm_module.llm_service.chat(
                messages=[{"role": "user", "content": "测试"}],
                temperature=0.3
            )

            # Verify temperature was kept as 0.3
            call_args = mock_client.chat.completions.create.call_args
            assert call_args[1]["temperature"] == 0.3

        finally:
            llm_module.llm_service.client = original_client
            llm_module.llm_service.model = original_model

    async def test_chat_propagates_exception(self):
        """If OpenAI client raises an exception, chat() should re-raise it."""
        import services.llm as llm_module

        original_client = llm_module.llm_service.client

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(
            side_effect=Exception("API error")
        )
        llm_module.llm_service.client = mock_client

        try:
            with pytest.raises(Exception, match="API error"):
                await llm_module.llm_service.chat(
                    messages=[{"role": "user", "content": "测试"}]
                )
        finally:
            llm_module.llm_service.client = original_client

    async def test_chat_stream_yields_deltas(self):
        """chat_stream() should yield delta content from streaming response."""
        import services.llm as llm_module

        original_client = llm_module.llm_service.client

        # Create mock streaming response
        async def mock_stream():
            chunks = []
            for content in ["你好", "，", "世界"]:
                chunk = MagicMock()
                chunk.choices = [MagicMock()]
                chunk.choices[0].delta.content = content
                chunks.append(chunk)
            for chunk in chunks:
                yield chunk

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_stream())
        llm_module.llm_service.client = mock_client

        try:
            results = []
            async for delta in llm_module.llm_service.chat_stream(
                messages=[{"role": "user", "content": "测试"}]
            ):
                results.append(delta)

            assert results == ["你好", "，", "世界"]

            # Verify stream=True was passed
            call_args = mock_client.chat.completions.create.call_args
            assert call_args[1]["stream"] is True

        finally:
            llm_module.llm_service.client = original_client

    async def test_chat_stream_skips_none_deltas(self):
        """chat_stream() should skip delta chunks where content is None."""
        import services.llm as llm_module

        original_client = llm_module.llm_service.client

        # Create mock streaming response with some None deltas
        async def mock_stream():
            chunks = []

            # First chunk with content
            chunk1 = MagicMock()
            chunk1.choices = [MagicMock()]
            chunk1.choices[0].delta.content = "开始"
            chunks.append(chunk1)

            # Second chunk with None content (should be skipped)
            chunk2 = MagicMock()
            chunk2.choices = [MagicMock()]
            chunk2.choices[0].delta.content = None
            chunks.append(chunk2)

            # Third chunk with content
            chunk3 = MagicMock()
            chunk3.choices = [MagicMock()]
            chunk3.choices[0].delta.content = "结束"
            chunks.append(chunk3)

            for chunk in chunks:
                yield chunk

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_stream())
        llm_module.llm_service.client = mock_client

        try:
            results = []
            async for delta in llm_module.llm_service.chat_stream(
                messages=[{"role": "user", "content": "测试"}]
            ):
                results.append(delta)

            # Should only include non-None deltas
            assert results == ["开始", "结束"]

        finally:
            llm_module.llm_service.client = original_client

    async def test_chat_stream_kimi_forces_temperature_1(self):
        """In streaming mode with kimi-k2.5, temperature should be forced to 1.0."""
        import services.llm as llm_module

        original_client = llm_module.llm_service.client
        original_model = llm_module.llm_service.model

        # Set model to kimi-k2.5
        llm_module.llm_service.model = "kimi-k2.5"

        async def mock_empty_stream():
            return
            yield  # Make it an async generator

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_empty_stream())
        llm_module.llm_service.client = mock_client

        try:
            # Consume the generator
            async for _ in llm_module.llm_service.chat_stream(
                messages=[{"role": "user", "content": "测试"}],
                temperature=0.8  # Should be overridden
            ):
                pass

            # Verify temperature was forced to 1.0
            call_args = mock_client.chat.completions.create.call_args
            assert call_args[1]["temperature"] == 1.0
            assert call_args[1]["stream"] is True

        finally:
            llm_module.llm_service.client = original_client
            llm_module.llm_service.model = original_model

    async def test_close_calls_client_close(self):
        """close() should call client.close()."""
        import services.llm as llm_module

        original_client = llm_module.llm_service.client

        mock_client = AsyncMock()
        llm_module.llm_service.client = mock_client

        try:
            await llm_module.llm_service.close()
            mock_client.close.assert_called_once()

        finally:
            llm_module.llm_service.client = original_client