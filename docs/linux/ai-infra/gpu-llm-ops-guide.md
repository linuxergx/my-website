---
format: md
sidebar_position: 6
title: 生产环境 GPU + LLM 运维实战指南
---

> 原文：https://zhuanlan.zhihu.com/p/2032844045505011968

> 适用场景：多模型产品线上运行，面向 K8s 运维工程师 
> 偏重：规模化调度、监控体系、模型服务调优、故障排查

---

### 一、GPU 调度策略（深度）

### Q1：生产环境常见 GPU 调度方案有哪些？各自优缺点？

**考察点**：是否实际接触过多个方案，而不只是 Device Plugin 一种。

| 方案 | 原理 | 适合场景 | 缺点 |
| --- | --- | --- | --- |
| NVIDIA Device Plugin (time-slicing) | NVML 枚举 + replicas 虚拟 GPU | 推理密集型、延迟不敏感 | 无显存隔离，一个 Pod 可能 OOM 影响同卡其他 Pod |
| HAMi (formerly k8s-vGPU-scheduler) | 拦截 CUDA API，劫持显存分配 | 多租户共享、显存隔离 | 性能损耗约 5-10%，CUDA 版本兼容有限 |
| Volcano | 调度器插件，binpack/spread/优先级队列 | 批量训练、多任务排队 | 非默认调度器，需额外维护 |
| DRA (Dynamic Resource Allocation, K8s 1.28+) | K8s 原生动态资源分配 | 未来趋势，统一 GPU/FPGA/NPU | K8s 版本要求高，生态还在成熟 |
| Kueue | 排队 + 配额管理，不直接管 GPU 分配 | 多团队配额 + 作业排队 | 不解决 GPU 切分本身 |

**实践经验**：

> 实际运维中可以混合使用：Kueue 做多团队排队 + HAMi 做显存隔离切分 + Volcano 做批处理作业调度。单一方案很难覆盖所有场景。

---

### 各方案详细介绍

以下几个方案的核心原理，了解”怎么工作的”和”有什么坑”就够了。

### HAMi — GPU 显存隔离共享

**核心原理**：HAMi 不走 Device Plugin 路线，它在容器里通过 `LD_PRELOAD` 注入一个拦截层，劫持 CUDA API 调用。

```
Pod 内的 CUDA 程序调用 cudaMalloc()
    │
    ▼
HAMi 拦截层捕获这个调用
    ├── 检查该 Pod 的显存配额（比如 4GB）
    ├── 显存足够 → 放行，真正调用 NVIDIA Driver
    └── 显存不足 → 返回 OOM 错误，不会真的爆整卡
```

**解决了什么问题**：

* time-slicing 最大的痛点是**显存不隔离**——邻居 Pod 爆显存，你的服务跟着挂
* HAMi 让每个 Pod 只能看到自己申请的显存额度，超了就返回 OOM，不影响其他 Pod

**缺点**：

* 性能损耗约 5-10%（每次 CUDA 调用多一次拦截判断）
* CUDA 版本兼容性——太新的 CUDA 版本可能拦截不到
* 不是 K8s 原生机制，多了一层维护成本

---

### Volcano — 批处理调度器

**核心原理**：Volcano 是一个 K8s **调度器插件**，和默认调度器并行运行。它不是”替代”Device Plugin，而是在之上增加调度策略。

**它干了什么**：

```
默认调度器（spread 策略）：
  Worker1:  ████░░░░  Pod A
  Worker2:  ████░░░░  Pod B
  Worker3:  ████░░░░  Pod C
  →  Pod 均匀散开，没有节点能空闲

Volcano binpack 策略：
  Worker1:  ████████  Pod A + Pod B
  Worker2:  ████░░░░  Pod C
  Worker3:  ░░░░░░░░  空闲
  →  Pod 集中部署，空闲节点可以缩容省成本
```

**三个核心功能**：

| 功能 | 说明 | 典型场景 |
| --- | --- | --- |
| Binpack | 把 Pod 尽量塞到同一个节点 | GPU 利用率优化、节点缩容 |
| Gang Scheduling | 所有 Pod 同时就绪才一起启动，缺一个都不跑 | MPI 分布式训练（PS + Worker） |
| Queue | 多团队队列 + 排队 | 多租户资源分配 |

**怎么用**：Pod 的 `schedulerName: volcano` 就行，不需要改其他配置。

---

### Kueue — 排队 + 配额管理

**核心原理**：Kueue 和 Volcano 不同。Kueue 只负责”排队”和”检查配额”，不干预 Pod 调度的具体位置。

```
用户提交 Job
    │
    ▼
Kueue Admission Check
  ├── 有配额（GPU ≤ 团队限额）？→ 放行，走默认调度器
  └── 没配额？→ 排队等待，等别人释放
```

**和 Volcano Queue 的区别**：

| 对比 | Volcano Queue | Kueue |
| --- | --- | --- |
| 定位 | 调度策略一体（排队+binpack+gang） | 纯排队+配额 |
| 调度干预 | 接管 Pod 调度 | 不干预，委托默认调度器 |
| 复杂度 | 高（功能多） | 低（专注排队） |
| 配合使用 | 可以单独用 | 常搭配 Volcano 一起用 |

**生产组合**：

> Kueue 和 Volcano 不是竞争关系。生产上常见的组合是：Kueue 做多团队配额排队 + Volcano 做 binpack 调度优化 + HAMi 做显存隔离，各管一摊。

---

