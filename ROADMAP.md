# MyTerra — 规格与开发计划

> 修订版。取代初版纯设计规格。
> 本文档分两部分：
> - **第一部分 · 规格**：不可随意变更的设计决策。所有改动必须走第 19 节的勘误流程。
> - **第二部分 · 开发计划**：真正施工用的施工单。里程碑、验收标准、任务分解。
>
> 状态：`v0.1 设计冻结` ｜ 工具链：Vite + TypeScript (strict) ｜ 更新：2026-10-07
> 下一步：M2 玩家、物理、状态
> 计划调整（2026-10-07）：创造模式拆分——「M4 创造沙盒（开发工具）」前置，完整创造面板/无限物品/跳过合成并入 M11；UI 与设置后移到内容扩展之后；里程碑整体重排（详见第 24、25、29、31 节）。

---

## 0. 如何使用本文档

| 场景 | 看哪部分 |
|---|---|
| 我要写某个系统 | 第二部分对应里程碑的「任务」+ 第一部分对应规格节 |
| 有人提出新功能 | 先查第 20 节「明确排除」，再查第 29 节「削减优先级」 |
| 设计有歧义/冲突 | 第 19 节「规格勘误与补充」已定稿，按它执行，不再讨论 |
| 判断一个里程碑能不能算做完 | 第 30 节「完成定义 DoD」+ 该里程碑的「验收」 |
| 时间不够要砍东西 | 第 29 节，按顺序砍，不许跳着砍 |

原则：
- 规格里没有的东西，默认**不做**，不许顺手加。
- 每个里程碑必须留下一个**可玩、能存盘的构建**。做不到就不算里程碑完成。
- 数值只允许在 `src/data/tuning.ts` 里改，别处硬编码视为 bug。

---

# 第一部分 · 规格

## 1. 项目概述

- 2D 瓦片沙盒平台游戏，受 Terraria 启发。
- 网页游戏，静态部署，**运行时零外部请求**（无 CDN、无 fetch、无 WebSocket）。
- 纯沙盒：无目的、无任务、无固定事件、无魔法、无 NPC、无 Boss。
- 英文界面（唯一语言，不做 i18n 框架，字符串直接内联）。
- 无音频（不调用 AudioContext）。
- 无外部资源文件：所有贴图**在启动时用 Canvas 程序化生成**。
- 单人，本地存档（IndexedDB）。
- 生存 + 创造两种模式，用能力标志切换。

## 2. 技术栈与工程约束

- 语言：TypeScript，`strict: true` + `noUncheckedIndexedAccess: true`。
- 构建：Vite 5（仅开发/构建期依赖，不进产物）。
- 渲染：HTML5 Canvas 2D，1 格 = 16 逻辑像素，整数缩放，像素完美对齐。
- UI：HTML/CSS DOM overlay，不在 canvas 里画 UI。
- 测试：Vitest（纯逻辑单测，无 DOM 测试）。
- 架构：分层混合，不用完整 ECS（理由见第 16 节）。
- 游戏循环：固定时间步 60 Hz + `requestAnimationFrame` 渲染 + 累加器；单帧最多补 5 步，累加器上限 0.25 s。
- 存档：IndexedDB，二进制 `Blob`（见第 15 节）。
- 部署：静态托管，`vite build` 产物直接丢上去。

硬约束：
- 运行时不得有任何 `fetch` / `XMLHttpRequest` / `import()` 远程地址 / `new Image()` 指向外部 URL。
- 不得引入运行时第三方库。依赖表只允许 `vite`、`typescript`、`vitest`、`eslint`、`prettier`（全部 devDependencies）。

## 3. 世界结构与内存

### 坐标与尺寸

- 瓦片坐标 `(x, y)`，整数。1 格 = 16 px。
- `CHUNK = 32` 格见方。**chunk 只是生成批次单位和缓冲区长度单位，没有生命周期管理**（不加载/卸载/常驻）。
- 垂直固定：`y = -512 … +511`，共 1024 格。
- 顶部 `y = -512` 是硬边界外沿，玩家不可越过。
- 底部 `y = +511` 基岩层：不可挖掘、不可放置、不可穿过、阻挡光照。
- 水平总宽度 = 可达宽度 + 两侧各 4 chunk（128 格）。
- 玩家可达：`x ∈ [0, W_reach-1]`，`y ∈ [-511, +510]`。

宽度选项：

| 选项 | 可达宽度 | 总列数 | 总格数 | 网格内存 |
|---|---|---|---|---|
| Small | 2048 | 2304 | 2.36 M | ~14 MB |
| Medium | 8192 | 8448 | 8.65 M | ~52 MB |
| Large | 16384 | 16640 | 17.04 M | ~102 MB |
| Custom | 1024 – 32768 | +256 | ≤ 33.8 M | ≤ 203 MB |

- 每格 6 字节：`fg(1) + wall(1) + skyDepth(1) + blockLight(1) + liquidType(1) + liquidAmount(1)`。
- 上表不含临时缓冲（生成噪声缓存、BFS 队列、chunk 离屏 canvas），峰值再加 30–50 MB。
- **默认世界 = Medium。** Large/Custom 创建时弹内存提示。Custom 上限 32768 在 32 位环境可能 OOM，超限要报错而不是崩。

### 缓冲区

- 缓冲区只服务于世界生成平滑过渡（避免地表高度在边缘突变）。
- 缓冲区不渲染、不碰撞、不参与液体/沙/光照更新、不参与敌人生成。
- 玩家的世界边界检测用可达范围，不含缓冲区。

### 存储原则

- 整个世界常驻内存，`TypedArray`，无内外存交换，无区块流式加载。
- 更新一律是局部的（脏区 + 活跃队列），不做全图每帧扫描。**任何 `for` 遍历整个世界数组的代码都算 bug**（例外：世界生成一次性任务、切世界时）。

## 4. 瓦片系统

### 类型分类

- 实心：阻挡移动、阻挡光照。
- 可通过：不阻挡移动、不阻挡光照。
- 背景墙：第三通道，不参与上面任何判定。

### 方块与液体互斥

- 一格前景只能是：空气 / 液体 / 实心块 / 可通过块 之一。
- 放置方块 → 该格液体被挤到相邻可容纳格，放不下就消失。
- 液体与背景墙**可以**共存。

### 门

- 门占 2 格高，开/关两种状态。
- 实现方式：前景瓦片用 4 个 ID 表达（`DoorTopClosed`、`DoorTopOpen`、`DoorBottomClosed`、`DoorBottomOpen`）。**不单独存门状态列表** —— 因为它已经是瓦片差异的一部分，存档自动覆盖（勘误 #1）。
- 门开着时两格都可通过、不阻挡光照。

### 背景墙

- 只能自然生成，玩家不能放、不能挖、不能移除。
- 不阻挡移动、不阻挡光照、不参与碰撞、不影响挖掘、不参与敌人生成。
- **不进存档** —— 因此世界生成器必须完全确定性：`genVersion + seed + width` 相同 → 背景墙逐格相同（勘误 #4）。

### 不存在

- 无平台、无半砖、无楼梯、无可攀爬自动上台阶（玩家要跳）。

## 5. 液体系统

### 模型

- 有限体积，世界里没有天然液源（生成时一次性灌满水池/岩浆池）。
- 每格：`liquidType ∈ {None, Water, Lava}` + `liquidAmount ∈ [0, 100]`。
- 液体附着在网格上，不是一类实体。

### 更新

- 离散逐步，固定时间步。
- 向下 → 斜下（左/右）→ 水平（按液面差）。
- 单次转移量 `= min(源液量, 目标余量, 25, |液面差| / 2)`，结果向下取整。
- 休眠条件：本格非满，且下方不可流，且左右液面差 < 2，且本格液量 ≤ 2。
- 活跃队列（环形队列，去重标记用 `Uint8Array` 位图）+ 每帧预算 2 ms，超出留到下一帧。
- **防爆阀**：单帧单格最多处理一次；全局每 tick 处理格数上限 20000，超限只保留队列尾部（勘误 #3）。

### 交互

- 水 + 岩浆 → 黑曜石（岩浆侧）或石头（水侧），双方液体各扣。
- 玩家进液体：浮力 + 阻力 + 上浮键；水不改跳跃为游泳（重力减半 + 上浮）。
- 水：移动速度 ×0.55。岩浆：每秒 30 伤害 + 屏幕红色覆盖。
- 液体参与光照：进入液体格传播衰减 +3（勘误 #2）。

### 存档

- 只存 `liquidType` + `liquidAmount` 差异。
- 不存活跃队列、休眠状态、渲染波动。加载后用「所有非零液体格」重建活跃队列。

## 6. 沙子系统

- 离散方块：沙、雪堆用独立的 `falling` 标记表示「这里是沙」，本身不可放置、不可通过（除 falling 状态下）。
- 每 tick 最多下移 1 格，绝不合并、绝不部分转移。
- 下方可占据 → 下移；否则尝试左下/右下（交替尝试，按固定序列，保证确定性）；都不行 → 落定为静态。
- 每帧预算 1 ms，活跃队列 + 去重位图，**单帧单格一次**。
- 落入液体：挤掉液体，液体转移到相邻有余量的格；沙变静态。
- 沙移动后把经过的格子标脏（给光照）。
- 存档只存「哪些格是沙」，不存下落状态；加载后全部当静态。

## 7. 光照系统

### 双通道与天空深度模型

- 最终亮度 = `max(sky, block)`。
- **`sky` 存的是「从天空衰减了多远」（0–255），不是最终亮度。** 渲染时再乘昼夜因子：`skyFinal = (255 - skyDepth) * dayFactor`。
  这样昼夜切换**零重算**，也符合第 19 节勘误 #2。
- `blockLight` 存最终亮度（0–255），多光源取最大值，不累加。
- `dayFactor`：白天 1.0，夜晚 40/255 ≈ 0.157，按一天曲线插值。

