/**
 * 中科琉光调研工具 - 公共UI组件库
 * Components Library
 */

// ==================== Layout Components ====================

/**
 * Sidebar Component
 * 统一侧边栏导航组件
 */
const Sidebar = {
    template: `
        <aside class="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
            <!-- Logo -->
            <div class="p-6 flex items-center gap-3">
                <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <span class="material-symbols-outlined text-white text-xl">insights</span>
                </div>
                <h1 class="text-slate-900 dark:text-slate-100 font-bold text-lg">中科琉光调研工具</h1>
            </div>
            <!-- Navigation -->
            <nav class="flex-1 px-4 py-4 space-y-1" id="sidebar-nav">
                <!-- Menu items will be injected here -->
            </nav>
            <!-- User Info -->
            <div class="p-4 border-t border-slate-200 dark:border-slate-800">
                <div class="flex items-center justify-between group">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border border-slate-100 dark:border-slate-700">
                            <img class="w-full h-full object-cover" id="user-avatar" src="" alt="User"/>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-sm font-bold text-slate-900 dark:text-slate-100" id="user-name">User</span>
                            <span class="text-xs text-slate-500 dark:text-slate-400" id="user-role">Role</span>
                        </div>
                    </div>
                    <button class="p-2 text-slate-400 hover:text-red-500 transition-colors" onclick="logout()" title="退出登录">
                        <span class="material-symbols-outlined">logout</span>
                    </button>
                </div>
            </div>
        </aside>
    `,

    menuData: {
        sales: [
            { icon: 'dashboard', label: '工作台', href: '/_1/code.html', active: false },
            { icon: 'folder_shared', label: '客户档案', href: '/_2/code.html', active: false },
            { icon: 'chat', label: '调研会话', href: '/_3/code.html', active: true },
            { icon: 'manage_search', label: '案例库检索', href: '/_4/code.html', active: false },
        ],
        expert: [
            { icon: 'assignment', label: '专家工作台', href: '/_15/code.html', active: false },
            { icon: 'work', label: '案例库管理', href: '/_16/code.html', active: false },
            { icon: 'insights', label: '调研整理', href: '/_13/code.html', active: false },
        ],
        admin: [
            { icon: 'dashboard', label: '管理看板', href: '/_5/code.html', active: false },
            { icon: 'group', label: '用户管理', href: '/user-management/code.html', active: false },
            { icon: 'apartment', label: '租户管理', href: '/_9/code.html', active: false },
            { icon: 'settings', label: '系统配置', href: '/_17/code.html', active: false },
            { icon: 'history', label: '审计日志', href: '/_9/code.html', active: false },
        ]
    },

    render(role = 'sales') {
        const menu = this.menuData[role] || this.menuData.sales;
        const nav = document.getElementById('sidebar-nav');
        if (!nav) return;

        nav.innerHTML = `
            <div class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">
                ${role === 'sales' ? 'Sales' : role === 'expert' ? 'Expert' : 'Admin'} Role
            </div>
            ${menu.map(item => `
                <a class="flex items-center gap-3 px-3 py-2.5 ${item.active ? 'active-link' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'} rounded-lg transition-colors group" href="${item.href}">
                    <span class="material-symbols-outlined ${item.active ? 'text-primary' : 'text-slate-500 group-hover:text-primary'} transition-colors" style="${item.active ? 'font-variation-settings: \'FILL\' 1' : ''}">${item.icon}</span>
                    <span class="text-sm ${item.active ? 'font-semibold' : 'font-medium'}">${item.label}</span>
                </a>
            `).join('')}
        `;

        // 绑定点击事件
        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                nav.querySelectorAll('a').forEach(l => {
                    l.classList.remove('active-link');
                    l.classList.add('text-slate-600', 'dark:text-slate-400');
                    l.querySelector('.material-symbols-outlined')?.classList.remove('text-primary');
                    l.querySelector('.material-symbols-outlined')?.classList.add('text-slate-500');
                });
                this.classList.add('active-link');
                this.classList.remove('text-slate-600', 'dark:text-slate-400');
                this.querySelector('.material-symbols-outlined')?.classList.add('text-primary');
                this.querySelector('.material-symbols-outlined')?.classList.remove('text-slate-500');
            });
        });
    },

    setUser(name, role, avatar) {
        document.getElementById('user-name')?.textContent = name;
        document.getElementById('user-role')?.textContent = role;
        document.getElementById('user-avatar')?.src = avatar || `https://ui-avatars.com/api/?name=${name}&background=4f1a93&color=fff`;
    }
};

/**
 * Header Component
 * 统一顶部栏组件
 */