### MIG — 硬件级 GPU 切分

**核心原理**：NVIDIA A100/H100 独有的硬件技术，把一张 GPU 从物理上切成多个独立实例。每个实例有**独立的显存、L2 缓存、计算单元**。

**一句话区分**：

| 方案 | 隔离级别 | Pod A 爆了影响 Pod B？ |
| --- | --- | --- |
| Time-Slicing | 软件分时 | 会（共享显存） |
| HAMi | 软件拦截 | 不会（CUDA 拦截） |
| MIG | 硬件隔离 | 绝对不会（物理独立） |

**局限**：

* 仅 A100/H100/H200/B100 以上支持
* 最大实例数有限（A100 80GB 最多 7 个）
* 一旦启用 MIG，整卡不能同时做非 MIG 用途
* 配置比较繁琐（需要 nvidia-smi mig 命令）

---

### DRA — 下一代 K8s 资源管理

**核心原理**：DRA 是 K8s 社区设计中**替代 Device Plugin** 的新框架。它把”只能数数”的 `nvidia.com/gpu: 1`，变成了可参数化声明的资源模型。

**Devices Plugin 的局限 vs DRA 的改进**：

| 问题 | Device Plugin | DRA |
| --- | --- | --- |
| 资源模型 | `nvidia.com/gpu` 1 | 可以声明”80GB 显存、H100、NVLink 连接” |
| 调度信息 | 只知道”有 GPU” | 知道拓扑、NVLink、PCIe 位置 |
| 多设备 | 只能管 GPU | 可以同时管 GPU + NIC + FPGA |
| 用户参数 | 无法传递 | Pod 可以传”我要 MIG profile 1g.10gb” |

**当前状态**：

* K8s 1.26 alpha → 1.28 beta → 1.32 GA
* NVIDIA DRA driver 还在迭代
* 可以通过 feature gate 开启

---

### GPU Operator — NVIDIA 全家桶

**核心原理**：一个 Helm Chart 把 GPU 集群所需的全部组件打包自动部署。

```
GPU Operator 部署的组件：
  ┌──────────────────────────────┐
  │ nvidia-driver-daemonset      │ ← GPU 驱动（可选，宿主机已装可跳过）
  │ nvidia-container-toolkit     │ ← containerd 运行时配置
  │ nvidia-device-plugin         │ ← 设备枚举
  │ nvidia-dcgm-exporter         │ ← GPU 监控指标
  │ nvidia-mig-manager           │ ← MIG 分区管理
  └──────────────────────────────┘
```

**解决了什么问题**： 以前部署 GPU 节点要手动做 5-6 步：装驱动 → 装 runtime → 配 containerd → 部署 Device Plugin → 部署监控 → 配 MIG。GPU Operator 一个 helm install 全搞定。

**注意**：GPU Operator 依赖宿主机内核级驱动支持和标准 /dev/nvidia* 设备路径，WSL2 等虚拟化环境无法使用。

---

### Q2：time-slicing 和 MIG 有什么区别？生产怎么选？

**核心区别**：

| 特性 | time-slicing | MIG (Multi-Instance GPU) |
| --- | --- | --- |
| 隔离级别 | 时间片（软件） | 硬件级物理隔离 |
| 显存隔离 | 无（共享显存） | 有（每个 instance 独立显存） |
| 性能隔离 | 无（争抢影响邻居） | 有（公平调度） |
| 适用 GPU | 所有 NVIDIA GPU | A100/H100/H200/B100 及以上 |
| Pod 故障影响 | 可能 OOM 整卡 | 只影响当前 instance |

**生产选择原则**：

* 有 A100/H100 → 优先 MIG，尤其多租户场景（MIG（Multi-Instance GPU）是 NVIDIA 的专有硬件技术，一些国产化项目里的硬件可能不支持。）
* T4/2080/V100 → time-slicing（不支持 MIG），配合 HAMi 做显存隔离
* 混合集群 → MIG + time-slicing 混用，按 workload 类型分配

---

### Q3：多团队共享 GPU 集群，怎么防止”一人占卡，全家饿死”？

**生产实战方案**：

多层控制：

1. **ResourceQuota**（Namespace 级别）:

```
spec:
     hard:
       requests.nvidia.com/gpu: "8"
       limits.nvidia.com/gpu: "8"
```

1. **Kueue / Volcano Queue** — 配额 + 排队机制：  

* 团队 A 配额 4 卡，团队 B 配额 8 卡
* 空闲资源允许”借出”，紧张时抢占归还

1. **PriorityClass** — 线上推理> 离线训练：

```
- 线上推理 Pod: priority=1000
   - 离线训练 Pod: priority=100
```

1. **Pod Priority Preemption** — 高优 Pod 可以驱逐低优 Pod
2. **监控 + 告警**：  

* GPU 利用率 > 90% 持续 5min → 告警
* 单用户占用 > 配额 → 自动拦截

---

### Q4：GPU 显存碎片化怎么处理？有什么手段？

**场景**：频繁起停 Pod 后，整卡显存碎片化，新 Pod 尽管显存总量够但无法分配。

**手段**：

1. **节点排水 + 重启**（暴力但有效）
2. **HAMi / volcano-vgpu** — 拦截 CUDA 分配，统一管理显存分配，减少碎片
3. **Pod 归一化规格** — 标准化显存请求（2G/4G/8G/16G），避免杂乱规格
4. **定期 defrag 窗口** — 低峰期排空节点重建
5. **预留 buffer** — `gpu-memory-utilization` 留 10-20% 余量