### 天空光

- 列扫描：从 `y = -511` 往下，遇到实心块/基岩截断该列传播，空气不衰减。
- 被截断后由水平 BFS 继续扩散，衰减 1（格）。
- 一昼夜 20 分钟 = 1200 s。`timeOfDay ∈ [0,1)`，0.25 = 正午，新世界从 0.30 起步。

### 方块光

- BFS 四邻传播，衰减 1（格），桶队列（bucket queue，按亮度层级 255→1）。
- 实心块完全阻挡；背景墙和可通过块不阻挡。
- 光源：火把 200，岩浆格 180，其余矿石发光。

### 删除算法（关键，两阶段）

放置/破坏方块后必须**正确移除**过时光：
1. 先做**移除 BFS**：把所有「因被遮挡方块截断而导致当前亮度 > 邻居可提供亮度」的格子入队，按亮度从高到低清零。
2. 再做**添加 BFS**：从被修改格及所有光源出发重新传播。
- 漏掉第一阶段 = 关掉墙后洞里永久残留亮斑。必须有单元测试覆盖（第 26 节 T-LIGHT-3）。

### 更新策略

- 事件驱动脏区 + 每帧预算 1 ms（限制 BFS 节点数，超出留到下一帧）。
- 不做平滑光照、不做可见性遮挡（接受看到封闭洞穴里的亮区）。
- 光照不存档，加载后全量重算（有 debug 强制命令 `F9 + 重算光照`）。

## 8. 玩家

### 物理

- 碰撞盒 `0.8 × 1.8` 格（12.8 × 28.8 px）。
- 分轴扫掠 AABB vs 网格（先 X 后 Y），标准台阶无关。
- 初值：重力 30 格/s²，最大下落速度 30 格/s，移动速度 15 格/s，跳跃高度 6 格（初速 `√(2·g·h) ≈ 19` 格/s），地面加速度 60 格/s²、空中加速度 30 格/s²、地面摩擦 40 格/s²。
- 无冲刺、无自动跳跃、无二段跳、无钩爪。
- **无坠落伤害**（勘误 #6）。
- 水中：重力 ×0.5，最大下落 8 格/s，上浮键给 12 格/s 向上速度；跳出水面保留动量。
- 飞行（创造）：`W/S` 上下 15 格/s，`A/D` 水平 20 格/s，无重力。

### 生存状态

| 状态 | 上限 | 规则 |
|---|---|---|
| Health | 100 | 初始满。归零 → 死亡。饱食 > 80 时 +1/s。 |
| Hunger | 100 | 初始满。-0.07/s（约 24 分钟见底）。到 0 → -2 HP/s。0 不可再降。 |
| Breath | 100 | 头部在水中 -6.7/s（15 秒溺完）。离开水 +40/s。0 时溺水 -5 HP/s。 |

- 食物：生肉 +20（+5 饥饿），熟肉 +40（+15 饥饿）。吃下去有 0.8 s 使用动作，期间不能动。
- 无魔力、无药水、无增益减益。

### 死亡与重生

- 死亡 → 死亡界面 → Respawn：满血满饥饿满呼吸，传送到重生点。
- 重生点默认世界出生点；床可重置（床 ID，`M10` 投放）。
- **死亡保留背包**（勘误 #5）。不做尸体/掉落复归。

### 物品栏

- 背包 40 格（5×2 + 5×6 视觉布局），其中第 1–10 格为快捷栏。
- 最大堆叠 999（箭等特殊物品 200）。
- 装备槽 5 个：头盔 / 胸甲 / 腿甲 / 武器 / 弹药。**无饰品槽**。
- 弹药槽：弓箭必须有弓在武器槽 + 箭在弹药槽才能发射。

## 9. 战斗与生物

### 战斗

- 近战：剑类，朝面向挥砍 90° 扇形，冷却 0.4 s，命中无敌帧 0.5 s，击退。
- 远程：弓 + 箭，蓄力 0.6 s 出箭，初速 22 格/s，重力 6 格/s²，箭有实体。
- 无魔法、无魔力、无弹幕屏弹幕。

### 敌人（投放见第 25 节）

| 敌人 | 行为 | HP | 接触伤害 | 掉落 |
|---|---|---|---|---|
| Zombie | 地面行走，追玩家，跳跃过障碍 | 40 | 8 | 凝胶 / 生肉 |
| Skeleton | 地面行走，更快，会远程骨弹 | 60 | 10 | 骨头 |
| Slime | 地面弹跳，弹跳越玩家 | 15 | 6 | 凝胶 |
| Spider | 贴墙/天花板移动 | 35 | 12 | 蛛丝 |

- 生成：玩家周围 Chebyshev 128 格内、光照 < 100、脚下有实心块、头顶 2 格空气、不在液体中、当前数量 < 20。
- 离开模拟范围（Chebyshev > 192 格）即销毁，回来重新生成。
- 弹幕上限 100。掉落物 5 分钟消失，且离开模拟范围即消失。

### 被动生物

- 兔子（受击逃跑，掉落生肉）、鸟（受击飞走，不掉落）、鱼（水中，不掉落）。
- 不攻击玩家，不阻挡玩家。

## 10. 物品与合成

### 投放分阶段（详见第 25 节）

- **方块（M3 首批 8 个）**：泥土、草、石头、木头、树叶、沙、火把、门。
- **方块（后续）**：雪、冰、工作台、熔炉、铁砧、箱子、床、黑曜石。
- **矿石（3 种）**：铁矿、金矿、煤矿（勘误 #7：熔炉需要燃料，初版漏了）。
- **工具（4）**：镐（矿/石）、斧（木）、锤（基岩类/装饰块）、铲（土/沙/雪）。
- **武器（4）**：木剑、石剑、铁剑、弓。
- **弹药**：箭。
- **护甲（3 套 × 3 件）**：木 / 铁 / 金。
- **材料（10）**：木材、石头、铁锭、金锭、煤、绳子、凝胶、骨头、蛛丝、皮革。
- **工作站（3）**：工作台、熔炉、铁砧。
- **功能方块**：门、箱子、床、火把、工作台、熔炉、铁砧。无家具。
- **食物**：生肉、熟肉。
- **液体桶**：水桶、岩浆桶。

### 合成与冶炼

- 工作台：基础合成（2×2 → 3×3 通用配方表，按工作站筛选）。
- 熔炉：冶炼矿石、烧煤当燃料、烹饪生肉 → 熟肉。
- 铁砧：装备合成（工作台不能做的）。
- 无药水、无酿造。
- 配方表是纯数据（`src/data/recipes.ts`），可被测试遍历校验可达性。

### 挖掘与放置

- 挖掘范围 / 放置范围 = 玩家碰撞盒外接矩形向外扩 5 格（矩形选取，非圆形）。
- 挖掘时间 = `baseTime(tile) × toolMultiplier × (wrongTool ? 4 : 1)`；`baseTime ∝ tile.hardness`。
- 无工具不能挖石/矿/冰/基岩类；用错工具不掉落。
- 放置不需支撑，可以悬空（沙/雪除外，它们是 CA 不是可放置物）。
- 门需要 2 格高，放置后默认打开。
- 火把需要相邻 4 格任一为实心块或有背景墙，否则不能放。
- 箱子/床/工作台/熔炉/铁砧需要 2 格宽，放置时水平 2 格都要空。
- 液体格可以放置方块（液体被挤走）。
- 挖掘/放置破坏背景墙？不破坏，背景墙与前景独立（勘误 #8：初版说「不影响挖掘」但没说清背景墙是否跟随保留 —— 结论：挖掉前景方块后背景墙原地保留）。

## 11. 世界生成

### 群系（4 个，横向条带 + 过渡带）

- 森林：草、泥土、树、矮草、史莱姆、僵尸。
- 沙漠：沙、仙人掌、地下沙岩。
- 雪地：雪、冰、松树。
- 丛林：丛林草、泥、藤蔓。

### 生成内容

- 地表高度场、洞穴、矿脉、树、植被、地下水/岩浆池、洞穴背景墙。
- 无结构、无地牢、无浮岛、无遗迹、无天体/事件。

### 噪声

- 自实现：整数哈希 + 值噪声 + Perlin，`fBm` 与 `ridged` 两种组合器。
- 全部噪声必须是**全局连续**的（用世界坐标做输入，不是块局部坐标），保证 chunk 边界无断层。
- **洞穴不用 3D 体噪声**（17M 格 × 3 octave 在 JS 里太慢）。方案：
  - 主通道：`ridged2D(x*0.006, seed)` 与深度斜坡相乘 → 蜿蜒隧道。
  - 大厅：低频 `2D blob` 噪声 × 深度窗口。
  - 竖井：沿列的 1D 随机游走（种子驱动）。
- 矿脉：`blobNoise3D(seed, oreId)`，仅在矿脉深度带内求值（成本可控）。
- 种子决定一切；`genVersion` 参与 hash，改生成算法必须 `genVersion++`（否则旧存档背景墙错位）。

### 生成执行

- **增量生成 + 进度条**：列式阶段分批，每帧预算 8 ms，超时让出主线程并刷新进度 UI。
- Large 目标：< 20 s；Medium 目标：< 6 s。
- 玩家可以在生成中取消（回到菜单）。

### 世界大小

- 创建时选择，创建后不可改。

## 12. 渲染

### 相机

- 跟随玩家，带死区（8×8 px）和前瞻（按移动方向偏移 24 px），钳制在世界内。
- 缩放为整数 1–6，键盘/滚轮切换，禁止小数缩放。

### 图层顺序

背景墙 → 液体 → 前景瓦片 → 掉落物 → 实体 → 弹幕 → 粒子 → 光照叠加 → 伤害数字 → UI(DOM)。

### 渲染实现

