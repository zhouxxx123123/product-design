# 中科琉光调研工具 - UI组件库使用文档

## 组件列表

### 1. Layout Components

#### Sidebar 侧边栏
```javascript
// 初始化侧边栏
Components.Sidebar.render('sales'); // 'sales' | 'expert' | 'admin'

// 设置用户信息
Components.Sidebar.setUser('张经理', '销售经理', 'https://...avatar.jpg');
```

#### Header 顶部栏
```javascript
// 设置页面标题
Components.Header.setTitle('调研会话列表');
```

### 2. DataDisplay Components

#### DataTable 数据表格
```javascript
const columns = [
    { key: 'name', label: '姓名' },
    { key: 'email', label: '邮箱' },
    { key: 'role', label: '角色', render: (val) => `<span class="badge">${val}</span>` },
    { key: 'actions', label: '操作', render: (_, row) => `<button>编辑</button>` }
];

const data = [
    { name: '张三', email: 'zhangsan@example.com', role: 'ADMIN' },
    { name: '李四', email: 'lisi@example.com', role: 'SALES' }
];

Components.DataTable.render('table-container', data, columns);
```

#### Pagination 分页
```javascript
Components.Pagination.render('pagination-container', {
    currentPage: 1,
    totalPages: 10,
    total: 100,
    pageSize: 10
}, (page) => {
    console.log('切换到第', page, '页');
});
```

### 3. Feedback Components

#### Modal 模态框
```javascript
// 显示确认对话框
Components.Modal.show('confirm-modal', '确认删除', '确定要删除该用户吗？', () => {
    Toast.show('删除成功', 'success');
}, () => {
    Toast.show('已取消', 'info');
});

// 隐藏模态框
Components.Modal.hide('confirm-modal');
```

### 4. Copilot Components

#### CopilotButton AI助手按钮
```javascript
Components.CopilotButton.render();
// 或指定容器
Components.CopilotButton.render('custom-container');
```

## 使用示例

### 完整页面结构
```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet">
    <script src="assets/common.js"></script>
    <script src="components/index.js"></script>
</head>
<body>
    <div class="flex h-screen">
        <!-- Sidebar -->
        <aside id="sidebar"></aside>

        <!-- Main Content -->
        <div class="flex-1 flex flex-col">
            <!-- Header -->
            <header id="header"></header>

            <!-- Page Content -->
            <main class="flex-1 p-8">
                <div id="table-container"></div>
                <div id="pagination-container"></div>
            </main>
        </div>
    </div>

    <!-- Copilot Button -->
    <div id="copilot-container"></div>

    <script>
        // 初始化组件
        Components.Sidebar.render('sales');
        Components.Sidebar.setUser('张经理', '销售经理');
        Components.Header.setTitle('会话列表');
        Components.CopilotButton.render();

        // 加载数据
        const data = [...]; // 你的数据
        const columns = [...]; // 列定义
        Components.DataTable.render('table-container', data, columns);
        Components.Pagination.render('pagination-container', {
            currentPage: 1,
            totalPages: 5,
            total: 50
        });
    </script>
</body>
</html>
```

## CSS变量

组件库依赖以下CSS变量（已在common.css中定义）：
```css
:root {
    --primary: #4f1a93;
    --bg-light: #f7f6f8;
    --bg-dark: #181220;
}
```

## 注意事项

1. 所有组件都依赖于 `common.js` 中的工具函数（如 `Toast`, `debounce`）
2. 确保在调用组件方法前，DOM元素已经存在
3. 组件使用 Tailwind CSS 类名，需要引入 Tailwind