---

### 二、模型压测与性能验证

### Q5：模型上线前怎么做压测？用什么工具？

模型压测分两个维度：

```
① 性能压测（Performance Testing）
   → 测吞吐、延迟、并发能力
   → 工具：vLLM benchmark、Locust、k6、Vegeta

② 稳定性压测（Stability Testing）
   → 测长时间运行有无内存泄漏、显存碎片、偶发 OOM
   → 工具：持续请求脚本 + Prometheus 监控
```

---

### 工具 1：vLLM 自带的 benchmark（最快上手）

vLLM 官方提供了 benchmark 脚本：

```
# 1. 基准测试（测原始吞吐）
git clone https://github.com/vllm-project/vllm
cd vllm/benchmarks

# 测单卡最大吞吐
python benchmark_throughput.py \
  --model /path/to/models/Qwen2.5-14B \
  --backend vllm \
  --num-prompt 1000 \
  --input-len 512 \
  --output-len 128 \
  --trust-remote-code

# 输出示例：
# Throughput: 15.2 requests/s
# Total num tokens: 512000
# Total time: 65.7s

# 2. 测延迟分布（TTFT + TPOT）
python benchmark_latency.py \
  --model /path/to/models/Qwen2.5-14B \
  --input-len 512 \
  --output-len 128 \
  --num-iters 100

# 输出示例：
# P50 TTFT: 0.32s
# P95 TTFT: 0.51s
# P99 TTFT: 0.78s
# P50 TPOT: 0.025s/token
# P95 TPOT: 0.038s/token
```

---

### 工具 2：Locust（HTTP 层压测，最实用）

vLLM 提供 OpenAI 兼容 API，Locust 可以直接压：

```
# locustfile.py
from locust import HttpUser, task, between
import json

class VllmUser(HttpUser):
    wait_time = between(0.1, 0.5)  # 请求间隔 0.1-0.5s
    
    @task
    def chat_completion(self):
        payload = {
            "model": "Qwen2.5-14B",
            "messages": [
                {"role": "user", "content": "你好，请介绍一下你自己" * 20}  # 约 500 tokens
            ],
            "max_tokens": 200,
            "temperature": 0.7
        }
        with self.client.post(
            "/v1/chat/completions",
            json=payload,
            headers={"Content-Type": "application/json"},
            catch_response=True,
            name="chat"
        ) as response:
            if response.status_code != 200:
                response.failure(f"Status: {response.status_code}")
# 启动压测（Web UI 模式，可以在浏览器看实时数据）
locust -f locustfile.py --host http://<your-server-ip>:30080 --users 10 --spawn-rate 1

# 或者无头模式（适合 CI/自动测试）
locust -f locustfile.py --host http://<your-server-ip>:30080 \
  --headless -u 20 -r 2 --run-time 5m --csv=result

# 输出 result_stats.csv：
# Type    Name      # reqs  # fails  Avg    Min   Max    Median  P95
# POST    chat      3000    0       1.2s   0.3s  3.1s   1.1s    2.8s
```

---

### 工具 3：k6（更适合 CI 集成）

```
// k6-script.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 5 },   // 2 分钟爬到 5 并发
    { duration: '5m', target: 10 },  // 5 分钟保持 10 并发
    { duration: '2m', target: 0 },   // 2 分钟降到 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],  // P95 < 5s
    http_req_failed: ['rate<0.01'],      // 错误率 < 1%
  },
};

export default function () {
  const payload = JSON.stringify({
    model: "Qwen2.5-14B",
    messages: [{role: "user", content: "Hello".repeat(100)}],
    max_tokens: 100,
  });
  
  const res = http.post('http://<your-server-ip>:30080/v1/chat/completions', payload, {
    headers: {'Content-Type': 'application/json'},
    timeout: '30s',
  });
  
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(0.5);
}
k6 run k6-script.js
```

---

### 工具 4：压力测试 + 稳定性测试（Python + aiohttp）

```
# stress_test.py
import asyncio
import aiohttp
import time
import statistics

async def send_request(session, sem, i):
    async with sem:
        payload = {
            "model": "Qwen2.5-14B",
            "messages": [{"role": "user", "content": "你好" * 50}],
            "max_tokens": 100,
            "temperature": 0.7
        }
        start = time.time()
        try:
            async with session.post(
                "http://<your-server-ip>:30080/v1/chat/completions",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=60)
            ) as resp:
                latency = time.time() - start
                return {"ok": resp.status == 200, "latency": latency, "code": resp.status}
        except Exception as e:
            return {"ok": False, "latency": time.time() - start, "error": str(e)}

async def main():
    concurrency = 8         # 模拟 8 个并发用户
    total_requests = 200    # 总共发 200 个请求
    sem = asyncio.Semaphore(concurrency)
    
    async with aiohttp.ClientSession() as session:
        tasks = [send_request(session, sem, i) for i in range(total_requests)]
        
        results = []
        for coro in asyncio.as_completed(tasks):
            results.append(await coro)
        
        # 统计
        latencies = [r["latency"] for r in results if r["ok"]]
        errors = [r for r in results if not r["ok"]]
        
        print(f"总请求: {total_requests}")
        print(f"成功: {len(latencies)}, 失败: {len(errors)}")
        print(f"P50 延迟: {statistics.median(latencies):.2f}s")
        print(f"P95 延迟: {sorted(latencies)[int(len(latencies)*0.95)]:.2f}s")
        print(f"P99 延迟: {sorted(latencies)[int(len(latencies)*0.99)]:.2f}s")
        print(f"吞吐: {len(latencies) / sum(latencies):.2f} req/s")
        
        if errors:
            for e in errors[:5]:
                print(f"错误示例: {e}")

asyncio.run(main())
```