- **chunk 离屏缓存**：32×32 格 = 512×512 px 离屏 canvas，只含背景墙 + 前景瓦片。视口内 chunk 按需重建，重建有每帧预算（`M1` 简单版 `M10` 完善版）。
- 液体单独一层，逐格画，按液面高度画高度 + 表面正弦波动（仅表层格）。
- 天空色随昼夜插值，画在 chunk 层之下。
- 光照叠加：把 `sky`/`block` 合成到一张低分辨率（每格 1 px）`ImageData`，再用 `drawImage` 放大 + `multiply` 合成 —— 这样即使是硬边光照也只需 1 次全屏 drawImage。
- 粒子：挖掘碎块、受伤、液体飞溅、死亡。对象池。
- 伤害数字：对象池 + 上浮淡出。

### 性能

- 渲染每帧预算 8 ms。
- 对象池：粒子、伤害数字、弹幕、掉落物。
- 视口裁剪 + chunk 缓存。
- 不做平滑光照、不做可见性遮挡。

## 13. UI

### 界面清单（全英文）

- 主菜单：New World / Continue / Settings / Credits。
- 创建世界：World Name、Size（Small/Medium/Large/Custom + 数值）、Seed（留空=随机，显示实际种子）、Game Mode（Survival/Creative）、生成进度。
- 游戏内 HUD：Health / Hunger / Breath 三条 + Hotbar + 当前手持物名淡出。
- 背包（Tab）：40 格 + 5 个装备槽 + 拖拽/Shift 快速移动/右键拆分。
- 合成（E）：工作站 2×2 或 3×3 + 结果格 + 配方列表 + 搜索。
- 熔炉界面：输入/输出/燃料槽 + 进度条。
- 箱子：20 格，跨世界持久。
- 创造物品面板：分组列表 + 搜索，一键给满堆叠。
- 设置：Render Distance、Simulation Distance、Liquid Updates/Frame、Sand Updates/Frame、Light Nodes/Frame、Resolution Scale、UI Scale、按键重映射表、Show FPS/Overlay。
- 暂停菜单：Resume / Settings / Save & Exit。
- 死亡界面：Respawn / Exit to Menu。
- 设置界面：`lives`、`hunger`、`breath` 不在设置里，但有 Dev 调试项（debug 面板）。

### 行为

- 打开背包/合成时不暂停游戏（创造面板和设置例外：创造面板暂停，设置不暂停但可鼠标操作）。
- 物品栏打开时世界继续跑，方便边挖边合成。
- F3 开发者叠层：FPS、各系统 ms、实体数、活跃液体格、光照节点、内存估算。

## 14. 模式与能力标志

- **能力标志**（`AbilityFlags` bitfield）：`canFly`、`invulnerable`、`instantMine`、`infinitePlace`、`skipCrafting`、`enemiesHostile`、`infiniteItems`、`hasHunger`、`hasBreath`、`takeDamage`。
- 模式只是预设：`SURVIVAL = {canFly:false, invulnerable:false, instantMine:false, infinitePlace:false, skipCrafting:false, enemiesHostile:true, infiniteItems:false, hasHunger:true, hasBreath:true, takeDamage:true}`，`CREATIVE = {...}`。
- 切换模式 = 替换标志集，不重建世界、不改存档格式、不重生成地形/光照/液体。
- 各系统开头取一次 `const ab = mode.flags`，然后用 `ab.xxx` 判断；**不在深层循环里反复读 mode**。
- 创造模式世界仍在跑（液体、沙、敌人、掉落物都照跑），只是玩家无敌且敌人不主动攻击。

## 15. 存档

### 存储

- IndexedDB，库名 `myterra`，两个 object store：
  - `worlds`：按世界 id 存存档 Blob（**双槽轮换**：`(worldId, slot=A|B)`，保存时写到非当前槽，读取时取能通过校验且 `savedAt` 新的那一份）。
  - `meta`：世界列表索引（id、name、size、seed、mode、createdAt、lastPlayed、lastSlot）、设置。

### 二进制格式（小端）

```
Header:
  magic       u32   'MYTR' = 0x5254594D
  version     u16   存档格式版本
  genVersion  u16   世界生成器版本
  seed        u32
  width       u32   总列数（含缓冲）
  yMin        i32
  yMax        i32
  mode        u8
  timeOfDay   f32
  dayCount    u32
  spawnX      i32
  spawnY      i32
  createdAt   f64
  playedMs    f64

Sections: 每段 = u8 tag + u32 byteLength + payload
  0x01 TileDiff      前景瓦片差异（含门状态，因为门就是瓦片）
  0x02 LiquidDiff    液体类型 + 液量差异
  0x10 Player        JSON(短)：位置、速度、三个状态、种子朝向
  0x11 Inventory     JSON：40 格 + 5 装备槽
  0x12 Chests        JSON：箱子内容
  0x13 Stats         JSON：游戏时长、死亡数、挖掘数等
```

**TileDiff 编码**（关键，避免逐格 JSON 爆炸）：
- 按线性索引 `i = (y - yMin) * width + x` 升序。
- `u32 firstIndex`，然后 `u32 runCount`，每 run = `varint gap(≥1) + u8 len(1..255) + len×u8 tileId`。
- 相邻连续变化自然合并成长 run。
- LiquidDiff 同结构，payload 用 `2 bytes/格`（type, amount）。
- 差异由一个**脏格位图**维护：任何 `setTile` / `setLiquid` 打脏，保存时按扫描顺序产出 runs（扫描本身要分帧，带进度条）。
- 目标：重度游玩的 8192 宽世界存档 **< 5 MB**。

### 不存

- 光照、活跃队列、沙下落状态、敌人、被动生物、弹幕、掉落物、粒子、背景墙。
- 这些全部在加载时重建/重算。

### 加载流程

1. 读 Blob → 校验 magic + version + CRC/长度。
2. `genVersion` 与当前不符 → 明确报错，不尝试加载（不做迁移，勘误 #9）。
3. 用 `seed + width` 跑世界生成（含背景墙）。
4. 应用 TileDiff / LiquidDiff。
5. 全量重算光照 → 重建液体活跃队列 → 放置玩家 → 扫出生点安全位。
6. 重建所有活跃方块（门、工作台、熔炉、铁砧、箱子、床、掉落物本身）。

### 保存时机

- 自动保存每 60 s。
- 退出到菜单时保存一次。
- `beforeunload` / `visibilitychange → hidden` 保存一次（异步、不阻塞）。
- 存档失败不能崩游戏，弹 toast 说明。

### 明确不做

- 无云同步、无导入导出、无压缩归档（v1）、无存档迁移代码（但**必须有 version 字段和不匹配时的清晰报错**）。

## 16. 架构与模块边界

- 网格层：瓦片、背景墙、液体、光照 → `TypedArray`，放 `src/world/`。
- 实体层：玩家、敌人、被动生物、掉落物、弹幕、粒子 → 普通对象 + 对象池，放 `src/entity/`。
- 系统层：物理、碰撞、战斗、生成、库存、合成 → 纯函数为主，放 `src/systems/`。
- 数据层：所有数值与内容表 → `src/data/`（**唯一可硬编码的地方**）。
- 无区块管理（世界全内存）。
- 无完整 ECS（瓦片不是实体；液体/沙是元胞自动机；光是 BFS+列扫描；实体数少，对象池够用）。
- 依赖方向单向：`main → game → {systems, entity, world, data}`；`world/*` 不 import `entity/*`；`data/*` 不 import 任何游戏代码。

## 17. 性能预算与可观测性

固定 60 Hz，每帧预算（单位 ms，超出即分帧，不许累积成卡顿）：

| 系统 | 预算 |
|---|---|
| 实体（物理 + AI + 战斗） | 2.0 |
| 液体 | 2.0 |
| 沙 | 1.0 |
| 光照 | 1.0 |
| 渲染 | 8.0 |
| 游戏逻辑其余 | 2.0 |
| **合计** | **16.0**（余量留给 GC 与浏览器） |

- 所有预算用 `perf.now()` 分段计时，写进 F3 叠层。
- 连续 60 帧超预算 → 叠层变黄；连续 300 帧超预算 → 变红并提示降设置。
- 对象池：粒子、伤害数字、弹幕、掉落物、临时向量。
- 视口裁剪；chunk 缓存。
- 累加器上限 0.25 s、最多补 5 步，防止螺旋死亡。

## 18. 默认数值汇总

| 项目 | 数值 |
|---|---|
| 帧率 / 时间步 | 60 FPS / 60 Hz |
| 1 格 | 16 px |
| CHUNK | 32 格 |
| 垂直范围 | -512 ～ +511 |
| 缓冲 | 4 chunk = 128 格 |
| 默认世界宽度 | 8192（Medium） |
| 昼夜周期 | 1200 s（20 分钟） |
| 天空光因子（白天/夜晚） | 255 / 40 |
| 火把光 / 岩浆光 | 200 / 180 |
| 光照衰减（空气 / 液体） | 1 / 3 |
| 液量范围 | 0 – 100 |
| 液体单次最大转移 | 25 |
| 液体休眠阈值 | 2 |
| 沙每 tick 最大位移 | 1 |
| 玩家碰撞盒 | 0.8 × 1.8 格 |
| 移动速度 | 15 格/s |
| 跳跃高度 | 6 格 |
| 重力 / 最大下落 | 30 格/s² / 30 格/s |
| 水中重力 / 上浮速度 | 15 格/s² / 12 格/s |
| 创造飞行水平 / 垂直 | 20 / 15 格/s |
| 挖掘范围 / 放置范围 | 5 格（矩形外扩） |
| 最大堆叠 | 999（箭 200） |
| 背包 / 快捷栏 / 箱子 | 40 / 10 / 20 |
| 生命 / 饥饿 / 呼吸 上限 | 100 / 100 / 100 |
| 溺水伤害 | 5 HP/s |
| 极饿伤害 | 2 HP/s |
| 饱食回血（>80 时） | 1 HP/s |
| 饥饿消耗 | 0.07/s |
| 呼吸消耗 / 恢复 | 6.7/s / 40/s |
| 溺水到空 | 15 s |
| 生肉 / 熟肉恢复 | 20 / 40 |
| 敌人模拟范围 / 上限 | Chebyshev 128 格 / 20 |
| 实体销毁范围 | Chebyshev 192 格 |
| 掉落物存活 | 300 s |
| 弹幕上限 | 100 |
| 自动保存间隔 | 60 s |
| 近战冷却 / 命中无敌帧 | 0.4 s / 0.5 s |
| 弓蓄力 / 箭初速 / 箭重力 | 0.6 s / 22 格/s / 6 格/s² |
| 砍击持续 / 弧宽 | 0.15 s / 90° |
| 岩浆每秒伤害 | 30 |

