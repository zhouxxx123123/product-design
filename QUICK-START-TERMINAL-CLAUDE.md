# 🚀 终端 Claude（Claude Code）前端联调 - 快速开始

你现在有了完整的前端联调工具链！以下是最快的开始方式。

---

## ⚡ 30秒快速开始

### Step 1: 启动 Chrome 调试端口（重要！）

```bash
# macOS（推荐）
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  http://localhost:3000 &

# 或用快捷命令（如果你配置了 alias）
chrome-devtools
```

### Step 2: 启动所有服务

```bash
cd /Users/zhoukeyu/Desktop/基准线/product-design
bash dev-stack.sh

# 这会启动：
# ✅ PostgreSQL + Redis (Docker)
# ✅ Backend NestJS @ :4000
# ✅ Frontend React @ :3000
# ✅ AI Service FastAPI @ :8000
```

### Step 3: 启动终端 Claude

```bash
# 新开一个终端标签，在项目目录运行：
./claude-with-mcp

# 会自动：
# ✅ 检查 Chrome 调试端口
# ✅ 连接 Chrome DevTools MCP
# ✅ 进入交互模式
```

---

## 💬 在 Claude 里做什么？

现在你就可以和 Claude 聊前端了：

```
你: 截一下首页

Claude: [会自动拍照并分析页面]

你: 点击"新建会话"按钮

Claude: [在浏览器执行点击，截图显示结果]

你: 页面 HTML 结构是什么样的？

Claude: [用 JS 获取 DOM 信息，给你详细结构]

你: 帮我检查表单验证逻辑

Claude: [运行 JS 检查表单，给出建议]
```

---

## 🎯 常见联调场景

### 场景 1：快速验证样式

```bash
# 启动 Claude
./claude-with-mcp --mode design

# 告诉 Claude
页面主色调对吗？
按钮的 hover 效果自然吗？
响应式在手机上是不是很拥挤？
```

### 场景 2：调试 API 错误

```bash
# 启动 Claude（带调试模式）
./claude-with-mcp --mode debug --debug

# 告诉 Claude
/api/sessions 接口有什么问题？
看看网络请求
执行 fetch('/api/sessions').then(r => r.json()).then(console.log)
```

### 场景 3：性能分析

```bash
# 启动 Claude
./claude-with-mcp --mode performance

# 告诉 Claude
为什么页面加载这么慢？
首屏时间多少？
哪个 API 是瓶颈？
```

### 场景 4：审查特定组件

```bash
# 直接传入文件
./claude-with-mcp src/components/SessionForm.tsx

# Claude 会：
# - 看你的代码
# - 在浏览器验证实现
# - 提出改进建议
```

---

## 📚 所有可用命令

### 基础用法

```bash
# 交互模式（推荐）
./claude-with-mcp

# 分析特定文件
./claude-with-mcp src/components/Button.tsx
./claude-with-mcp src/pages/SessionDetail.tsx

# 多个文件一起分析
./claude-with-mcp src/components/ src/pages/
```

### 选择模式

```bash
# 调试模式 - 关注 DOM/错误
./claude-with-mcp --mode debug

# 设计审查 - 关注样式/布局
./claude-with-mcp --mode design

# 性能优化 - 关注加载/渲染
./claude-with-mcp --mode performance

# 完整模式（默认）
./claude-with-mcp --mode full
```

### 高级选项

```bash
# 启用 MCP 调试日志
./claude-with-mcp --debug

# 简化模式（仅 3 个基础工具）
./claude-with-mcp --slim

# 设置视口大小
./claude-with-mcp --viewport 1920x1080

# 指定 Chrome 调试端口
./claude-with-mcp --chrome-port 9223

# 无 UI 模式（headless）
./claude-with-mcp --headless
```

### 组合使用