---

### 压测时重点关注的指标

```
应用层指标（vLLM Prometheus metrics 直接暴露）：
  ┌─────────────────────────────┬──────────────────┬──────────────┐
  │ 指标                        │ 含义              │ 压测关注值    │
  ├─────────────────────────────┼──────────────────┼──────────────┤
  │ vllm:num_requests_waiting   │ 排队请求数        │ 不持续增长   │
  │ vllm:gpu_cache_usage        │ KV Cache 使用率   │ < 95%        │
  │ vllm:request_ttft           │ 首 token 延迟     │ P99 < 3s     │
  │ vllm:request_avg_latency    │ 平均请求延迟      │ P99 < 10s    │
  │ vllm:request_success_rate   │ 请求成功率        │ > 99%        │
  └─────────────────────────────┴──────────────────┴──────────────┘
  
系统层指标（Prometheus / DCGM）：
  ┌──────────────────────┬──────────────────┬──────────────┐
  │ 指标                 │ 含义              │ 压测关注值    │
  ├──────────────────────┼──────────────────┼──────────────┤
  │ GPU 利用率           │ 算力是否打满      │ 70-95%       │
  │ GPU 显存使用率       │ 是否接近 OOM      │ < 90%        │
  │ GPU 温度             │ 散热是否跟得上    │ < 85°C       │
  │ GPU 功耗             │ 是否功率受限      │ < TDP        │
  └──────────────────────┴──────────────────┴──────────────┘
```

---

### 工业级压测方案参考

```
大厂的模型压测流水线：

  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
  │ 压测场景  │ → │ 施压工具  │ → │ 指标采集  │ → │ 判定通过  │
  │ 设计      │   │          │   │          │   │          │
  └──────────┘   └──────────┘   └──────────┘   └──────────┘
  
  ① 压测场景设计：
     - 请求量：正常负载 (70%) → 峰值 (100%) → 压测 (150%) → 降回
     - 输入长度：短 (128)、中 (1024)、长 (4096)
     - 输出长度：短 (50)、中 (200)、长 (1024)
     - 混合场景：70% 短对话 + 20% 长文档 + 10% 多轮会话
  
  ② 施压层（常用组合）：
     - k6 / Locust → HTTP 层压力（模拟用户请求）
     - 配合 vLLM 自带 benchmark → 基准数据
  
  ③ 指标采集：
     - Prometheus → Grafana 实时看板
     - 自动记录每次压测的 SLO 达标情况
  
  ④ 判定标准（SLO）：
     - P95 TTFT < 2s
     - P95 TPOT < 0.05s/token
     - 错误率 < 1%
     - 无 OOM
     - 连续压测 1 小时无显存增长（无泄漏）
```

---

### Q6：vLLM / TGI / Triton 在生产上怎么选？各自的坑？

| 产品 | 优势 | 痛点 |
| --- | --- | --- |
| vLLM | 社区活跃，PagedAttention 省显存，continuous batching 强 | 偶尔 OOM 不恢复，需要配合重启策略 |
| TGI (Text Generation Inference) | HuggingFace 亲儿子，模型兼容性好 | 吞吐不如 vLLM |
| Triton Inference Server | 多模型/多后端/FIFO 调度，企业级 | 配置复杂，学习曲线陡 |

**生产配置要点**（以 vLLM 为例）：

```
--max-model-len 4096             不要设太大，显存利用率会低
--gpu-memory-utilization 0.9     留 10% 给模型加载和临时缓冲区
--max-num-seqs 256               控制并发度，防止 OOM
--enable-prefix-caching          前缀缓存（多轮对话场景效果明显）
```

---

### Q7：vLLM Pod 突然 OOM 了，怎么排查和预防？

**排查步骤**：

1. `kubectl describe pod` → 看 OOMKilled 状态
2. `kubectl logs --previous` → 看 crash 前最后输出
3. Prometheus 看 vLLM 指标：`vllm:gpu_cache_usage` 是否接近 100%
4. 检查是否触发了 max_num_seqs 上限
5. 检查并发请求是否激增

**预防措施**：

```
# Deployment 配置
resources:
  limits:
    nvidia.com/gpu: "1"
    memory: "64Gi"           # 限制容器内存
spec:
  containers:
    args:
    - "--gpu-memory-utilization"
    - "0.85"                 # 不要设到 0.95
    - "--max-num-seqs"
    - "128"                  # 限制最大并发
---
# 自动恢复
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  failureThreshold: 3
  periodSeconds: 30
```

---

### Q8：首 token 延迟（TTFT）超标，有哪些调优手段？

**首 token 延迟是关键用户感知指标**，优化手段按收益排序：

1. **减少模型大小**：INT4 量化（GPTQ/AWQ），减少计算量
2. **KV Cache 优化**：`--enable-prefix-caching` + 多轮对话 session 保持
3. **增大 tensor-parallel-size**：多卡并行，减少计算时间（适合大模型）
4. **模型预热**：部署完成后自动发送几个请求，让 CUDA Graph 编译预热
5. **限制 max-model-len**：减少 KV Cache 分配时间
6. **使用更快的存储**：模型从 NVMe SSD 加载比从 NFS 快