## 19. 规格勘误与补充（相对初版设计稿）

初版设计稿有 9 处冲突/缺口，此处定稿，**按本节执行，不再讨论**：

1. **门状态**：并入前景瓦片 ID（4 个），取消「单独差异列表」。理由：少一套状态同步逻辑，存档自动覆盖。
2. **天空光**：存「衰减深度」而非最终亮度，昼夜因子渲染时应用。理由：昼夜循环不触发全局光照重算（否则每帧或每秒都是百万格级重算）。
3. **液体防爆阀**：每帧单格只处理一次 + 全局 20000 格/tick 上限 + 队列环形化。理由：CA 最容易出现的 bug 是局部震荡导致的 CPU 尖峰。
4. **生成器版本号** `genVersion` 写入存档头。理由：背景墙不入存档，靠种子重生成；生成算法改动会让旧存档的背景墙错位，必须能识别。
5. **死亡掉落**：保留背包，不掉落（初版「待定」，定稿保留）。
6. **坠落伤害**：不做（初版完全没提，明确排除，避免半成品）。
7. **燃料**：补煤矿（初版只有铁/金/银，没有燃料但有熔炉 —— 逻辑不闭合）。
8. **挖掉前景方块后背景墙原地保留**（初版只说「背景墙不影响挖掘」，没说清结果）。
9. **存档版本字段**：初版说「无版本迁移」，但完全没有版本字段等于无法安全演进。定稿：**有 `version` 字段、v1 无迁移代码、版本不匹配就明确报错**。不做迁移 ≠ 不做版本号。
10. **矿脉与洞穴噪声**：3D 体噪声在 17M 格规模下不可接受，定稿改为「2D ridged + 深度斜坡 + 1D 竖井」，3D blob 仅用于矿脉且限制在深度带内。

## 20. 明确排除（v1 不做）

任务系统 / 固定事件 / 魔法 / NPC 城镇 / Boss / 电路 / 药水 / 家具 / 结构 / 平台 / 半砖 / 楼梯 / 音频 / 外部资源文件 / CDN / 网络 API / 多人 / 完整 ECS / 区块加载卸载 / 内外存交换 / 加速模拟 / 懒更新 / 可见性遮挡 / 平滑光照 / 天然液源 / 液体与方块共存 / 云存档 / 导入导出 / 手柄支持 / 移动端触屏 / 坠落伤害 / 钩爪 / 二段跳 / 冲刺 / 饰品槽。

---

# 第二部分 · 开发计划

## 21. 工具链与脚本

```
dev         vite                 开发服务器（热更新）
build       tsc -b && vite build  类型检查 + 产物
preview     vite preview          本地验产物
typecheck   tsc --noEmit          纯类型检查
lint        eslint src tests tools
test        vitest run            单测
test:w      vitest                监听
bench       vite-node tools/bench.ts   无头模拟基准
```

- ESLint：推荐配置 + `@typescript-eslint/strict-type-checked` + `noUncheckedIndexedAccess` 相关规则。
- Prettier：2 空格、`printWidth 100`、`singleQuote`、无分号（与现有风格一致则沿用，无则定此为准）。
- `tsconfig`：`strict`、`noUncheckedIndexedAccess`、`noImplicitOverride`、`noFallthroughCasesInSwitch`、`exactOptionalPropertyTypes` 打开（最后一项如果导致第三方类型冲突可关，但自己的代码要适应）。
- 不配 CI（单人项目），但每个里程碑结束必须本地跑通 `typecheck + lint + test + bench`。

## 22. 目录结构

```
myterra/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ eslint.config.js
├─ README.md                     # 启动方式、快捷键、玩法说明（最终交付物）
├─ public/                       # 空，不放任何资源
├─ src/
│  ├─ main.ts                    # 唯一入口：装配 Game 并启动
│  ├─ core/
│  │  ├─ loop.ts                 # 固定步长循环 + 累加器 + clamp
│  │  ├─ rng.ts                  # mulberry32 / hash2 / hash3 / seedFromString
│  │  ├─ math.ts                 # clamp/lerp/sign/矩形相交
│  │  ├─ emitter.ts              # 极小事件总线
│  │  └─ perf.ts                 # 分段计时 + 预算断言 + F3 数据源
│  ├─ data/                      # 唯一允许硬编码数值的地方
│  │  ├─ tuning.ts               # 第 18 节全部数值
│  │  ├─ tiles.ts                # TileId + 物理属性表（solid/passable/hardness/drop）
│  │  ├─ items.ts                # ItemId + 堆叠/工具等级/伤害/掉落
│  │  ├─ recipes.ts              # 合成表（工作台/熔炉/铁砧分标签）
│  │  ├─ enemies.ts              # 敌人数值表
│  │  └─ biomes.ts               # 群系分布与表层方块表
│  ├─ world/
│  │  ├─ constants.ts            # TILE_PX/CHUNK/世界尺寸/内存估算
│  │  ├─ world.ts                # 6 个 TypedArray + get/set + 边界 + 脏位图
│  │  ├─ light.ts                # 列扫描 + 加/删 BFS + 脏区预算
│  │  ├─ liquid.ts               # 元胞自动机 + 活跃队列 + 休眠
│  │  ├─ sand.ts                 # 沙 CA
│  │  ├─ door.ts                 # 门开合（双格联动）
│  │  └─ gen/
│  │     ├─ noise.ts             # value/perlin/fbm/ridged/blob
│  │     ├─ generator.ts         # 增量生成编排 + 进度 + 取消
│  │     ├─ terrain.ts           # 高度场 + 表层 + 背景墙
│  │     ├─ caves.ts             # 隧道 + 大厅 + 竖井
│  │     ├─ ores.ts              # 矿脉
│  │     ├─ flora.ts             # 树/草/仙人掌/松树
│  │     └─ pools.ts             # 水池/岩浆池
│  ├─ entity/
│  │  ├─ entity.ts               # 基类 + 空间哈希
│  │  ├─ pool.ts                 # 对象池
│  │  ├─ player.ts
│  │  ├─ enemy.ts                # 4 种共用 + 行为表
│  │  ├─ passive.ts              # 兔/鸟/鱼
│  │  ├─ projectile.ts
│  │  ├─ pickup.ts               # 掉落物
│  │  └─ particle.ts
│  ├─ systems/
│  │  ├─ physics.ts              # AABB vs 网格（分轴扫掠）
│  │  ├─ collision.ts
│  │  ├─ combat.ts
│  │  ├─ spawn.ts                # 敌人生成/清理
│  │  ├─ inventory.ts
│  │  ├─ crafting.ts
│  │  ├─ furnace.ts
│  │  └─ interaction.ts          # 挖掘/放置/门/箱子/床/工作站
│  ├─ game/
│  │  ├─ game.ts                 # 编排所有系统的 update/draw
│  │  ├─ mode.ts                 # AbilityFlags + 预设
│  │  └─ worldSession.ts         # 载入/新建/保存/卸载一个世界
│  ├─ render/
│  │  ├─ camera.ts
│  │  ├─ atlas.ts                # 程序化贴图（boot 时生成离屏 canvas）
│  │  ├─ chunks.ts               # chunk 离屏缓存
│  │  ├─ terrain.ts              # 背景墙 + 前景瓦片绘制
│  │  ├─ liquid.ts               # 液面 + 波动
│  │  ├─ lightOverlay.ts         # 低分辨率光照叠加
│  │  ├─ entityLayer.ts
│  │  ├─ particles.ts
│  │  └─ debug.ts                # F3 叠层
│  ├─ ui/                        # DOM overlay
│  │  ├─ shell.ts                # 菜单/HUD 的挂载与路由
│  │  ├─ mainMenu.ts
│  │  ├─ createWorld.ts
│  │  ├─ hud.ts
│  │  ├─ inventory.ts
│  │  ├─ crafting.ts
│  │  ├─ furnace.ts
│  │  ├─ chest.ts
│  │  ├─ creativePanel.ts
│  │  ├─ settings.ts
│  │  ├─ death.ts
│  │  └─ styles.css
│  └─ save/
│     ├─ format.ts               # header/section 定义 + varint/RLE
│     ├─ diff.ts                 # 脏位图 → runs → Blob
│     ├─ apply.ts                # Blob → 世界
│     └─ persist.ts              # IndexedDB + 双槽 + 设置
├─ tests/
│  ├─ rng.test.ts
│  ├─ noise.test.ts
│  ├─ physics.test.ts
│  ├─ liquid.test.ts
│  ├─ sand.test.ts
│  ├─ light.test.ts
│  ├─ save.test.ts
│  ├─ inventory.test.ts
│  ├─ crafting.test.ts
│  └─ worldgen.test.ts
└─ tools/bench.ts
```

模块边界规则（lint 层面不强制，但 review 必查）：
- `data/*` 不 import `game|entity|world|render|ui|save`。
- `world/*` 不 import `entity/*`、`game/*`、`ui/*`。
- `save/*` 只依赖 `data/*` + 标准库 + 自己（序列化世界快照用显式参数传入，不直接拿 World 单例）。
- `render/*` 只读世界与实体，绝不修改。

