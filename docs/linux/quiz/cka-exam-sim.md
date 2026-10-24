---
format: md
sidebar_position: 1
title: CKA 模拟考场（使用说明）
---

# CKA 模拟考场

自用的 **CKA 风格模拟页**：左侧题目（点代码可复制）+ 倒计时 + 右侧可选网页终端。

| | 链接 |
| --- | --- |
| **本站在线打开** | [CKA 模拟考场](pathname:///cka-exam/)（导航栏「CKA 模拟」） |
| **GitHub 项目地址** | https://github.com/linuxergx/cka-exam-sim |

独立仓库包含完整 UI、`questions.js` 题目数据与 README 使用说明，可单独克隆使用。

---

## 先说清楚：填的地址会不会「连上」？

**会加载，但不等于 SSH 登录成功。**

| 你以为的 | 实际机制 |
|----------|----------|
| 填 IP/SSH 就能进考试机 | **不行**。浏览器页面不能直接开 SSH。 |
| 填地址点「连接」 | 只是把右侧 **iframe** 的 `src` 设成你填的 **http(s) URL**。 |
| 怎样才算真正能做题 | 该 URL 必须是一台浏览器能打开的 **网页终端**（通常是 [ttyd](https://github.com/tsl0922/ttyd)），并且你的电脑网络能访问到它。 |

因此：

- 公网访客 **连不上你家里的 `11.0.1.x` 考试环境**——这是正常的。
- 别人没有你的集群时：仍可左侧刷题；右侧终端要 **各自** 准备实验机 + ttyd。
- 地址填错、服务没起、跨网不可达时：右侧会空白或报错，**不是**页面帮你 SSH 进去了。

---

## 推荐用法（有实验环境时）

1. 在 CKA 实验机（或能 `kubectl` 的跳板机）启动 ttyd：

```bash
ttyd -p 8001 --client-option rendererType=dom -W bash
```

2. 浏览器打开模拟页，在顶部「网页终端」填：

- 本机：`http://127.0.0.1:8001/`
- 局域网实验机：`http://<实验机IP>:8001/`

3. 点 **连接**。看到 ttyd 黑窗后再按题目里的 `ssh cka…` 等命令操作。

4. 不需要终端时点 **断开**，可继续只看题。

---

## 没有考试环境时

- 用左侧题库练题面、记考点、练复制命令即可。
- 动手环境可用 Killer / 官方模拟 / 自建 kubeadm 集群等，再按上面方式挂 ttyd。

---

## 本站 / 独立仓库里的文件

| 位置 | 作用 |
|------|------|
| 本站 `static/cka-exam/index.html` | 考场 UI（与独立仓库同步） |
| 本站 `static/cka-exam/questions.js` | 题目数据（改题改这里） |
| GitHub [`linuxergx/cka-exam-sim`](https://github.com/linuxergx/cka-exam-sim) | 独立项目，可直接 clone |

```bash
git clone https://github.com/linuxergx/cka-exam-sim.git
cd cka-exam-sim
# 浏览器打开 index.html，或：
python -m http.server 5500
```