```
# 启动脚本中加入预热
args:
- "--model"
- "/path/to/models/Qwen2.5-14B"
- "--enforce-eager"
# 预热请求可以通过 initContainer 或 postStart hook 实现
---
lifecycle:
  postStart:
    exec:
      command:
      - "/bin/sh"
      - "-c"
      - "sleep 30 && curl -s -X POST http://localhost:8000/v1/completions -d '{\"model\":\"Qwen2.5-14B\",\"prompt\":\"预热\",\"max_tokens\":1}' || true"
```

---

### Q9：模型灰度发布怎么做？A/B 测试怎么切流？

**生产方案**：

```
┌─ vLLM v1 (老版本, serving)
用户请求 → Ingress → Service      ┤
                                  └─ vLLM v2 (新版本, 灰度 10%)
# Service 利用 label selector 分流
apiVersion: v1
kind: Service
metadata:
  name: vllm-service
spec:
  selector:
    app: vllm-server
  # 默认都会选中
---
# 通过 Pod 数量控制灰度比例
# v1: 9 副本  |  v2: 1 副本  →  v2 获得约 10% 流量
```

**进阶方案（istio/linkerd）**：

```
VirtualService:
  - match: headers {"x-canary": "true"}
    route: v2
  - weight: 90 → v1
  - weight: 10 → v2
```

---

### 三、GPU 集群可观测性

### Q10：GPU 监控采集哪些指标？阈值怎么设？

**DCGM Exporter 关键指标**：

| 指标 | 含义 | 告警阈值 | 说明 |
| --- | --- | --- | --- |
| DCGM_FI_DEV_GPU_UTIL | GPU 算力利用率 | > 90% 持续 5min | 算力瓶颈 |
| DCGM_FI_DEV_FB_USED | 显存使用量 | > 85% | 显存瓶颈 |
| DCGM_FI_DEV_MEM_CLOCK | 显存时钟频率 | 异常降低 | 可能降频 |
| DCGM_FI_DEV_POWER_USAGE | 功耗 | > 95% TDP | 功率受限 |
| DCGM_FI_DEV_TEMP | GPU 温度 | > 85°C | 散热问题 |
| DCGM_FI_DEV_XID_ERRORS | XID 错误 | > 0 | GPU 硬件问题（严重） |

**vLLM 业务指标**（通过 Prometheus metrics endpoint）：

| 指标 | 含义 | 告警 |
| --- | --- | --- |
| vllm:request_avg_latency | 请求平均延迟 | > 5s |
| vllm:request_ttft | 首 token 延迟 | > 2s |
| vllm:gpu_cache_usage | KV Cache 使用率 | > 95% |
| vllm:num_requests_waiting | 排队请求数 | > 100 |
| vllm:request_success_rate | 成功率 | < 99% |

---

### Q11：GPU 出现 XID 错误怎么办？如何自动化处理？

**XID 错误是 GPU 硬件级别的严重事件**，常见 XID：

* XID 48 / 64：GPU 掉线，通常需要 reset
* XID 79：显存 ECC 错误
* XID 13：GPU 进程崩溃

**自动化处理方案**：

```
# Prometheus Alert → Webhook → 自动化处理
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: gpu-xid-alert
spec:
  groups:
  - name: gpu
    rules:
    - alert: GPU_XID_Error
      expr: DCGM_FI_DEV_XID_ERRORS > 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "GPU XID错误 {{ $labels.gpu }}"
---
# 自动处理流程：
# 1. AlertManager 触发 webhook
# 2. 自动 cordon 该 GPU 节点（kubectl cordon）
# 3. 驱逐受影响 Pod（kubectl drain --force）
# 4. 通知值班人员（飞书/企微机器人）
# 5. 如果是可恢复错误（XID 13/48），尝试 GPU reset
# 6. 如果不可恢复（XID 79），标记节点待维修
```

---

### 四、K8s 运维实战

### Q12：GPU 节点加入集群后，调度器看不到 GPU 资源，怎么排查？

**排查路径**：

```
1. 检查 Device Plugin 是否运行
   kubectl get pods -n nvidia-device-plugin
   
2. 查看 Device Plugin 日志
   kubectl logs -n nvidia-device-plugin <pod-name>
   常见错误: "No devices found" → NVML 枚举不到
   
3. 检查 nvidia-smi 是否正常
   kubectl exec -it <pod> -- nvidia-smi
   
4. 检查驱动版本
   nvidia-smi 显示的驱动版本 vs 容器内驱动版本
   如果容器用 GPU Operator，驱动在 driver-daemonset 里
   
5. 检查 kubelet 是否注册了设备
   kubectl describe node <node> | grep nvidia.com/gpu
   
6. 检查 containerd runtime 配置
   nvidia-container-runtime 是否正确配置
```

---

### Q13：GPU 集群成本怎么算？怎么优化算力利用率？

**成本模型**：

```
单卡成本 = (硬件折旧 + 电费 + 制冷 + 机房) / 运行时间
每小时成本 = 单卡成本 × 卡数 × 利用率
```

**优化路径**：

| 手段 | 节费幅度 | 风险 |
| --- | --- | --- |
| HAMi 显存切分 | 2-4x | 性能损耗 5-10% |
| 空闲节点弹缩（Cluster Autoscaler） | 30-50% | 启动慢 |
| Spot 实例（云上） | 60-80% | 被回收风险 |
| MIG (A100/H100) | 3-7x | 仅高端卡支持 |
| INT4/AWQ 量化 | 2x 吞吐 | 精度略微下降 |
| Prefix Caching | 1.5-3x 吞吐 | 仅适用多轮对话 |