## 23. 关键类型与接口草案

```ts
// src/world/constants.ts
export const TILE_PX = 16;
export const CHUNK = 32;
export const BUFFER_CHUNKS = 4;
export const BUFFER_TILES = BUFFER_CHUNKS * CHUNK;   // 128
export const Y_MIN = -512;
export const Y_MAX = 511;
export const Y_REACH_MIN = Y_MIN + 1;                 // -511
export const Y_REACH_MAX = Y_MAX - 1;                 // 510

// src/world/world.ts
export interface WorldSize { reachWidth: number; }

export class World {
  readonly width: number;            // 含缓冲的总列数
  readonly fg: Uint8Array;           // TileId
  readonly wall: Uint8Array;         // WallId
  readonly skyDepth: Uint8Array;     // 0..255
  readonly blockLight: Uint8Array;   // 0..255
  readonly liquidType: Uint8Array;
  readonly liquidAmount: Uint8Array;

  idx(x: number, y: number): number;
  inReach(x: number, y: number): boolean;   // 不含缓冲
  getTile(x: number, y: number): TileId;
  setTile(x: number, y: number, t: TileId): void;  // 内部: 挤液体 + 标脏光照/沙/存档
  isSolid(x: number, y: number): boolean;
  isPassable(x: number, y: number): boolean;
  liquidAt(x: number, y: number): { type: LiquidType; amount: number };
  setLiquid(x: number, y: number, type: LiquidType, amount: number): void;
  markDirty(x: number, y: number): void;   // 同时标 存档位图 + 光照脏区
}

// src/world/light.ts
export interface LightSystem {
  queueFullRelight(): void;
  onTileChanged(x: number, y: number, prev: TileId, next: TileId): void;
  onLightSourceChanged(x: number, y: number): void;
  update(budgetMs: number): void;     // 处理脏区 + BFS 队列，超预算留到下帧
  dayFactor: number;                  // 0..1，由昼夜曲线驱动
}

// src/world/liquid.ts
export interface LiquidSystem {
  wake(x: number, y: number): void;
  set(x: number, y: number, type: LiquidType, amount: number): void;
  update(budgetMs: number): void;
  activeCells(): number;              // 给 F3
}

// src/systems/physics.ts
export interface Body { x: number; y: number; vx: number; vy: number; w: number; h: number; onGround: boolean; }

// src/game/mode.ts
export interface AbilityFlags {
  canFly: boolean; invulnerable: boolean; instantMine: boolean;
  infinitePlace: boolean; skipCrafting: boolean; enemiesHostile: boolean;
  infiniteItems: boolean; hasHunger: boolean; hasBreath: boolean; takeDamage: boolean;
}
export const MODE: Record<'survival' | 'creative', AbilityFlags> = { ... };

// src/save/format.ts
export const SAVE_MAGIC = 0x5254594d; // 'MYTR' little-endian
export const SAVE_VERSION = 1;
```

**约定**：
- 网格坐标一律整数，像素坐标一律浮点（px 为单位）。
- 所有 `World` 索引方法内部做边界钳制，调用方不必每次判界（但循环里要先用 `inReach`/视口范围裁剪）。
- 任何修改世界的方法**必须**通过 `World.setTile` / `setLiquid`，不能直接写数组元素（否则漏掉脏标记）——这是硬规则，review 必查。

## 24. 里程碑

每个里程碑的固定结构：**目标 / 任务 / 验收 / 本阶段不做**。
「验收」全部通过 + 第 30 节 DoD 全绿，才算完成。里程碑之间可以在同一分支连续做，但不允许两个里程碑半成品混在一个可玩构建里。

---

### M0 · 工程骨架

**目标**：一个能编译、能测、能跑空场景、能出基准表的仓库。

**任务**
1. 初始化 Vite + TS strict + Vitest + ESLint + Prettier，配置脚本（第 21 节）。
2. `index.html`（canvas + DOM overlay 根节点）+ `src/main.ts`。
3. `core/loop.ts`：固定步长 60 Hz、累加器、上限 0.25 s、最多补 5 步、`visibilitychange` 自动暂停。
4. `core/rng.ts`：`mulberry32`、`hash2/hash3`、字符串种子 → uint32。确定性要求：同种子同序列。
5. `core/math.ts`、`core/emitter.ts`、`core/perf.ts`（分段计时 + 预算超限标记）。
6. `tools/bench.ts`：无 DOM 环境跑 6000 tick 空循环，输出 tick/帧耗时表。
7. 10 个基础单测（rng 确定性、math 边界、loop 步数计算）。
8. `data/tuning.ts`：把第 18 节全部数值落成常量。

**验收**
- `npm run build` 出静态产物，浏览器打开显示空画布，F3 叠层显示 60 FPS 与各段耗时。
- `npm test` 全绿；`npm run typecheck` / `npm run lint` 0 错。
- `npm run bench` 输出稳定数值。

**本阶段不做**：瓦片、玩家、UI。

**M0 基准记录（2026-10-07，Node v24.19.0）**：6000 tick；`loop harness overhead` 总耗时 5.5 ms，`empty scene` 总耗时 5.9 ms，均约 0.0–0.1 ms / 模拟秒。

---

### M1 · 网格、相机、渲染

**目标**：能在内存里造一片平地，站在上面走动画面稳定 60 FPS。

**任务**
1. `world/constants.ts` + `world/world.ts`：6 个 `TypedArray` 分配、索引、边界钳制、`inReach`。
2. `data/tiles.ts`：首批 `TileId`（Air/Dirt/Stone/Grass/Wood/Leaf/Sand/Torch/Door*）与属性表（solid/passable/hardness/drop/liquidHostile）。
3. 程序化贴图 `render/atlas.ts`：用代码把每个 `TileId` 画成 16×16 像素图（确定性、颜色/噪点由 hash 决定），生成到离屏 canvas。禁止外部图片。
4. `render/camera.ts`：跟随 + 死区 + 前瞻 + 世界钳制 + 整数缩放 1–6。
5. `render/chunks.ts`：32×32 chunk 离屏缓存（先只画前景，简单版），视口内按需重建，重建有预算。
6. `render/terrain.ts`：背景墙层 + 前景层 + 天空底色。
7. 临时测试世界生成器（程序内建，不是 `gen/`）：2048×64 平地 + 一堵石墙 + 底部基岩。
8. `render/debug.ts`：F3 叠层（FPS、各段 ms、绘制 tile 数、视口矩形）。
9. 缩放切换（`-`/`+`）、F3 开关、F11 全屏、Tab 预留。

**验收**
- 视口裁剪生效：F3 里「绘制 tile 数 / 视口总格数」比值符合视口大小（不含 chunk 预渲染）。
- 整数缩放 1–6 下画面无半像素抖动、无接缝（手工检查 3 个缩放级别）。
- 世界任意位置（x=0、x=W-1、y=-511、y=510）镜头不越界。
- Large 世界（16384）下帧时间与 Small 无显著差异（差 < 1 ms，证明没有全图扫描）。
- `worldgen.test.ts` 不存在（还没生成器），但 `world.test.ts` 覆盖索引/边界钳制。

**本阶段不做**：玩家、挖掘、UI 菜单、世界生成器。

**M1 基准记录（2026-10-07，Node v24.19.0）**：6000 tick；Small 可见窗口总耗时 55.2 ms（0.6 ms / 模拟秒），Large 可见窗口总耗时 61.7 ms（0.6 ms / 模拟秒），两者平均每 tick 均约 0.01 ms，未随世界宽度扫描全图。

---

### M2 · 玩家、物理、状态

**目标**：一个受重力、有碰撞、有生命/饥饿/呼吸数据、HUD 可见的玩家。

**任务**
1. `systems/physics.ts`：AABB vs 网格，分轴扫掠，逐格解算；`onGround` 检测；水体阻力/浮力；基岩与边界钳制。
2. `entity/player.ts`：移动（加速/摩擦/空中控制）、跳跃（初速 `√(2gh)`）、游泳、创造飞行预留（能力标志位先留）。
3. 输入系统：键位映射表 + 重映射存 `localStorage`；鼠标（移动/左键挖/右键放/中键选方块预览）。
4. `ui/hud.ts`：Health/Hunger/Breath 三条 + Hotbar 占位 10 格 + 手持物名淡出。DOM 实现。
5. 生存状态 tick：饥饿消耗、饱食回血、呼吸消耗/恢复、溺水与极饿扣血、死亡标记。
6. 相机跟随 + 前瞻实测调参（把 15 格/s、跳跃 6 格调到手感合适，值回写 `tuning.ts`）。
7. `physics.test.ts`：静止落地、跑墙、跳跃高度、天花板、窄缝（0.8 格宽通道）、水中下沉。

**验收**
- 玩家在任何地形下不穿墙、不卡进墙里；60 FPS。
- 跳跃高度实测 5.5–6.5 格（写测试断言）。
- 站水里 15 秒呼吸归零并开始掉血，出水 2.5 秒呼吸回满。
- 饥饿归零后掉血，吃东西（调试命令加）能回。
- 玩家碰撞盒在 F3 里可视化为矩形。

**本阶段不做**：挖掘、放置、背包逻辑、敌人。

---

### M3 · 挖掘、放置、物品栏 —— 第一个真实玩法闭环

**目标**：能挖方块、能放方块、能开关门，有背包。游戏第一次「好玩」。

