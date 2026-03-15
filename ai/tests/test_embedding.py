"""
ai/tests/test_embedding.py

Unit tests for EmbeddingService.embed_text().
OpenAI client calls are mocked via AsyncMock so no real API key is needed.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.mark.asyncio
class TestEmbeddingService:

    async def test_embed_text_returns_vector(self):
        """embed_text() should return a list of floats from the embedding API."""
        import services.embedding as embedding_module

        original_client = embedding_module.embedding_service.client

        mock_client = AsyncMock()
        mock_response = MagicMock()
        # Mock typical 1536-dimensional embedding vector
        mock_embedding = [0.1] * 1536
        mock_response.data = [MagicMock()]
        mock_response.data[0].embedding = mock_embedding
        mock_client.embeddings.create = AsyncMock(return_value=mock_response)

        # Replace client with mock
        embedding_module.embedding_service._client = mock_client

        try:
            result = await embedding_module.embedding_service.embed_text("测试文本")

            assert result == mock_embedding
            assert len(result) == 1536

            mock_client.embeddings.create.assert_called_once()
            call_args = mock_client.embeddings.create.call_args
            assert call_args[1]["input"] == "测试文本"
            assert call_args[1]["model"] == "moonshot-v1-embedding"

        finally:
            embedding_module.embedding_service._client = original_client

    async def test_embed_text_truncates_long_input(self):
        """embed_text() should truncate input to 8000 chars to avoid token limits."""
        import services.embedding as embedding_module

        original_client = embedding_module.embedding_service.client

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.data = [MagicMock()]
        mock_response.data[0].embedding = [0.1] * 1536
        mock_client.embeddings.create = AsyncMock(return_value=mock_response)

        embedding_module.embedding_service._client = mock_client

        try:
            # Create text longer than 8000 chars
            long_text = "a" * 10000

            await embedding_module.embedding_service.embed_text(long_text)

            # Verify input was truncated to 8000 chars
            call_args = mock_client.embeddings.create.call_args
            assert len(call_args[1]["input"]) == 8000

        finally:
            embedding_module.embedding_service._client = original_client

    async def test_embed_text_rejects_empty_input(self):
        """embed_text() should raise ValueError for empty or whitespace-only input."""
        import services.embedding as embedding_module

        with pytest.raises(ValueError, match="Text cannot be empty"):
            await embedding_module.embedding_service.embed_text("")

        with pytest.raises(ValueError, match="Text cannot be empty"):
            await embedding_module.embedding_service.embed_text("   ")

        with pytest.raises(ValueError, match="Text cannot be empty"):
            await embedding_module.embedding_service.embed_text("\n\t")

    async def test_embed_text_propagates_api_exception(self):
        """embed_text() should re-raise exceptions from the OpenAI client."""
        import services.embedding as embedding_module

        original_client = embedding_module.embedding_service.client

        mock_client = AsyncMock()
        mock_client.embeddings.create = AsyncMock(
            side_effect=Exception("API rate limit exceeded")
        )
        embedding_module.embedding_service._client = mock_client

        try:
            with pytest.raises(Exception, match="API rate limit exceeded"):
                await embedding_module.embedding_service.embed_text("测试")

        finally:
            embedding_module.embedding_service._client = original_client

    async def test_close_calls_client_close(self):
        """close() should call client.close() if client exists."""
        import services.embedding as embedding_module

        mock_client = AsyncMock()
        embedding_module.embedding_service._client = mock_client

        await embedding_module.embedding_service.close()
        mock_client.close.assert_called_once()

    async def test_close_handles_none_client(self):
        """close() should handle gracefully when client is None."""
        import services.embedding as embedding_module

        # Ensure client is None
        embedding_module.embedding_service._client = None

        # Should not raise an exception
        await embedding_module.embedding_service.close()