```bash
# 调试模式 + 日志 + 特定文件
./claude-with-mcp --mode debug --debug src/hooks/useSession.ts

# 设计审查 + 简化模式
./claude-with-mcp --mode design --slim

# 性能优化 + 自定义视口
./claude-with-mcp --mode performance --viewport 1280x800
```

---

## 🛠️ 添加别名（可选）

为了更快速地启动，可以添加别名到你的 shell 配置：

### macOS/Linux - 编辑 `~/.zshrc` 或 `~/.bashrc`

```bash
# 添加这些行到文件末尾
alias cdt='cd /Users/zhoukeyu/Desktop/基准线/product-design && ./claude-with-mcp'
alias cdt-debug='cd /Users/zhoukeyu/Desktop/基准线/product-design && ./claude-with-mcp --mode debug'
alias cdt-design='cd /Users/zhoukeyu/Desktop/基准线/product-design && ./claude-with-mcp --mode design'
alias cdt-perf='cd /Users/zhoukeyu/Desktop/基准线/product-design && ./claude-with-mcp --mode performance'

# 启动 Chrome 调试端口
alias chrome-devtools='pkill -9 Chrome 2>/dev/null; sleep 1; /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 http://localhost:3000 &'

# 启动所有栈
alias devstack='cd /Users/zhoukeyu/Desktop/基准线/product-design && bash dev-stack.sh'
```

然后重新加载配置：
```bash
source ~/.zshrc  # 或 source ~/.bashrc
```

现在就可以用快捷命令：
```bash
chrome-devtools  # 启动 Chrome
devstack        # 启动所有服务
cdt             # 启动 Claude（完整模式）
cdt-debug       # 启动 Claude（调试模式）
cdt-design      # 启动 Claude（设计模式）
cdt-perf        # 启动 Claude（性能模式）
```

---

## 📋 完整工作流示例

### 典型的一天：

```bash
# 早上：启动一切
chrome-devtools  # 终端 1
devstack        # 终端 2
cdt             # 终端 3

# 工作流：
# 1. 在编辑器里改代码
# 2. 在 Claude 里说"截一下"看效果
# 3. 遇到问题，问 Claude：
#    - "为什么表单提交失败？"
#    - "这个样式对吗？"
#    - "页面加载为什么这么慢？"
# 4. Claude 自动截屏、执行 JS、分析问题

# 遇到 bug，启用调试模式：
cdt-debug
# 告诉 Claude："怎么调试这个 bug？"
```

---

## 🔧 故障排查

### Issue 1: Chrome 调试端口连接不了

```bash
# 检查 Chrome 是否启动
lsof -i :9222

# 如果没有，重启：
pkill -9 Chrome
chrome-devtools
```

### Issue 2: Claude 命令找不到

```bash
# 检查是否安装
which claude

# 如果没有，需要安装 Claude CLI
```

### Issue 3: MCP 错误提示

```bash
# 启用调试模式看详细日志
./claude-with-mcp --debug

# 查看 Chrome 调试端口是否正常
nc -zv 127.0.0.1 9222
```

---

## ✨ 下一步

- 📖 查看详细文档：[TERMINAL-CLAUDE-GUIDE.md](./TERMINAL-CLAUDE-GUIDE.md)
- 🔗 Chrome DevTools MCP 文档：https://github.com/ChromeDevTools/chrome-devtools-mcp
- 💡 更多 MCP：https://modelcontextprotocol.io/servers

---

## 🎉 你现在拥有：

✅ **终端 Claude** - 在命令行与 Claude 交互  
✅ **Chrome DevTools MCP** - Claude 可以看到和控制浏览器  
✅ **多个工作模式** - 调试、设计、性能、完整  
✅ **一键启动脚本** - `dev-stack.sh` 和 `claude-with-mcp`  
✅ **快捷别名** - `cdt`、`devstack`、`chrome-devtools`  

**准备好了吗？现在就开始：**

```bash
chrome-devtools && devstack && cdt
```

祝你开发愉快！🚀