**任务**
1. `data/items.ts` + `data/tiles.ts` 补全首批：`ItemId` ↔ `TileId` 映射、堆叠、工具类别（`pickaxe/axe/hammer/shovel/none`）。
2. `systems/inventory.ts`：40 格 + 快捷栏 10 格、最大堆叠、`addItem/removeItem/count/split/move`、选择与拖拽模型（先纯数据 + 事件，UI 下个里程碑）。
3. `systems/interaction.ts`：挖掘（矩形范围 5 格、逐格进度、工具倍率、错工具 4× 惩罚且不掉落、破坏粒子）、放置（同范围、悬空可放、火把需支撑、门 2 格高、2 格宽功能块）。
4. `entity/door.ts`：门开合（改 2 格、判是否被实体/箱子卡住）。
5. `systems/damage.ts` + 掉落物基础：破坏方块掉落物品实体（自动拾取，5 分钟消失，离开模拟范围消失）。
6. 物品栏逻辑与 UI 解耦：本里程碑只做纯数据 + 事件；`ui/inventory.ts` 面板（Tab/拖拽/Shift/右键拆分/装备槽显示）挪到 M11。
7. `systems/spatialHash.ts`：格点查询（掉落物拾取、放置检测复用）。
8. 测试：`inventory.test.ts`（堆叠/拆分/满格拒收）、`interaction` 的放置规则表驱动测试。

**验收**
- 挖掉任意首批方块 → 按表掉落对应物品；无工具挖石头失败、挖泥土成功；用斧挖石头不掉落。
- 门能开能关，关门挡人、开门过人；存档里门状态自动跟着瓦片走（此时存档未做，但单测要断言瓦片 ID 切换正确）。
- 悬空放置合法；箱子位置（未做）不冲突。**放置方块挤开液体由 M8 液体系统接管**（M3 无液体，故此处不做）。
- F3 显示掉落物数与物品栏内容。

**本阶段不做**：世界生成、合成、敌人、完整 UI 美术。

---

### M4 · 创造沙盒（前置开发工具）

**目标**：用能力标志把玩家切成创造态——能飞、能瞬挖瞬放、能用原始方块调色板搭场景，成为后续世界生成 / 光照 / 液体的手工验证工具。

**任务**
1. `game/mode.ts`：`AbilityFlags` 全字段 + `SURVIVAL`/`CREATIVE` 预设；各系统开头取一次 `const ab = mode.flags`，不在深层循环里反复读 `mode`。
2. 飞行（`canFly`）：无重力，`W/S` 上下 15 格/s、`A/D` 水平 20 格/s（数值进 `tuning`）。
3. `instantMine`：挖掘无进度、5 格矩形范围、无工具限制（工具无耐久系统）。
4. `infinitePlace`：放置不扣物品。
5. 原始 `TileId` 调色板（**不依赖 item 系统**）：数字键 / 滚轮选块，F3 显示当前选中块；左键瞬挖、右键放置。
6. 模式切换热键（定 `F6`）与 F3 显示当前模式；切换只替换标志集，不重建世界、不重算光照、不重载存档。
7. 调试命令：`F9` 倒液体（为 M8 之前手工测试预留），走能力标志之外的调试路径。
8. 测试：`mode.test.ts` —— 预设字段正确；切换后 `mode` 引用被替换；系统读取新值。

**验收**
- 创造态能飞、瞬挖、无限放；切换回生存立刻恢复重力、挖掘进度、放置扣物品。
- 能用调色板在任意地形搭测试场景（服务 M5/M7/M8 的手工验证）。
- 切换模式不重生成世界、不重算光照、不重载存档；F3 能读出当前模式与能力标志。

**本阶段不做**：完整创造物品面板、`infiniteItems` 满堆叠、`skipCrafting`、设置内切换、`enemiesHostile` 生效（全部并入 M11）。

---

### M5 · 世界生成 —— 第一个「有内容」的可玩世界

**目标**：种子驱动的完整森林世界 + 主菜单/创建世界流程。

**任务**
1. `world/gen/noise.ts`：value/perlin、`fbm`、`ridged2D`、`blob3D`；全部以世界坐标输入；单元测试：连续性、同种子一致、范围 [0,1]。
2. `data/biomes.ts`：4 个群系的横向分布（含过渡带宽度）、表层方块表、植被表。
3. `world/gen/terrain.ts`：高度场（`fbm` + 群系权重）、表层/次表层填充、背景墙（地表下=泥土背景墙，洞穴内=石背景墙，空气=无）、基岩层、最底部过渡。
4. `world/gen/caves.ts`：ridged 隧道 + 低频大厅 + 1D 竖井；**必须与群系无关且跨 chunk 无断层**。
5. `world/gen/ores.ts`：铁/金/煤三条深度带 blob 噪声；相邻不同矿替换规则（煤炭优先于铁？定死优先级表）。
6. `world/gen/flora.ts`：树（含树干/树冠确定性放置与间距）、矮草、仙人掌、松树、藤蔓（M10 才有藤蔓，先留表）。
7. `world/gen/pools.ts`：地下水（y > 地表+8）、洞穴底部岩浆池、沙漠地下水；灌满 `liquidAmount=100` 并 wake。
8. `world/gen/generator.ts`：**增量分帧生成 + 进度条 + 取消**，每帧预算 8 ms；产出 `genVersion`。
9. `ui/mainMenu.ts` + `ui/createWorld.ts`：世界名、Size（含内存提示）、Seed（可空，显示实际值）、Mode、生成进度与取消。
10. 出生点：地表第一个 3 格空且脚下实心的列。
11. 测试：`worldgen.test.ts` —— 同 `(genVersion, seed, width)` 两次生成逐格哈希相等；不同 seed 不同；chunk 边界两侧高度连续；无「悬空树叶」；出生点合法。

**验收**
- 创建 Small 世界 < 3 s、Medium < 6 s、Large < 20 s（bench 记录实测）。
- 同种子重开，进门那一刻地形/背景墙/矿石/树完全一致（哈希比对）。
- 走遍全宽无地形断层；玩家撞不到缓冲边界。
- 主菜单 → 创建世界 → 进入游戏 → 退出回菜单 全流程可用。
- 生成中取消能安全回菜单，不留半初始化世界。

**本阶段不做**：光照、液体模拟（池子是静态的）、存档、合成、敌人。

---

### M6 · 存档 —— 世界不再会丢

**目标**：保存/读取完整还原，换个浏览器标签页也能接着玩。

**任务**
1. `save/format.ts`：`SAVE_MAGIC/SAVE_VERSION`、header、section tag、`varint`、`u8 len` RLE 编解码；`endianness` 显式 little。
2. `world/world.ts` 增加脏位图（`tileDirty` / `liquidDirty`，各 1 bit/格，Large 时约 2 MB/图）。
3. `save/diff.ts`：脏位图 → runs（分帧扫描 + 进度）→ Blob；统计压缩率。
4. `save/apply.ts`：Blob → 解码 → 应用；版本/`genVersion` 不匹配 → 抛出可读错误（UI 显示，不崩）。
5. `save/persist.ts`：IndexedDB 包装、双槽轮换、`meta` 世界索引、设置存储、异步保存不阻塞。
6. 自动保存 60 s + 退出保存 + `visibilitychange` 保存；失败 toast。
7. 加载流水线：生成 → 应用差异 → 全量光照（此时光照还没做，先跳过并留 TODO 钩子）→ 重建液体队列 → 放玩家。
8. 测试：`save.test.ts` —— 空世界 round-trip；随机修改 10 万格 round-trip 后逐格相等；液体 round-trip；版本不匹配被拒；损坏 Blob 被拒。

**验收**
- Medium 世界重度游玩后存档 < 5 MB。
- 保存 → 关标签页 → 重开 → 位置、物品栏、时间、方块、液体完全一致。
- 两个存档槽交替使用都能读。
- 版本/种子不匹配时给明确英文错误提示，不白屏。

**本阶段不做**：光照还原（占位）、实体还原（敌人本来就不存）。

---

### M7 · 光照 —— 画面成型

**目标**：昼夜循环、洞穴黑暗、火把照明，挖墙后光正确流出。

**任务**
1. `world/light.ts`：列扫描（天空深度）+ 加光 BFS（桶队列）+ **删光 BFS**（两阶段）+ 脏区队列 + 每帧节点预算。
2. 水/岩浆衰减 3；实心块阻挡；背景墙/可通过块不阻挡。
3. 光源：火把 200、岩浆 180；放/拆光源走 `onLightSourceChanged`。
4. `render/lightOverlay.ts`：每格 1 px 的 `ImageData` → 放大绘制 + `multiply` 合成；`dayFactor` 由昼夜曲线给出。
5. 昼夜系统：1200 s 周期、`timeOfDay`、天空色插值（黎明/正午/黄昏/夜）、存档时间还原。
6. Debug：`F9 + R` 全量重算；F3 显示脏区数、光照节点数、上一帧光照 ms。
7. 测试：`light.test.ts` —— 封闭洞内为 0；挖开一格后光流出且亮度逐格衰减；**封回后无残留亮斑**（删光算法）；多光源取最大值不累加；水衰减比空气快。

**验收**
- 白天地面全亮、洞穴全黑；夜晚地面变暗但仍可见轮廓。
- 放火把 → 周围半径 200 亮起，挖掉火把 → 光正确消失（含远处无残留）。
- 光照更新稳定在 1 ms 预算内（F3 无红）。
- 挖一大片地形时无卡顿（分帧可见）。

**本阶段不做**：平滑光照、彩色光照。

---

### M8 · 液体与沙 —— 世界的物理感

**目标**：静止水池、倒水成河、沙柱下落、水岩浆反应。

