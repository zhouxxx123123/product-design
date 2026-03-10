// 中科琉光调研工具 - 全局公共JavaScript

// ==================== 暗黑模式 ====================
function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');

    // 更新图标
    const icon = document.querySelector('#dark-mode-icon');
    if (icon) {
        icon.textContent = isDark ? 'dark_mode' : 'light_mode';
    }
}

// 初始化暗黑模式
function initDarkMode() {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
        document.documentElement.classList.add('dark');
    }
}

// ==================== 通知系统 ====================
const Toast = {
    container: null,

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
            document.body.appendChild(this.container);
        }
    },

    show(message, type = 'info', duration = 3000) {
        this.init();

        const colors = {
            info: 'bg-blue-500',
            success: 'bg-emerald-500',
            warning: 'bg-amber-500',
            error: 'bg-rose-500'
        };

        const icons = {
            info: 'info',
            success: 'check_circle',
            warning: 'warning',
            error: 'error'
        };

        const toast = document.createElement('div');
        toast.className = `${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] animate-fade-in`;
        toast.innerHTML = `
            <span class="material-symbols-outlined">${icons[type]}</span>
            <span class="font-medium">${message}</span>
            <button class="ml-auto hover:opacity-70" onclick="this.parentElement.remove()">
                <span class="material-symbols-outlined">close</span>
            </button>
        `;

        this.container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

// ==================== 表单验证 ====================
const FormValidator = {
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    validatePhone(phone) {
        const re = /^1[3-9]\d{9}$/;
        return re.test(phone);
    },

    validateRequired(value) {
        return value && value.trim().length > 0;
    },

    showError(input, message) {
        input.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-500');
        input.classList.remove('border-slate-200', 'focus:border-primary', 'focus:ring-primary');

        // 查找或创建错误提示
        let errorEl = input.parentElement.querySelector('.error-message');
        if (!errorEl) {
            errorEl = document.createElement('p');
            errorEl.className = 'error-message text-red-500 text-xs mt-1';
            input.parentElement.appendChild(errorEl);
        }
        errorEl.textContent = message;
    },

    clearError(input) {
        input.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-500');
        input.classList.add('border-slate-200', 'focus:border-primary', 'focus:ring-primary');

        const errorEl = input.parentElement.querySelector('.error-message');
        if (errorEl) {
            errorEl.remove();
        }
    }
};

// ==================== 防抖函数 ====================
function debounce(fn, delay = 300) {
    let timer = null;
    return function(...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}

// ==================== 搜索功能 ====================
function initSearch(inputSelector, callback) {
    const input = document.querySelector(inputSelector);
    if (!input) return;

    const debouncedSearch = debounce((value) => {
        callback(value);
    }, 300);

    input.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
    });
}

// ==================== 分页功能 ====================
const Pagination = {
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,

    init(containerSelector, options = {}) {
        this.currentPage = options.currentPage || 1;
        this.totalPages = options.totalPages || 1;
        this.pageSize = options.pageSize || 10;
        this.onChange = options.onChange || (() => {});

        this.render(containerSelector);
    },

    render(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = `
            <div class="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                <div class="text-sm text-slate-500">
                    显示 ${(this.currentPage - 1) * this.pageSize + 1} 到 ${Math.min(this.currentPage * this.pageSize, this.totalPages * this.pageSize)} 条，共 ${this.totalPages * this.pageSize} 条
                </div>
                <div class="flex items-center gap-2">
                    <button class="pagination-prev px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm ${this.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}" ${this.currentPage === 1 ? 'disabled' : ''}>
                        <span class="material-symbols-outlined text-sm">chevron_left</span>
                    </button>
                    ${this.renderPageNumbers()}
                    <button class="pagination-next px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm ${this.currentPage === this.totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}" ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                        <span class="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                </div>
            </div>
        `;

        // 绑定事件
        container.querySelector('.pagination-prev')?.addEventListener('click', () => this.prev());
        container.querySelector('.pagination-next')?.addEventListener('click', () => this.next());
        container.querySelectorAll('.pagination-page').forEach(btn => {
            btn.addEventListener('click', (e) => this.goTo(parseInt(e.target.dataset.page)));
        });
    },

    renderPageNumbers() {
        let html = '';
        for (let i = 1; i <= this.totalPages; i++) {
            if (i === this.currentPage) {
                html += `<button class="pagination-page px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium" data-page="${i}">${i}</button>`;
            } else {
                html += `<button class="pagination-page px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-800" data-page="${i}">${i}</button>`;
            }
        }
        return html;
    },

    prev() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.onChange(this.currentPage);
            this.render();
        }
    },

    next() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.onChange(this.currentPage);
            this.render();
        }
    },

    goTo(page) {
        if (page !== this.currentPage) {
            this.currentPage = page;
            this.onChange(this.currentPage);
            this.render();
        }
    }
};