---

### Q14：怎么管理多个模型版本？模型更新怎么做到不影响线上？

**模型版本管理方案**：

```
model-registry/
├── Qwen2.5-14B/
│   ├── v1.0/              ← 原始 FP16
│   ├── v1.1-gptq-int4/    ← 量化版（当前线上）
│   └── v1.2-awq/          ← 灰度测试中
├── Qwen3-0.6B/
│   └── v1.0/
└── bge-m3/
    └── v2.0/
```

**滚动更新策略**：

```
# 更新模型 → 重建 Pod → 无缝切换
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1         # 先起新 Pod
      maxUnavailable: 0   # 再停旧 Pod，零停机
```

**进阶（蓝绿部署）**：

```
# 切换 service selector 实现秒级切换
apiVersion: v1
kind: Service
metadata:
  name: vllm-service
spec:
  selector:
    app: vllm-server
    version: v2   # 从 v1 切到 v2，瞬间切换
```

---

### Q15：GPU 节点宕机了，上面的推理 Pod 怎么恢复？需要多长时间？

**恢复流程**：

1. **Detect**：Node Not Ready / GPU XID Error
2. **Evict**：Pod 自动被 controller-manager 驱逐（5-7 分钟 Taint 容忍超时）
3. **Reschedule**：Deployment 在其他节点重建 Pod
4. **Load**：模型重新加载（14B 模型约 105 秒）
5. **Ready**：StartupProbe 通过后接入流量

**优化方案**：

```
# 缩短恢复时间
spec:
  tolerations:
  - key: "node.kubernetes.io/not-ready"
    operator: "Exists"
    tolerationSeconds: 60   # 默认 300，缩短到 60 秒
---
# 多副本 + anti-affinity（避免同时受影响）
spec:
  replicas: 2
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: vllm-server
        topologyKey: kubernetes.io/hostname
```

**注意**：GPU Pod 因为显存限制，恢复时间主要由模型加载时间决定。

---

### Q16：K8s 1.28+ 的 DRA 是什么？和现有 Device Plugin 方案比有什么优势？

**DRA (Dynamic Resource Allocation)** 是 K8s 1.26 引入（1.28+ beta，1.32+ GA）的新机制：

| 对比维度 | Device Plugin | DRA |
| --- | --- | --- |
| 资源模型 | 简单计数（`nvidia.com/gpu` 1） | 灵活参数化（显存量、算力等级、UUID等） |
| 调度灵活性 | 固定粒度（整卡/时间片） | 细粒度（显存: 8Gi，算力: 50% 等） |
| 多设备协调 | 不支持 | 支持（同时分配 GPU + NIC） |
| 自定义参数 | 不支持 | 支持（由 ResourceClass 和 ResourceClaim 描述） |
| 成熟度 | GA 稳定 | K8s 1.32 GA，生态建设中 |

**DRA 典型用例**：

```
# K8s 1.32+，NVIDIA DRA Driver
apiVersion: resource.k8s.io/v1beta1
kind: ResourceClaim
spec:
  resourceClassName: nvidia-gpu
  parameters:
    memory: "16Gi"
    count: 2
    gpuModel: "A100-40GB"
```

---

### Q17：用 GPU Operator 遇到过什么坑？

**实际运维中常见问题**：

1. **驱动版本不一致**：GPU Operator 安装的驱动可能和宿主机冲突 → 需要确认 `nvidia-driver-daemonset` 的驱动版本和 GPU 型号兼容
2. **Operator 升级导致 GPU 不可用**： → 升级前 cordon 节点、drain Pod，升级完验证再恢复
3. **containerd 配置冲突**：GPU Operator 会改 containerd 配置 → 备份原始配置，Operator 卸载后手动恢复
4. **WSL2 不支持 GPU Operator**： → GPU Operator 依赖 NVML 枚举 /dev/nvidia*，WSL2 只有 /dev/dxg
5. **helm 升级失败卡住**：CRD 更新问题 → 手动 apply CRD 后再 helm upgrade

---

### 五、核心知识问答

### Q18：vLLM 启动参数 `--gpu-memory-utilization` 设多少合适？

这个参数控制的是**vLLM 进程**自身对显存的使用上限，不是整个 GPU 的显存配额。

**经验值**：

* 生产环境（A100 80GB）：**0.85-0.9**，留 10-15% 给模型加载临时缓冲和 torch 上下文
* 实验环境（小显存卡）：根据实际情况调整，确保 KV Cache 有足够空间

**设太高的风险**：

* KV Cache 满了，新请求排队或 OOM

**设太低的问题**：

* 浪费显存，同等并发需要更多 GPU 卡，成本上升

---

### Q19：14B 模型 INT4 量化后大概占多少显存？怎么估算的？

**估算公式**：

```
模型权重 ≈ 参数量 × 每个参数的字节数
14B × 0.5 bytes（INT4）= 7GB
加 KV Cache、中间激活 ≈ 8-10GB 总占用
```

**对比参考**：

```
FP16: 14B × 2 bytes = 28GB → 单卡 22GB/24GB 装不下
INT4: 14B × 0.5 bytes = 7GB → 普通消费级显卡能跑

230B 模型需要多少卡？
230B × 2 bytes（FP16）= 460GB
8 × 80GB（H100）= 640GB → tensor-parallel-size=8
```