**任务**
1. `world/liquid.ts`：元胞自动机全实现（下 → 斜下 → 水平）、活跃环形队列 + 去重位图、休眠阈值、每帧 20000 格上限、每帧 2 ms 预算、液体格密度统计。
2. `systems/interaction.ts` 扩展：水桶/岩浆桶（M10 才有桶，这里沿用 M4 的调试命令 `F9` 倒液体，桶在 M10）。
3. 液体 ↔ 方块：放置挤液、沙挤液、挖掉盛水方块水流出。
4. 液体反应：水+岩浆 → 黑曜石/石头（定死：靠近岩浆一侧得黑曜石），消耗液体，生成方块。
5. 玩家/敌人/被动生物/掉落物/弹幕在液体中的浮力、阻力、游泳、岩浆伤害。
6. `world/sand.ts`：单步下落 + 水平滑落 + 落定 + 挤液 + 光照标脏。
7. `render/liquid.ts`：液面高度 + 表层正弦波动 + 半透明 + 描边。
8. 存档：液体差异 round-trip、加载后重建活跃队列（不复活已静止的水）。
9. 测试：`liquid.test.ts`（倒入 100 格水最终分布稳定、休眠后 `activeCells` 归零、无震荡、总量不凭空增加）、`sand.test.ts`（沙柱落完成锥形、入水变静态、10 万格沙不爆帧）。

**验收**
- 静止水池在 30 s 后 CPU 占用归零（F3 活跃液体格 = 0）。
- 挖开水池壁 → 水流成河 → 最终平齐；倒 1 万格水全程无单帧超 8 ms。
- 沙柱无卡死、无残留在空中、无「一格沙穿过一格沙」。
- 水 + 岩浆产生黑曜石/石头，双方液体消失。
- 存档还原液体后流动状态从静止开始（符合规格）。

**本阶段不做**：液体桶 UI（M10）、黏液球/水层雾化。

---

### M9 · 生存循环 —— 游戏性闭环

**目标**：采集 → 合成 → 装备 → 战斗 → 死亡 → 重生，全部串起来。

**任务**
1. `data/recipes.ts` + `systems/crafting.ts`：工作台 2×2/3×3 通用匹配（形状无关，支持错位摆放），配方按工作站标签过滤。
2. `systems/furnace.ts`：冶炼（矿→锭）、烹饪（生肉→熟肉）、燃料（煤 1.5 根木头 / 煤 1 块）、进度条与燃料耗尽。
3. 工具生效差异化：镐挖矿石快、斧砍树快、锤砸装饰快、铲挖土沙快；每类工具 3 个等级（木/石/铁）不同速度。
4. `systems/combat.ts`：剑挥砍（扇形判定 + 冷却 + 击退 + 无敌帧 + 伤害数字）、受伤与击退、伤害数字对象池。
5. `entity/enemy.ts`：Zombie + Slime（AI：巡逻 → 感知 → 追击 → 跳跃过障碍）、受击反馈、死亡掉落。
6. `systems/spawn.ts`：模拟范围 Chebyshev 128、上限 20、生成条件（光照 < 100、脚下实心、头顶 2 格空气、不在液体、不在缓冲）、离开 192 格销毁。
7. 饥饿/呼吸/伤害结算与死亡流程：死亡界面 → Respawn → 传送出生点 → 背包保留。
8. `entity/passive.ts`：兔子（受击逃跑、掉落生肉）。
9. `ui/crafting.ts` + `ui/furnace.ts` + `ui/chest.ts`（箱子）+ 箱子容器存储进存档。
10. 掉落物拾取 + 5 分钟消失 + 离开模拟范围消失。
11. 测试：`crafting.test.ts`（每条配方可被配方本身的手法复现；不可合成断言；工作台筛选）、`furnace` 时间推进、`combat` 命中/无敌帧、`spawn` 上限与范围。

**验收**
- 空手 → 砍树 → 木头 → 工作台 → 木镐 → 挖石头 → 石镐 → 挖铁矿 → 熔炉 → 铁锭 → 铁剑/铁镐，全链路可走通（写成一段 `tools/bench` 里的模拟脚本或手工 checklist）。
- 僵尸能追到玩家、造成接触伤害、被剑打退、能被杀死并掉落。
- 玩家死亡 → 死亡界面 → Respawn → 在出生点满状态，背包保留，世界不变。
- 敌人生成数不超过 20，离开 192 格会消失。

**本阶段不做**：弓箭、护甲、床、骷髅/蜘蛛、鸟/鱼。

---

### M10 · 内容扩展与打磨

**目标**：把第 25 节投放表里剩下的全部内容补齐。

**任务**
1. 群系补齐：沙漠（沙岩、仙人掌）、雪地（雪、冰、松树、冻水）、丛林（泥、丛林草、藤蔓、硬木）。过渡带无断层（测试）。
2. 矿石与材料补齐：煤矿（燃料）、金矿、金锭、黑曜石、蛛丝、皮革（从兔/蜘蛛/史莱姆获得）、绳子（从草获得）。
3. 弓箭线：弓（弹药槽）、箭（实体 + 重力 + 命中）、骷髅 + 骨弹。
4. 护甲 3 套 × 3 件（木/铁/金），含减伤公式；护甲有耐久？**不做耐久**（定稿）。
5. 蜘蛛（贴墙 AI，最难的一个）+ 鸟（受击飞走）+ 鱼（水中游）。
6. 功能方块补齐：箱子（跨存档）、床（重生点）、铁砧（装备合成）、熔炉贴图与燃料 UI。
7. 液体桶：水桶 / 岩浆桶（从世界取液体，装桶 = 采集成物品）。
8. 藤蔓作为可通过方块（M10 首次用到「可通过块」类别，M1–M9 只有门和火把用它）。
9. 性能打磨：chunk 缓存增量重建、实体空间哈希调参、光照脏区半径收敛、粒子上限。
10. 数值平衡一轮：难度、掉落率、经济时间；`tuning.ts` 集中调。
11. `README.md`：启动、构建、快捷键、玩法、已知限制。

**验收**
- 第 25 节投放表中每一项都能在游戏里拿到/做到（写一个 `tools/verifyContent.ts`：遍历 recipes + item 表 + 检查可达性，输出缺失清单，必须为空）。
- 4 个群系都能走到，各自有明显不同的地表与敌人。
- Large 世界 60 FPS 游玩 10 分钟，F3 无红。

**本阶段不做**：任何第 20 节排除项。

---

### M11 · UI 完成度、设置与完整创造模式

**目标**：所有界面齐全、所有设置真的生效，并把 M4 留下的完整创造能力补齐。

**任务**
1. 补全 UI 框架：`ui/shell.ts` 路由、暂停菜单、设置面板、按键重映射 UI（点击输入 → 等待按键）。
2. 设置项全部实装并**真的改变行为**：Render Distance、Simulation Distance、Liquid Updates/Frame、Sand Updates/Frame、Light Nodes/Frame、Resolution Scale、UI Scale、Show Overlay。
   - 改设置必须立刻生效（F3 里能看到数值变化）。
   - Resolution Scale < 1 时启用内部降采样 + 最近邻放大（保持像素风）。
3. 背包/合成/熔炉 UI 完整交互（拖拽、右键拆分、Shift 批量、合成结果连续取用、光标跟随）。
4. `ui/creativePanel.ts`：分组（Blocks/Walls/Tools/Weapons/Liquids/Misc）+ 搜索，一键给满堆叠 999（`infiniteItems`）。
5. `skipCrafting`：合成界面显示但不可消耗（玩家已有物品全量可用）。
6. `enemiesHostile=false`：敌人不主动索敌、不造成接触伤害（仍然移动、仍然可被打死、不掉落）。
7. 运行中切换模式（设置里可切）不重生成世界、不重算光照、不重载存档。
8. F3 叠层完善 + 颜色阈值。
9. 文本全部英文硬编码在 UI 文件里，集中放 `ui/text.ts` 便于日后统一改。
10. 窗口 resize、Tab 切换、DPI 变化、像素完美对齐验证。
11. 测试：`mode` 引用替换、各系统读取新值；存档二进制两模式互读。

**验收**
- 每个设置项改动后行为可观察（逐条 checklist）。
- 所有界面在 1280×720 到 1920×1080 之间不错位；UI Scale 0.75–2.0 可用。
- 背包/合成打开时游戏继续跑（除创造面板与设置）。
- 没有任何中文/乱码文本泄漏到 UI。
- 创造面板能拿全部物品；切回生存立刻恢复饥饿/呼吸/受伤/敌意。
- 同一存档在两模式间反复切换保存/读取都正常。

**本阶段不做**：创造模式专属方块（如隐形墙）、成就。

---

### M12 · 发布准备

**任务**
1. `vite build` 产物检查：单文件自包含（除 JS/CSS）、无 sourcemap 或可选、无外部请求（用 DevTools Network 面板验证：只有文档 + 自己的 JS/CSS + favicon）。
2. 体积检查与 tree-shaking 检查；gzip 后体积记录。
3. README 完善 + 首次使用说明。
4. 已知限制列表写进 README。
5. 回归：跑一遍 M3/M5/M9/M10 的验收 checklist。

**验收**
- 断网状态下从静态服务器完整可玩（静态托管本身就是无依赖）。
- Network 面板无第三方请求。
- M0→M11 全部验收项复检通过。

---

## 25. 内容投放表

| 内容 | 里程碑 |
|---|---|
| 方块：泥土/草/石头/木头/树叶/沙/火把/门 | M1 数据，M3 可用 |
| 掉落物与拾取 | M3 |
| 水池/岩浆池（静态） | M5 |
| 液体模拟 | M8 |
| 煤矿（燃料） | M9（熔炉需要）→ 见下 |
| 工作台、合成 | M9 |
| 熔炉、冶炼、烹饪 | M9 |
| 僵尸、史莱姆 | M9 |
| 兔子 | M9 |
| 箱子 | M9 |
| 篝火 ❌ 不做 | — |
| 铁矿石 / 煤矿石 / 金矿石（世界生成） | M5 |
| 铁锭、铁镐/铁剑、煤矿燃料 | M9–M10 |
| 镐/斧/锤/铲（木/石/铁） | M3 单木镐，M9 三级 |
| 木剑、石剑 | M9 |
| 群系：森林 | M5 |
| 群系：沙漠/雪地/丛林 | M10 |
| 背景墙 | M5 |
| 昼夜循环 | M7 |
| 创造模式：能力标志/飞行/瞬挖瞬放/方块调色板 | M4 |
| 创造模式：物品面板/无限物品/跳过合成/模式切换 UI | M11 |
| 弓、箭、弹药槽 | M10 |
| 骷髅（骨弹） | M10 |
| 蜘蛛（蛛丝） | M10 |
| 鸟、鱼 | M10 |
| 金锭 | M10 |
| 护甲 3 套（无耐久） | M10 |
| 藤蔓、仙人掌、松树 | M10 |
| 铁砧 | M10 |
| 床（重生点） | M10 |
| 水桶、岩浆桶 | M10 |
| 皮革、骨头、凝胶、绳子 | M10 |
| 熔炉燃料 UI、箱子 20 格 UI | M9 逻辑，M11 UI |
| 性能打磨、发布 | M10–M12 |

