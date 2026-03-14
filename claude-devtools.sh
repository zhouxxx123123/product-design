#!/bin/bash

# Claude CLI with Chrome DevTools MCP
# 使用方式: ./claude-devtools.sh 或 bash claude-devtools.sh

# MCP 服务器配置（JSON 格式）
MCP_CONFIG='{
  "mcpServers": {
    "chrome-devtools": {
      "command": "chrome-devtools-mcp",
      "args": [
        "--browserUrl",
        "http://127.0.0.1:9222"
      ]
    }
  }
}'

# 或者使用环境变量的方式启动脚本
# 无参数时进入交互模式
if [ $# -eq 0 ]; then
  echo "🚀 启动 Claude Code with Chrome DevTools MCP..."
  echo ""
  echo "📝 提示："
  echo "  • 确保 Chrome 已启动调试端口: chrome://inspect/#devices"
  echo "  • 或使用参数启动: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222"
  echo ""
  
  claude --mcp-config "$MCP_CONFIG" -p "你是一个前端调试助手。我会请你帮我查看和调试网页。
  
你有以下超能力：
- 📸 截屏查看网页实时状态
- 🔍 检查 DOM 元素和样式
- ⚙️ 运行 JavaScript 获取数据
- 📊 性能分析和网络监控

我们一起来联调前端！"
else
  # 带文件参数时，加载文件内容作为上下文
  echo "🚀 启动 Claude Code with Chrome DevTools MCP"
  echo "📄 加载文件: $@"
  claude --mcp-config "$MCP_CONFIG" "$@"
fi
