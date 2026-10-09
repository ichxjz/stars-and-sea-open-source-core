# STARS AND SEA · Solar Atlas Core

由 [KK-Tiong_Pavelio](https://ichxjz.com) 制作的独立太阳系图谱核心。使用 React、Three.js 和 Web Worker 呈现可交互的天体、任务标记与时间轴，可在本地直接运行。

这个仓库收录 9 个天体、18 条选录任务档案、任务搜索、镜头与图层控制，以及桌面和手机布局。轨道位置、标记大小和部分小天体路径用于视觉说明，不适合导航或科研计算。

## 截图 / Screenshots

以下画面均从**本仓库的独立核心版**实际运行后截取。

| 进入图谱 / Opening | 交互图谱 / Atlas |
| :---: | :---: |
| ![桌面端进入图谱画面](docs/screenshots/intro.jpg) | ![桌面端太阳系交互图谱与时间轴](docs/screenshots/atlas.jpg) |

| 任务图鉴 / Mission index | 手机入口 / Mobile opening |
| :---: | :---: |
| ![18 条选录任务的图鉴面板](docs/screenshots/mission-index.jpg) | ![手机端进入图谱画面](docs/screenshots/mobile-intro.jpg) |

## 本地运行 / Run locally

需要 Node.js 20.19 或更新版本。

```bash
npm ci
npm run dev
```

打开终端显示的本地地址。运行 `npm run build` 构建，`npm run preview` 检查生产构建。

## 项目范围与许可 / Scope and licensing

这是可独立运行的原创核心版。[线上 STARS AND SEA 页面](https://ichxjz.com/solar/)使用尚未确认再分发许可的第三方压缩前端，因此线上页面的 206 条档案、16,626 条 GP 轨道快照、任务照片、音乐和完整界面不在本仓库内。截图仅展示本仓库包含的功能。

`src/` 原创代码采用 MIT 许可。`public/solar/textures/` 的 9 张天体贴图属于 Solar System Scope，依据 CC BY 4.0 使用；再分发时须保留署名和许可链接。其他依赖保留各自许可。资料与贴图来源见 [THIRD_PARTY.md](THIRD_PARTY.md)。

---

An independent, runnable Solar Atlas core by [KK-Tiong_Pavelio](https://github.com/ichxjz). It includes a React/Three.js scene, 18 curated mission records, search, camera and layer controls, and a timeline. Positions and marker sizes are illustrative. The deployed experience contains additional third-party code and assets that are not included here; see the scope and licensing notes above.
