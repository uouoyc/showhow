# Showhow

自托管的浏览器操作录制与交互式 Walkthrough 发布工具

[English](README.md)

## 快速开始

### 环境要求

- Node.js >= 24.14.0
- pnpm >= 11.22.0
- Chrome

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置 AI（可选）

```bash
cp web/.env.example web/.env
```

编辑 `web/.env`，配置兼容 OpenAI Responses API 的模型：

```dotenv
AI_BASE_URL=https://api.openai.com/v1
AI_TOKEN=your-token
AI_MODEL=gpt-5-mini
```

未配置 `AI_TOKEN` 时，Step 描述将使用录制到的元素标签。

### 3. 启动服务

```bash
pnpm dev
```

Web 应用运行在 `http://localhost:3000`。

### 4. 加载扩展

```bash
pnpm --filter extension build
```

打开 Chrome 的 `chrome://extensions`，开启「开发者模式」→「加载已解压的扩展程序」，选择 `extension/` 目录。

### 5. 录制与发布

1. 扩展连接 `http://localhost:3000`，输入标题后点击 **Start recording**
2. 在页面上完成点击流程，点击 **Stop recording**
3. 扩展自动打开编辑器，支持：
   - 修改 Walkthrough 标题和 CTA URL
   - 编辑每个 Step 的标题和描述
   - 拖拽或 Up/Down 调整 Step 顺序
   - 删除 Step、下载截图、导出 JSON
4. 复制公开链接（`/w/[slug]`）或 iframe 嵌入代码

CTA URL 会在读者完成最后一个 Step 后显示为 **Continue** 按钮。

## 项目结构

```text
showhow/
├── extension/          # Chrome MV3 扩展（录制、截图、上传）
├── web/                # Next.js 16 应用（编辑器、Replay、API）
│   ├── data/           # SQLite + 截图目录（由 DATA_DIR 指定）
│   └── drizzle/        # 数据库迁移文件（请勿删除）
```

**录制链路：**

```text
页面点击 → content script → service worker 截图 → Web API → SQLite + screenshots/
```

## 部署

### Docker Compose

首次启动或代码变更时：

```bash
docker compose up -d --build
```

镜像已是最新时：

```bash
docker compose up -d
```

### 数据目录

默认使用 `web/data/`：

```text
web/data/
├── showhow.db
└── screenshots/
```

## 维护

### 备份

停止服务后，复制整个 `DATA_DIR`（包含 `showhow.db` 和 `screenshots/`）。恢复时放回原目录即可。

### 测试

```bash
pnpm format      # 格式化
pnpm lint        # 代码检查
pnpm typecheck   # 类型检查
pnpm test        # 单元测试
pnpm test:e2e    # E2E 测试
pnpm build       # 构建
```

E2E 覆盖：创建 Walkthrough、保存截图、编辑器、拖拽排序、公开 Replay、Hotspot、完成统计。

## 限制

- 原始点击不会被阻塞或重放，截图可能已是点击后状态
- 连续截图间隔至少 500ms
- 扩展/service worker 重启后，待上传队列不恢复
- Recording 绑定原始 tab，切换 tab 后的点击会被拒绝
- 无法录制：Chrome 内部页面、Chrome Web Store、拒绝 content script 的页面
- 跨域 iframe 点击会捕获外层页面截图；沙盒 iframe、不可访问 frame、旋转/倾斜变换可能导致截图失败或 Hotspot 偏移