const Header = {
    template: `
        <header class="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 shrink-0">
            <!-- Left: Breadcrumb -->
            <nav class="flex items-center text-sm text-slate-500 dark:text-slate-400">
                <a class="hover:text-primary transition-colors" href="#">首页</a>
                <span class="mx-2 text-slate-300 dark:text-slate-600">/</span>
                <span class="text-slate-900 dark:text-slate-100 font-medium" id="page-title">当前页面</span>
            </nav>
            <!-- Right: Actions -->
            <div class="flex items-center gap-4">
                <button class="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
                    <span class="material-symbols-outlined">notifications</span>
                    <span class="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                </button>
                <button class="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all" onclick="toggleDarkMode()">
                    <span class="material-symbols-outlined" id="dark-mode-icon">light_mode</span>
                </button>
                <div class="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <button class="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                    <span class="material-symbols-outlined text-sm">help</span>
                    帮助文档
                </button>
            </div>
        </header>
    `,

    setTitle(title) {
        document.getElementById('page-title')?.textContent = title;
    }
};

// ==================== DataDisplay Components ====================

/**
 * DataTable Component
 * 数据表格组件
 */
const DataTable = {
    render(containerId, data, columns) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <table class="w-full text-left text-sm">
                <thead class="bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                        ${columns.map(col => `
                            <th class="px-6 py-3 font-semibold ${col.class || ''}">${col.label}</th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                    ${data.map((row, index) => `
                        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            ${columns.map(col => `
                                <td class="px-6 py-4 ${col.class || ''}">
                                    ${col.render ? col.render(row[col.key], row, index) : row[col.key]}
                                </td>
                            `).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
};

/**
 * Pagination Component
 * 分页组件
 */
const Pagination = {
    render(containerId, { currentPage = 1, totalPages = 1, total = 0, pageSize = 10 }, onChange) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min(currentPage * pageSize, total);

        container.innerHTML = `
            <div class="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                <div class="text-sm text-slate-500">
                    显示 ${start} 到 ${end} 条，共 ${total} 条
                </div>
                <div class="flex items-center gap-2">
                    <button class="pagination-prev px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}" ${currentPage === 1 ? 'disabled' : ''}>
                        <span class="material-symbols-outlined text-sm">chevron_left</span>
                    </button>
                    ${this.renderPageNumbers(currentPage, totalPages)}
                    <button class="pagination-next px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}" ${currentPage === totalPages ? 'disabled' : ''}>
                        <span class="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                </div>
            </div>
        `;

        // 绑定事件
        container.querySelector('.pagination-prev')?.addEventListener('click', () => {
            if (currentPage > 1) onChange?.(currentPage - 1);
        });
        container.querySelector('.pagination-next')?.addEventListener('click', () => {
            if (currentPage < totalPages) onChange?.(currentPage + 1);
        });
        container.querySelectorAll('.pagination-page').forEach(btn => {
            btn.addEventListener('click', () => onChange?.(parseInt(btn.dataset.page)));
        });
    },

    renderPageNumbers(current, total) {
        let html = '';
        for (let i = 1; i <= total; i++) {
            if (i === current) {
                html += `<button class="pagination-page px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium" data-page="${i}">${i}</button>`;
            } else {
                html += `<button class="pagination-page px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-800" data-page="${i}">${i}</button>`;
            }
        }
        return html;
    }
};

// ==================== Feedback Components ====================

/**
 * Modal Component
 * 模态框组件
 */
const Modal = {
    show(id, title, content, onConfirm, onCancel) {
        const modal = document.getElementById(id) || this.create(id, title, content);
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        modal.querySelector('.modal-confirm')?.addEventListener('click', () => {
            onConfirm?.();
            this.hide(id);
        });
        modal.querySelector('.modal-cancel')?.addEventListener('click', () => {
            onCancel?.();
            this.hide(id);
        });
    },

    hide(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    create(id, title, content) {
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/50 backdrop-blur-sm';
        modal.innerHTML = `
            <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h3 class="text-lg font-bold mb-4">${title}</h3>
                <div class="mb-6">${content}</div>
                <div class="flex gap-3 justify-end">
                    <button class="modal-cancel px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
                    <button class="modal-confirm px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg">确认</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }
};

// ==================== Copilot Component ====================

/**
 * CopilotButton Component
 * AI助手浮动按钮
 */
const CopilotButton = {
    render(containerId = 'copilot-container') {
        const container = document.getElementById(containerId) || document.createElement('div');
        container.id = containerId;
        container.className = 'fixed bottom-6 right-6 z-50';
        container.innerHTML = `
            <button class="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-2xl shadow-primary/40 hover:scale-110 active:scale-95 transition-transform" onclick="openCopilot()">
                <span class="material-symbols-outlined text-3xl">smart_toy</span>
            </button>
        `;
        document.body.appendChild(container);
    }
};

// ==================== Export ====================

window.Components = {
    Sidebar,
    Header,
    DataTable,
    Pagination,
    Modal,
    CopilotButton
};
