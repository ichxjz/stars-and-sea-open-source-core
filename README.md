# STARS AND SEA · Solar Atlas Core

由 [KK-Tiong_Pavelio](https://ichxjz.com) 制作的独立太阳系图谱核心。使用 React、Three.js 和 Web Worker 呈现可交互的天体、任务标记与时间轴，可在本地直接运行。[线上 STARS AND SEA 页面在线预览](https://ichxjz.com/KK-Tiong_Pavelio)

仓库收录 9 个天体、18 条选录任务档案、任务搜索、镜头与图层控制，以及桌面和手机布局。轨道位置、标记大小和部分小天体路径用于视觉说明，不适合导航或科研计算。

## 最新线上界面 GIF / Latest deployed experience

以下 **八张 GIF 已全部重新录制，替换旧版 GIF**。每一帧均带有 **KK-Tiong_Pavelio** 字符水印，来自同一份最终网站构建的真实操作；没有伪造进度、修改时间或合成卫星轨迹。

| 加载到启动页 · 0–100% | 进入图谱后的太阳系总览 |
| --- | --- |
| ![KK-Tiong_Pavelio 实际加载进度与启动页](docs/demos/online-startup.gif) | ![KK-Tiong_Pavelio 最新太阳系总览](docs/demos/online-overview.gif) |

| 点击地球并放大 | 点击卫星生成运动轨迹 |
| --- | --- |
| ![KK-Tiong_Pavelio 地球特写与逐次放大](docs/demos/online-earth-zoom.gif) | ![KK-Tiong_Pavelio 三颗卫星与真实推算轨迹](docs/demos/online-satellite-orbits.gif) |

| 左键拖动地球 | 火星与任务档案 |
| --- | --- |
| ![KK-Tiong_Pavelio 左键拖动旋转地球](docs/demos/online-left-drag.gif) | ![KK-Tiong_Pavelio 火星](docs/demos/online-mars.gif) |

| 木星与任务档案 | 土星与任务档案 |
| --- | --- |
| ![KK-Tiong_Pavelio 木星](docs/demos/online-jupiter.gif) | ![KK-Tiong_Pavelio 土星](docs/demos/online-saturn.gif) |

录制日期为 **2026-10-17**。启动百分比表示场景与镜头可操作就绪；高清图库按实际下载／解码另行计数。100% 末帧来自真实浏览器合成器，卫星轨迹各有 241 个推算样点，不是实时遥测。录制尺寸、帧数及校验值见 [recordings.json](docs/demos/recordings.json)。

**这些 GIF 展示[完整线上版本](https://ichxjz.com/KK-Tiong_Pavelio)，不表示本独立核心已经包含全部功能。** 本仓库仍为 9 个天体、18 条选录任务的原创核心；未加入线上第三方前端、GP 快照、私人后台、任务照片或音乐。GIF 使用额外的固定录制署名，网站地球特写本身仍按设置隐藏界面水印。

## 0.2.0 更新 / Changes

- 首次有效绘制与轨道 Worker 就绪后即可进入，高清贴图后台加载；加载失败时保留基础色彩，并明确显示失败数，不将失败计为完成。
- 触屏轻触在松手位置重新拾取；拖动和双指操作不会误开天体资料。
- 黑色主题界面，保留真实天体贴图的原有颜色。提供桌面与移动端实际截图。

## 截图 / Screenshots

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

这是可独立运行的原创核心版。[线上 STARS AND SEA 页面](https://ichxjz.com/KK-Tiong_Pavelio)使用尚未确认再分发许可的第三方压缩前端，因此线上页面的 206 条档案、持续更新的 GP 轨道快照、任务照片、音乐和完整界面不在本仓库内。截图展示本仓库包含的功能；本轮八张 GIF 明确展示完整线上版本，其功能范围与独立核心有别。

`src/` 原创代码采用 MIT 许可。`public/solar/textures/` 的 9 张天体贴图属于 Solar System Scope，依据 CC BY 4.0 使用；再分发时须保留署名和许可链接。其他依赖保留各自许可。GIF 和截图也包含这些天体贴图，转用时同样须保留署名。资料与贴图来源见 [THIRD_PARTY.md](THIRD_PARTY.md)。

---

An independent, runnable Solar Atlas core by [KK-Tiong_Pavelio](https://github.com/ichxjz). It includes a React/Three.js scene, 18 curated mission records, search, camera and layer controls, and a timeline. Positions and marker sizes are illustrative. The deployed experience contains additional third-party code and assets that are not included here; see the scope and licensing notes above.

Version 0.2.0 adds black-theme browser recordings, non-blocking texture loading with honest failure counts, and touch picking at pointer release. The scene becomes interactive after its first valid render and orbit Worker response; texture downloads continue in the background.