---

### Q20：Pod 设置 `nvidia.com/gpu: "0"` 在生产环境会有什么问题？

在使用了 RuntimeClass 绕过的实验环境中可以设 `"0"` 绕过 Device Plugin 枚举，但生产环境绝对不能这么配。

**生产环境问题**：

* 生产环境 Device Plugin 能正常枚举 GPU
* 设 `"0"` 表示 Pod 不需要 GPU 资源
* 调度器可能把 Pod 分配到没有 GPU 的节点
* 容器启动时 nvidia-smi 找不到显卡，直接报错

**正确做法**：

* `nvidia.com/gpu: 1`，让调度器明确知道这个 Pod 需要 GPU
* 同时加 nodeSelector 或 tolerations 双保险

**核心**：实验环境的 workaround 不是生产标准做法。

---

### Q21：模型加载 105 秒，这个数字正常吗？怎么优化？

**时间构成**：

```
105 秒 = 加载权重（从本地 SSD 读 7-8GB 文件）
       + 初始化 CUDA context
       + 分配 KV Cache
       + 模型 warmup
```

对于 14B INT4 从本地 SSD 加载 → **正常范围**；如果从 NFS 加载 → 可能 3-5 分钟。

**优化方向**：

```
① 并行化：多个 vLLM 实例同时启动，各自加载（没有更好办法）
② 预热加载：提前把模型权重挂到 tmpfs（内存盘）→ 但是占用内存
③ 探针调优：startupProbe 的 failureThreshold × periodSeconds 要覆盖模型加载时间
```

---

### Q22：WSL2 的 GPU 穿透和真实物理机的 GPU 使用，有什么区别？

**核心差异**：

| 维度 | WSL2 | 真实物理机 |
| --- | --- | --- |
| GPU 设备 | /dev/dxg（DirectX 桥接） | /dev/nvidia0, /dev/nvidiactl |
| NVML | 不可用（枚举不到设备） | 正常 |
| Device Plugin | 报”No devices found” | 正常注册 |
| GPU Operator | 不支持 | 标准部署方式 |
| CUDA Graph | 不支持（需要 –enforce-eager） | 完全支持 |
| 性能损耗 | ~5-10%（经过 WSL 转换层） | 原生性能 |

> WSL2 的 GPU 穿透是 Windows 通过 DirectX 桥接把 GPU 映射到 Linux 的，不走标准 /dev/nvidia*。所以 Device Plugin 用不了，需要用 RuntimeClass 绕过。性能比原生差一些，但做学习和实验没问题。生产环境的 GPU 服务器不会有这些问题。

---

### Q23：只有 1 张物理卡，怎么验证多节点 GPU 调度？

当使用 time-slicing 时：

```
设置了 time-slicing replicas=8
多个 worker 节点各自显示 8 个虚拟 GPU

但真相是：
  Worker1: 8 个虚拟 GPU → 全部映射到同一张物理卡
  Worker2: 8 个虚拟 GPU → 也全部映射到同一张物理卡
  
多个 worker 上的 Pod 实际上在共享同一张物理 GPU
这是"物理上伪多节点"的实验环境限制
```

**验证要点**：

* Pod 调度逻辑（nodeSelector/affinity）确实在工作
* `kubectl get pods -o wide` 能看到 Pod 分布在不同 worker 上
* 只是 GPU 资源是共享的，不影响调度策略的学习

**换到真实多卡环境**：

* NodeSelector、tolerations、affinity 逻辑可以直接复用
* Device Plugin 和 time-slicing 需要重新配（走标准 NVML 路径）
* 监控体系（DCGM + Prometheus）可以复用

---

### Q24：内网离线环境，怎么解决模型和镜像拉取的问题？

**离线环境解决方案**：

1. 本地镜像仓库缓存所有镜像
2. 模型文件直接放到本地 SSD，用 Local PV 挂载、或者用NFS
3. `HF_HUB_OFFLINE=1` + `TRANSFORMERS_OFFLINE=1` 禁止联网
4. HuggingFace cache 用本地绝对路径加载

**模型更新**：

* 把新模型文件 scp 到宿主机模型目录
* 重建 Pod（换 volume 路径或重启 Deployment）
* 如果有 NFS，所有节点共享，更新一次就够了

**镜像仓库断网运维**：

* 从公网下载镜像 → 导出 tar → 传输到内网 → docker load
* 可使用 Harbor 的 proxy cache 功能
* 最关键的是：提前评估好需要的所有镜像，一次同步到位

---

### Q25：Pod 调度到 GPU 节点后发现没有 GPU 资源，怎么排查？

**通用排查路径**：

```
1. kubectl get pods -n nvidia-device-plugin
   → 验证 Device Plugin DaemonSet 是否正常运行

2. kubectl logs -n nvidia-device-plugin <pod>
   → 看日志中是否有 "No devices found" / "NVML error"

3. kubectl exec -it -n nvidia-device-plugin <pod> -- nvidia-smi
   → 看容器内能否识别 GPU

4. kubectl describe node <node> | grep nvidia.com/gpu
   → 看节点是否注册了 GPU 资源

5. kubectl logs -n kube-system kubelet 或 journalctl -u kubelet
   → 看 kubelet 的 Device Plugin gRPC 连接是否正常

6. 检查 containerd runtime 配置
   → /etc/containerd/config.toml 是否配置了 nvidia runtime
```

---

### Q26：Prometheus 监控到 GPU 温度 90°C，会做什么？