## 26. 测试策略

**原则**：只测纯逻辑，不测 canvas，不测 DOM。渲染靠手工验收 + 性能基准。

| ID | 目标 | 关键断言 |
|---|---|---|
| T-RNG-1 | 随机数确定性 | 同种子序列相等；不同种子不等；`hash2/3` 无明显相关性 |
| T-MATH-1 | 数学边界 | clamp/lerp/sign 在边界值 |
| T-LOOP-1 | 固定步长 | 补帧数计算正确；长帧后累加器被 clamp |
| T-WORLD-1 | 网格索引 | `idx` 与边界钳制；`inReach` 排除缓冲 |
| T-PHY-1 | 碰撞 | 落地不穿透；跑墙停住；跳跃高度 5.5–6.5 格；窄缝可过；水中下沉 |
| T-INV-1 | 背包 | 堆叠合并；最大堆叠；满格拒收；拆分；Shift 移动 |
| T-MINE-1 | 挖掘规则 | 工具类别对应；错工具 4× 惩罚且不掉落；无工具挖石头失败 |
| T-PLACE-1 | 放置规则 | 悬空可放；火把需支撑；门 2 格高；液体被挤 |
| T-NOISE-1 | 噪声 | 连续性（相邻采样差 < ε）；同种子一致；值域 [0,1] |
| T-GEN-1 | 世界生成确定性 | 同 `(genVersion, seed, width)` 逐格哈希相等 |
| T-GEN-2 | 生成连续性 | chunk 边界无高度断层；群系过渡带无硬边；出生点合法 |
| T-GEN-3 | 生成规则 | 矿石在深度带内；树不悬空；洞穴不穿透基岩 |
| T-LIQUID-1 | 液体稳定性 | 倒 100 格水最终静止；`activeCells → 0`；无震荡 |
| T-LIQUID-2 | 液体守恒 | 封闭系统内总量不增加（误差 ≤ 舍入损失） |
| T-SAND-1 | 沙 | 落完成锥形；入水变静态；无格重叠 |
| T-LIGHT-1 | 天空光 | 封闭洞为 0；开口处按深度衰减 |
| T-LIGHT-2 | 方块光 | 光源半径正确；多光源取最大；水衰减更快 |
| T-LIGHT-3 | 删光算法 | **挖开再封回后无残留亮斑**（最高优先级回归） |
| T-SAVE-1 | 存档 round-trip | 空世界、随机 10 万格修改、液体修改，逐格相等 |
| T-SAVE-2 | 存档健壮 | 版本不匹配被拒；截断 Blob 被拒；magic 错误被拒 |
| T-SAVE-3 | 压缩率 | 重度游玩 Medium 世界 < 5 MB |
| T-CRAFT-1 | 合成 | 每条配方都能由配方描述复现；工作台筛选正确；材料不足不消耗 |
| T-FURNACE-1 | 熔炉 | 时间推进、燃料耗尽停止、产出入包 |
| T-COMBAT-1 | 战斗 | 命中/无敌帧/击退；死亡掉落 |
| T-SPAWN-1 | 生成规则 | 数量上限 20；范围外销毁；生成点条件满足 |
| T-MODE-1 | 能力标志 | 切换模式只换 flags；存档格式两模式互通 |
| T-CONTENT-1 | 内容可达 | 第 25 节投放表每项可达（`tools/verifyContent.ts`） |

## 27. 性能基准方法

`npm run bench`（`vite-node tools/bench.ts`），无 DOM，固定种子，输出表格：

```
场景                     tick 数   平均 ms   p95 ms   最大 ms
空场景                   3600      0.00      0.01     0.05
Small 走图               3600      ...
Medium 静止水池          3600      ...
Large 静止 + 全世界生成  ...
Medium 挖墙（光照脏区）  3600      ...
Medium 沙崩 10 万格      3600      ...
Medium 20 敌人 + 100 弹幕 ...
```

- 每个里程碑结束时记录一次，作为基线；下一个里程碑不允许比基线劣化 > 10%（除非功能本身更重，需在 commit 里说明）。
- 浏览器内实测用 F3 叠层，不追求精确，只追求「有没有长期超预算」。
- 关键回归命令固定为：`typecheck && lint && test && bench`。

## 28. 风险登记与预案

| 风险 | 影响 | 预案 |
|---|---|---|
| Large 世界内存 ~130 MB 峰值 | 低配机器崩溃 | 默认 Medium；创建时显示估算；Custom 上限硬报错；掉帧时 F3 提示降设置 |
| 世界生成太慢（> 20 s） | 创建体验差 | 增量分帧 + 进度 + 可取消；洞穴改 2D 噪声（勘误 #10）；必要时降低 octave |
| 删光算法实现错 | 光残留，世界越玩越亮 | T-LIGHT-3 必写；`F9+R` 强制全量重算作为逃生阀 |
| 液体 CA 震荡 | CPU 尖峰、卡死 | 每帧单格一次 + 全局上限 + 环形队列 + T-LIQUID-1/2 |
| 存档膨胀到几百 MB | IndexedDB 写爆 | RLE + varint + 分帧扫描 + T-SAVE-3；存档失败降级为 toast 不崩 |
| 固定步长在高负载下螺旋 | 永久卡顿 | 累加器 0.25 s clamp + 最多补 5 步 |
| 程序化贴图不好看 | 视觉不满意 | 风格定为「像素噪点极简」，可接受；若要改 PNG 素材 = 规格变更，需用户批准并把图片放 `src/assets/`（不进运行时网络请求） |
| 内容清单太贪 | 永远做不完 | 第 29 节削减顺序；M10 之前不允许开始新内容 |
| 单人项目无 review | 结构性 bug 累积 | 每个里程碑强制 `typecheck+lint+test+bench` + 验收 checklist 手过 |

## 29. 削减优先级（时间不够时按序砍）

砍 = 从内容表删除或降级为占位，**不砍里程碑结构**。

1. 弓箭线（弓、箭、弹药槽）→ 只留近战。
2. 护甲 → 改成「一个常量减伤」，三套全砍。
3. 床与重生点 → 固定出生点。
4. 箱子 → 无容器，物品栏 40 格够用。
5. 铁砧 → 工作台做全部配方。
6. 被动生物 → 只保留兔子（唯一食物来源之一）。
7. 群系 → 只做森林 + 沙漠。
8. 蜘蛛爬墙 AI → 普通地面快速敌人。
9. 水桶/岩浆桶 → 液体只能用调试命令获得。
10. 鸟、鱼 → 全砍。
11. 昼夜循环 → 固定白天（`dayFactor` 恒 1，但保留代码路径）。
12. 煤矿/金矿 → 只留铁矿（熔炉用木头当燃料）。

**不许砍**：核心循环（M0–M3）、世界生成（M5）、存档（M6）、光照（M7）、液体（M8）、基本生存闭环（M9）。这六个是「游戏还能叫游戏」的底线。

## 30. 完成定义（DoD）

一个里程碑完成，当且仅当全部满足：

- [ ] 该里程碑「验收」清单全部手过一遍并打勾。
- [ ] `npm run typecheck` 0 error
- [ ] `npm run lint` 0 error
- [ ] `npm test` 全绿
- [ ] `npm run bench` 已记录，与基线对比无 > 10% 未解释劣化
- [ ] F3 叠层长时间游玩无红色超预算
- [ ] 存盘 → 重开 → 还原正常（M6 之后每个里程碑都必须过这一条）
- [ ] ROADMAP.md 的「开发进度」小节已更新
- [ ] 提交信息符合 `feat(m<n>): ...` 格式，标注里程碑号

## 31. 开发进度

| 里程碑 | 状态 | 提交 | 验收日期 |
|---|---|---|---|
| M0 工程骨架 | ✅ 已完成 | `feat(m0): complete engineering skeleton` | 2026-10-07 |
| M1 网格/相机/渲染 | ✅ 已完成 | `feat(m1): add world camera and terrain rendering` | 2026-10-07 |
| M2 玩家/物理/状态 | ✅ 已完成 | `feat(m2): add player physics, survival stats, HUD and input` | 2026-10-07 |
| M3 挖掘/放置/物品栏 | ✅ 已完成 | `feat(m3): add mining, placing, doors and item drops` | 2026-10-07 |
| M4 创造沙盒（开发工具） | ✅ 已完成 | `feat(m4): add creative sandbox mode, flight and tile palette` | 2026-10-07 |
| M5 世界生成 | ✅ 已完成 | `feat(m5): add seed-driven world generation and new-world menu` | 2026-10-07 |
| M6 存档 | ✅ 已完成 | `feat(m6): persist worlds to IndexedDB with rotating slots` | 2026-10-07 |
| M7 光照 | ⬜ 未开始 | — | — |
| M8 液体与沙 | ⬜ 未开始 | — | — |
| M9 生存循环 | ⬜ 未开始 | — | — |
| M10 内容扩展 | ⬜ 未开始 | — | — |
| M11 UI/设置/完整创造 | ⬜ 未开始 | — | — |
| M12 发布 | ⬜ 未开始 | — | — |
