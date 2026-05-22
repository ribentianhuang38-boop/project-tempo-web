# 项目待修 Bug 总结 — 2026-05-19

## 状态：2个严重bug未修复

### Bug 1：主页面 JS 语法错误（崩溃级）

**现象**：主页 page-1 始终不可见（opacity:0），整个 JS 脚本因语法错误停止执行。

**根因**：`fetchAIResponse` 函数（index.html 第535行）的花括号未正确闭合。Node.js 解析报 `Unexpected token ')'`。

**定位方法**：
```bash
cd /home/wyatt/project-tempo-web && node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
let scripts = []; let pos = 0;
while (true) {
    const openIdx = html.indexOf('<script', pos);
    if (openIdx === -1) break;
    const closeIdx = html.indexOf('</script>', openIdx);
    if (closeIdx === -1) break;
    const tagEnd = html.indexOf('>', openIdx) + 1;
    scripts.push(html.substring(tagEnd, closeIdx));
    pos = closeIdx + 9;
}
let mainScript = scripts.sort((a,b) => b.length - a.length)[0];
let lines = mainScript.split('\n');
let k = 0;
for (let i = 0; i < lines.length; i++) {
    for (const ch of lines[i]) { if (ch==='{') k++; if (ch==='}') k--; }
    if (i >= 160 && i <= 180) console.log((i+1) + ' brace=' + k + ': ' + lines[i].substring(0,100));
}
"
```
输出显示 brace depth 在 fetchAIResponse 之后永远不会回到 0。

**修复方向**：
1. 读取 fetchAIResponse 函数的完整内容（约535-625行）
2. 用 `node -e` + `new Function()` 二分法定位第一个语法错误行
3. 检查该行附近的 `}` 是否缺失或位置错误
4. 可能是之前多次 patch 操作导致代码片段被覆盖或合并

---

### Bug 2：猫动画跑马灯效果（显示级）

**现象**：64帧精灵图不逐帧切换，而是像跑马灯一样滑动。

**根因**：CSS keyframe 的 `to` 值错误。
- 错误：`to { background-position: -4032px 0; }` → 每步移动 4032/64 = 63px
- 正确：`to { background-position: -4096px 0; }` → 每步移动 4096/64 = 64px（精确对齐每帧）

**状态**：CSS 已在本次 session 中修复（-4032 → -4096），但因 Bug 1 导致 JS 崩溃，无法验证效果。

**修复完成后验证**：
```css
@keyframes petIdle64Loop {
    from { background-position: 0 0; }
    to { background-position: -4096px 0; }
}
```

---

## 本次 session 已完成的工作

| 项目 | 状态 |
|------|------|
| 64帧精灵图切割（8×8 → 1×64 strip） | ✅ |
| 黑色背景透明化（tolerance=25） | ✅ |
| 灵境枢纽 page-2a 双视窗重构 | ✅ |
| NexusController（Tab切换+召唤仪式） | ✅ |
| PetAnimator（坐下/行走帧切换） | ✅ |
| 全局宠物悬浮容器 | ✅ |
| 登录系统暂时下线 | ✅ |
| CSS keyframe -4032→-4096 修复 | ✅ |
| **JS语法错误修复** | ❌ 未完成 |
| **猫动画效果验证** | ❌ 因Bug1阻塞 |

## 备注

- 子代理（mimo-v2.5-pro）每次只能做 3 次 API 调用就超时，无法完成任何 patch 操作
- 已将默认模型从 mimo-v2.5 切换为 mimo-v2.5-pro
- 主代理 `max_iterations` 已从 5 改为 10
- 子代理 `max_iterations` 已从 3 改为 20（但实际无效，是模型本身的限制）
- 下次 session 优先修复 Bug 1（JS语法错误），Bug 2 可能随之自动解决