// ==================== 录音控制 ====================
const AudioRecorder = {
    isRecording: false,
    isPaused: false,
    startTime: null,
    timerInterval: null,

    start() {
        this.isRecording = true;
        this.isPaused = false;
        this.startTime = Date.now();

        // 更新UI
        document.querySelector('#record-btn')?.classList.add('hidden');
        document.querySelector('#pause-btn')?.classList.remove('hidden');
        document.querySelector('#stop-btn')?.classList.remove('hidden');
        document.querySelector('#recording-indicator')?.classList.remove('hidden');

        // 开始计时
        this.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 1000);

        Toast.show('录音已开始', 'info');
    },

    pause() {
        this.isPaused = !this.isPaused;

        const pauseBtn = document.querySelector('#pause-btn');
        if (this.isPaused) {
            clearInterval(this.timerInterval);
            pauseBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
            Toast.show('录音已暂停', 'warning');
        } else {
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);
            pauseBtn.innerHTML = '<span class="material-symbols-outlined">pause</span>';
            Toast.show('录音继续', 'info');
        }
    },

    stop() {
        this.isRecording = false;
        this.isPaused = false;
        clearInterval(this.timerInterval);

        // 更新UI
        document.querySelector('#record-btn')?.classList.remove('hidden');
        document.querySelector('#pause-btn')?.classList.add('hidden');
        document.querySelector('#stop-btn')?.classList.add('hidden');
        document.querySelector('#recording-indicator')?.classList.add('hidden');

        Toast.show('录音已保存', 'success');
    },

    updateTimer() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');

        const timerEl = document.querySelector('#recording-timer');
        if (timerEl) {
            timerEl.textContent = `${minutes}:${seconds}`;
        }
    }
};

// ==================== 实时转写模拟 ====================
const LiveTranscription = {
    isActive: false,
    container: null,

    init(containerSelector) {
        this.container = document.querySelector(containerSelector);
    },

    start() {
        this.isActive = true;
        this.simulateTranscription();
    },

    stop() {
        this.isActive = false;
    },

    simulateTranscription() {
        if (!this.isActive || !this.container) return;

        const phrases = [
            "我们正在考虑引入新的CRM系统",
            "目前的痛点是数据孤岛问题",
            "销售团队和客服团队使用不同的工具",
            "月底报表需要人工汇总",
            "希望能实现自动化数据分析"
        ];

        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        this.addTranscript(phrase);

        setTimeout(() => this.simulateTranscription(), 3000 + Math.random() * 2000);
    },

    addTranscript(text) {
        if (!this.container) return;

        const item = document.createElement('div');
        item.className = 'flex gap-3 animate-fade-in';
        item.innerHTML = `
            <span class="text-xs text-slate-400 mt-1">${new Date().toLocaleTimeString()}</span>
            <div class="flex-1">
                <p class="text-slate-700 dark:text-slate-300">${text}</p>
            </div>
        `;

        this.container.appendChild(item);
        this.container.scrollTop = this.container.scrollHeight;
    }
};

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    initDarkMode();

    // 为所有暗黑模式切换按钮绑定事件
    document.querySelectorAll('[onclick="toggleDarkMode()"]').forEach(btn => {
        btn.addEventListener('click', toggleDarkMode);
    });
});

// 导出全局函数
window.toggleDarkMode = toggleDarkMode;
window.Toast = Toast;
window.FormValidator = FormValidator;
window.debounce = debounce;
window.initSearch = initSearch;
window.Pagination = Pagination;
window.AudioRecorder = AudioRecorder;
window.LiveTranscription = LiveTranscription;
