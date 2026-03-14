"""
JSON 解析工具函数

从 AI 输出中安全提取 JSON，处理 markdown 代码块包裹等常见情况。
"""

import json
import re
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


def _strip_markdown_json(text: str) -> str:
    """
    移除 AI 输出中可能包裹 JSON 的 markdown 代码块。

    例如::

        ```json
        { ... }
        ```

    会被清理为纯 JSON 字符串。
    """
    pattern = r"```(?:json)?\s*([\s\S]*?)```"
    match = re.search(pattern, text.strip())
    if match:
        return match.group(1).strip()
    return text.strip()


def _parse_json_safe(text: str) -> Any:
    """
    尝试解析 JSON，失败时返回原始文本字符串。
    """
    cleaned = _strip_markdown_json(text)
    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        logger.warning("JSON 解析失败，返回原始内容", raw=cleaned[:200])
        return cleaned
