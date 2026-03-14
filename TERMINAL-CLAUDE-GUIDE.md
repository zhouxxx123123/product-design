# 终端 Claude 前端联调指南

## 🎯 快速开始（30秒）

### 步骤 1：启动 Chrome 调试端口

**macOS：**
```bash
# 关闭所有 Chrome 实例，然后用调试端口启动
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  http://localhost:3000 &
```

**Linux：**
```bash
google-chrome --remote-debugging-port=9222 http://localhost:3000 &
```

**Windows (PowerShell)：**
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  http://localhost:3000
```

### 步骤 2：启动前端和后端

在一个终端运行：
```bash
cd /Users/zhoukeyu/Desktop/基准线/product-design
bash dev-stack.sh
```

或手动启动两个服务：
```bash
# 终端 1
cd frontend && npm run dev

# 终端 2（新标签）
cd backend && npm run dev
```

### 步骤 3：启动终端 Claude with MCP

```bash
cd /Users/zhoukeyu/Desktop/基准线/product-design
bash claude-devtools.sh
```

然后输入你的需求，比如：
```
截一下首页的截图
查看一下 session 列表表格的 DOM 结构
提取页面上的所有输入框
帮我分析一下网络请求的延迟
```

---

## 📋 常用命令

### 终端 Claude 的 MCP 命令

```bash
# 启动交互模式（推荐）
bash claude-devtools.sh

# 或直接用 claude 命令
claude --mcp-config '{...chrome-devtools-config...}' -p "你的需求"

# 启用调试模式（看 MCP 通信日志）
claude --mcp-config '{...}' --mcp-debug -p "你的需求"
```

### 直接传文件上下文

```bash
# 分析前端源代码
bash claude-devtools.sh src/App.tsx src/components/

# 加载多个文件
bash claude-devtools.sh frontend/src/pages/SessionDetail.tsx backend/src/modules/sessions/
```

---

## 🔧 MCP 功能速查表

| 需求 | 命令 | 说明 |
|------|------|------|
| 页面截图 | `帮我截一下首页` | Chrome DevTools MCP 自动拍照 |
| 获取 DOM | `查看#app元素的HTML` | 检查页面结构 |
| 执行 JS | `执行 document.querySelectorAll('button').length` | 获取按钮数量等 |
| 列出链接 | `页面上有哪些链接？` | 自动提取 `<a>` 标签 |
| 表单检查 | `找出所有表单字段和验证规则` | 测试表单 |
| 性能分析 | `分析页面的加载时间` | CrUX 数据 |
| 网络检查 | `看一下 API 调用` | Chrome DevTools 网络面板 |
| DOM 对比 | `这个修改前后 DOM 有什么变化？` | 联调时使用 |

---

## 💡 前端联调场景示例

### 场景 1：快速验证样式修改

```bash
bash claude-devtools.sh

# 然后输入：
截一下页面
页面上的主按钮颜色是什么？
```

### 场景 2：调试表单提交

```bash
bash claude-devtools.sh

# 然后输入：
分析 #submit-form 表单的所有字段
执行 document.querySelector('#submit-form').submit()
看看网络请求是什么
```

### 场景 3：性能分析

```bash
bash claude-devtools.sh

# 然后输入：
分析页面加载性能，给出优化建议
哪个 API 最慢？
```

### 场景 4：多人协作

```bash
# 截图并分享给团队
bash claude-devtools.sh src/components/SessionForm.tsx

# 向 Claude 描述
帮我检查 SessionForm 组件的样式是否正确
输入字段的校验规则是什么？
```

---

## 🐛 故障排查

### 问题 1：Chrome 调试端口连接失败

```bash
# 检查 Chrome 是否启动了调试端口
lsof -i :9222

# 如果没有，重启 Chrome
pkill -9 Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 http://localhost:3000 &
```

### 问题 2：MCP 错误提示

运行时加 `--mcp-debug` 参数看详细日志：

```bash
claude --mcp-config '{...}' --mcp-debug -p "你的需求"
```

### 问题 3：找不到脚本

确保在项目根目录运行：

```bash
cd /Users/zhoukeyu/Desktop/基准线/product-design
bash ./claude-devtools.sh
```

---

## 🚀 高级用法

### 1. 自定义 MCP 启动参数

编辑 `claude-devtools.sh`，修改 `MCP_CONFIG` 中的 args：

```bash
MCP_CONFIG='{
  "mcpServers": {
    "chrome-devtools": {
      "command": "chrome-devtools-mcp",
      "args": [
        "--browserUrl", "http://127.0.0.1:9222",
        "--viewport", "1280x800",
        "--headless",
        "--slim"  # 只加载 3 个基础工具
      ]
    }
  }
}'
```

### 2. 结合 vsCode Copilot

在 VS Code 中：
1. 打开 Claude Code (Ctrl+K, Ctrl+L)
2. 告诉 Claude：`启用 Chrome DevTools MCP`
3. 获取本地网页的实时数据

### 3. 组合使用多个 MCP

```bash
claude --mcp-config '{
  "mcpServers": {
    "chrome-devtools": {...},
    "filesystem": {...}
  }
}' -p "你的需求"
```

---

## 📞 快捷命令

添加到你的 shell profile (`~/.zshrc` 或 `~/.bashrc`)：

```bash
# Claude DevTools 快捷启动
alias cdt='cd /Users/zhoukeyu/Desktop/基准线/product-design && bash claude-devtools.sh'

# 启用 Chrome 调试端口并打开前端
alias chrome-devtools='pkill -9 Chrome 2>/dev/null; /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 http://localhost:3000 &'

# 一键启动所有栈
alias devstack='cd /Users/zhoukeyu/Desktop/基准线/product-design && bash dev-stack.sh'
```

然后就可以：
```bash
chrome-devtools  # 启动 Chrome
devstack        # 启动所有服务
cdt             # 启动 Claude DevTools
```

---

## ✨ 工作流示例

### 典型前端联调流程

```bash
# 终端 1：启动所有服务
devstack

# 终端 2：启动 Chrome（如果还没启动）
chrome-devtools

# 终端 3：启动 Claude
cdt

# 在 Claude 里：
# 1. 截屏看页面
# 2. 修改代码（在编辑器中）
# 3. 问 Claude"页面有什么变化吗"
# 4. 继续迭代...
```

---

## 🎓 更多信息

- Chrome DevTools MCP 文档：https://github.com/ChromeDevTools/chrome-devtools-mcp
- Anthropic 官方 MCP 规范：https://modelcontextprotocol.io
- Claude CLI 帮助：`claude --help`

祝你开发愉快！🚀