**动作清单**：

```
① 确认是不是负载导致
   DCGM_FI_DEV_GPU_UTIL 和 DCGM_FI_DEV_TEMP 一起看
   如果利用率高 + 温度高 → 正常负载，但需要关注散热

② 检查风扇/散热
   物理机：检查风扇转速、进风口温度
   如果是服务器：检查空调/液冷

③ 降频/限流
   如果持续 90°C+ 可能触发 GPU 降频 → 影响推理性能
   可以考虑限制这个节点上的 Pod 并发量

④ 自动化处理
   Alert → cordon 节点 → 排空 → 通知硬件运维
   等温度恢复正常 → uncordon
```

---

### Q27：vLLM 参数 `--enforce-eager` 在生产环境会用吗？

**结论**：生产环境不要加。

* `--enforce-eager` 禁用 CUDA Graph，吞吐会下降 20-40%
* 仅在 WSL2 这种不兼容 CUDA Graph 的环境才需要

**CUDA Graph 的作用**：

* 把多次 CUDA kernel 调用编译成一个”图”，一次性执行
* 减少 kernel launch 开销，对短请求场景（< 1000 tokens）提升明显
* vLLM 默认启用，生产环境建议保持默认

---

### Q28：GPU 监控配了哪些指标和告警规则？哪些必须配？

```
必修指标：
  ① GPU 利用率（算力是否打满）
  ② 显存使用率（会不会 OOM）
  ③ GPU 温度（散热是否正常）
  ④ XID 错误（GPU 硬件是否健康）

选修指标（加分）：
  ⑤ vLLM 请求延迟（TTFT/TPOT）
  ⑥ KV Cache 使用率
  ⑦ 请求排队长度
  ⑧ 模型推理成功率

必须配的告警：
  1. GPU 温度 > 85°C → 通知（可能降频）
  2. XID 错误 > 0 → P0 告警（硬件故障）
  3. 显存使用率 > 90% → 警告（可能 OOM）
  4. GPU 利用率 < 10% 持续 1 小时 → 提示（资源浪费）
```

---

### Q29：GPU 集群运维中最常见的踩坑是什么？

**典型问题：torch 版本兼容性问题**

**现象**：Pod 启动后一直 CrashLoopBackOff，日志报 `check_torch_load_is_safe()` 拒绝加载 `pytorch_model.bin`。

**排查**：

* 查看日志发现 transformers 4.41+ 要求 torch >= 2.6
* 但镜像里的 torch 是 2.3.0
* 原因是 Dockerfile 写死了特定版本

**解决**：Dockerfile 放宽版本约束，重建镜像。

**深层原因**：

* 镜像构建时从 PyPI 拉了 CPU-only 的 torch
* 但容器跑在 GPU 节点上，containerd 重新装了 CUDA 版本的 torch
* 兜底依赖没覆盖到
* **镜像构建时不能假设运行环境和构建环境一致**

---

### Q30：理想的 GPU 集群运维体系是什么样的？

```
┌─────────────────────────────────────────────────┐
│               用户入口 (API/SDK/Web)              │
├─────────────────────────────────────────────────┤
│               统一管理平台                        │
│  ┌────────────┬────────────┬────────────────┐   │
│  │ 模型 Registry│ 配额系统   │ 任务编排        │   │
│  ├────────────┼────────────┼────────────────┤   │
│  │ 模型版本管理 │ 团队配额    │ 推理服务部署    │   │
│  │ 镜像缓存    │ 抢占策略    │ 训练任务调度    │   │
│  │ 模型格式转换 │ 计费展示    │ 批量推理       │   │
│  ├────────────┴────────────┴────────────────┤   │
│  │              调度层                        │   │
│  │  K8s + Volcano/HAMi + Kueue + DRA          │   │
│  ├────────────┬────────────┬────────────────┤   │
│  │  GPU 节点池 │  CPU 节点池 │  存储          │   │
│  │  (A100/H100)│  (普通计算) │  (NFS/Ceph/S3) │   │
│  └────────────┴────────────┴────────────────┘   │
├─────────────────────────────────────────────────┤
│              可观测性                          │
│  Prometheus + Grafana + Loki + AlertManager     │
│  GPU 利用率 / 模型延迟 / 请求量 / 成本报表      │
└─────────────────────────────────────────────────┘
```

关键要求：

* **多租户隔离**：不同团队配额隔离，互不干扰
* **弹性调度**：推理预留资源，训练用闲时资源
* **成本透明**：每个业务线能看到自己的 GPU 消耗
* **自动化**：故障自愈 + 模型自动部署 + 灰度发布
* **安全合规**：镜像扫描 + NetworkPolicy + RBAC

---

### 附：面试应答框架推荐

面试场景中，推荐使用 **STAR 法** 组织回答：

```
S（情境）：我们 14B 模型上线后，GPU 显存碎片化导致 OOM 频发
T（任务）：需要在不加卡的前提下提升 GPU 利用率
A（行动）：对比了 time-slicing / HAMi / MIG 三个方案，最终选...
R（结果）：GPU 利用率从 35% 提升到 72%，未再发生共享卡 OOM
```

**最后提醒**：面试 K8s 运维 + 大模型岗位，核心不是会用哪个工具，而是见过哪些**真实故障**、怎么**排查**、怎么**预防**。面试官要的是能扛线上的人。每件事都能讲出”现象→排查→根因→解决→防复发”这个链路，就比只会背概念的人强得多。
