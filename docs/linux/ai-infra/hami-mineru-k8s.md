---
format: md
sidebar_position: 1
title: HAMi + MinerU 在 K8s 上的部署指南
---

# HAMi + MinerU 在 RTX 2080 Ti（22G） Kubernetes 集群部署指南

> **最后更新：** 2026-06-21  
> **最终状态：** ✅ MinerU 生产可用 | ⚠️ HAMi share 模式（不做显存隔离） 多个 Pod 共享同一张物理显存，谁用超了谁 OOM，而且没有任何保护，所以建议预留显卡的20%算力资源。如果是Ampere 架构是支持MIG技术 
> **参与设备：** 1× RTX 2080 Ti 22GB (sm_75, Turing 架构)
>
> **技术方案：** 所有部署均在本人pve服务器上执行，部署遇到驱动兼容问题时使用claude code协助解决，整体流程已经跑通，解析结果正确正常。

---

## 目录

1. [环境概览](#1-环境概览)
2. [前置条件：GPU 节点准备](#2-前置条件gpu-节点准备)
3. [HAMi 安装与配置](#3-hami-安装与配置)
4. [MinerU 镜像构建](#4-mineru-镜像构建)
5. [MinerU Deployment 部署](#5-mineru-deployment-部署)
6. [完整 YAML 模板](#6-完整-yaml-模板)
7. [踩坑记录与解决方案](#7-踩坑记录与解决方案)
8. [GPU 调度模式对比](#8-gpu-调度模式对比)
9. [API 使用指南](#9-api-使用指南)
10. [已知限制与待办](#10-已知限制与待办)
11. [运维脚本](#11-运维脚本)
12. [给部署者的注意事项](#12-给部署者的注意事项)

---

## 1. 环境概览

### 集群拓扑

| 角色 | 主机名 | IP | CPU | 内存 | GPU |
|------|--------|-----|-----|------|-----|
| control-plane | k8s-master | 192.168.1.6 | 16C | 8GB | — |
| worker | k8s-node01 | 192.168.1.7 | 8C | 16GB | — |
| **GPU worker** | **k8s-node02** | **192.168.1.8** | **32C** | **38GB** | **RTX 2080 Ti 22GB** |

### 软件版本矩阵

| 组件 | 版本 | 备注 |
|------|------|------|
| Kubernetes | v1.33.13 | kubeadm 部署 |
| 容器运行时 | containerd | **node02: 1.7.16** / 其他: 2.2.4 ⚠️ |
| GPU 驱动 | 550.144.03 | 闭源驱动，从 575.51.03 降级 |
| CUDA | 12.4 | 与驱动配套 |
| HAMi | v2.9.0 | Helm 部署 → 手动改 ConfigMap |
| MinerU | v3.3.1 | CLI + FastAPI |
| MinerU 镜像 | mineru:v0.8.5-local | 基于 vllm/vllm-openai:v0.8.5 |
| PyTorch | 2.6.0+cu124 | — |

---

## 2. 前置条件：GPU 节点准备

### 2.1 降级 GPU 驱动（575 → 550）

> **为什么必须降级？**  
> HAMi v2.9.0 的 `libvgpu.so` 与 NVIDIA Open Kernel 575.51.03 在 cuInit 层不兼容，报 `cuInit failed:100`。  
> 这是 HAMi 社区已知 issue [#1351](https://github.com/Project-HAMi/HAMi/issues/1351)，至今未修复。

```bash
# 在 GPU 节点 (k8s-node02) 上执行
# 1. 卸载 575 驱动
sudo apt purge 'nvidia-*' -y
sudo apt autoremove -y

# 2. 安装 550 闭源驱动
sudo apt install nvidia-driver-550 -y
sudo reboot

# 3. 验证
nvidia-smi
# 预期: Driver Version: 550.144.03, CUDA Version: 12.4
```

### 2.2 创建 CUDA 兼容库目录

> **为什么需要？**  
> MinerU 镜像内预装的 CUDA compat 库版本可能与宿主驱动不一致。  
> 把宿主的 550.144.03 库文件挂载进容器，确保 linker 始终加载正确版本。

```bash
# 在 GPU 节点上执行，只需一次
sudo mkdir -p /var/lib/nvidia/compat-libs
cd /usr/lib/x86_64-linux-gnu

# 复制核心库
for lib in libcuda.so.550.144.03       \
           libnvidia-ml.so.550.144.03  \
           libnvidia-ptxjitcompiler.so.550.144.03 \
           libnvidia-nvvm.so.550.144.03 \
           libcudadebugger.so.550.144.03 \
           libnvidia-pkcs11.so.550.144.03; do
    sudo cp $lib /var/lib/nvidia/compat-libs/
done

# 创建符号链接
cd /var/lib/nvidia/compat-libs
sudo ln -sf libcuda.so.550.144.03       libcuda.so.1
sudo ln -sf libcuda.so.1                libcuda.so
sudo ln -sf libnvidia-ml.so.550.144.03  libnvidia-ml.so.1
sudo ln -sf libnvidia-ml.so.1           libnvidia-ml.so
sudo ln -sf libnvidia-ptxjitcompiler.so.550.144.03 libnvidia-ptxjitcompiler.so.1
sudo ln -sf libnvidia-nvvm.so.550.144.03           libnvidia-nvvm.so.4
sudo ln -sf libcudadebugger.so.550.144.03          libcudadebugger.so.1
sudo ln -sf libnvidia-pkcs11.so.550.144.03         libnvidia-pkcs11.so
```

### 2.3 标签与 /etc/ld.so.preload

```bash
# GPU 节点打标签
kubectl label node k8s-node02 nvidia.com/gpu.present=true
kubectl label node k8s-node02 gpu=on

# ⚠️ 关键：清空 /etc/ld.so.preload
# 如果它指向 /usr/local/vgpu/libvgpu.so，所有容器（含 device-plugin 自身）
# 都会被迫加载一个可能不兼容的 libvgpu，导致级联崩溃
sudo rm -f /etc/ld.so.preload
```

### 2.4 NVIDIA 容器运行时

```bash
# containerd 配置需包含 nvidia 运行时
# /etc/containerd/config.toml
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
  SystemdCgroup = true
```

---

## 3. HAMi 安装与配置

### 3.1 Helm 安装（初始）

```bash
helm repo add hami https://project-hami.github.io/HAMi/
helm install hami hami/hami \
  -n kube-system \
  --version v2.9.0 \
  --set global.imageTag=v2.9.0 \
  --set devicePlugin.deviceSplitCount=1 \
  --set devicePlugin.deviceMemoryScaling=1 \
  --set devicePlugin.passDeviceSpecsEnabled=true \
  --set devicePlugin.deviceListStrategy=envvar
```

### 3.2 手动修改 ConfigMap（关键步骤）

Helm 安装后，需要手动修改 **两个** ConfigMap 来匹配 GPU 节点配置。

#### ConfigMap 1: `hami-device-plugin`（device-plugin 读取）

```bash
kubectl patch cm -n kube-system hami-device-plugin --type merge -p '
{
  "data": {
    "config.json": "{\n  \"nodeconfig\": [\n    {\n      \"name\": \"k8s-node02\",\n      \"operatingmode\": \"share\",\n      \"devicememoryscaling\": 1,\n      \"devicesplitcount\": 10,\n      \"migstrategy\": \"none\",\n      \"filterdevices\": {\n        \"uuid\": [],\n        \"index\": []\n      }\n    }\n  ]\n}"
  }
}'
```

| 字段 | 含义 | 我们的取值 |
|------|------|-----------|
| `name` | 目标 GPU 节点名 | `k8s-node02` |
| `operatingmode` | 调度模式 | `share` — 时间分片，不隔离显存 |
| `devicesplitcount` | 虚拟 GPU 数量 | `10` — 把 1 张物理卡注册为 10 个虚拟 GPU |
| `devicememoryscaling` | 显存报告倍数 | `1` — 报真实 22GB |
| `migstrategy` | MIG 策略 | `none` — 2080 Ti 不支持 MIG |

#### ConfigMap 2: `hami-scheduler-device`（scheduler 读取）

```bash
kubectl patch cm -n kube-system hami-scheduler-device --type merge -p '
{
  "data": {
    "device-config.yaml": "nvidia:\n  resourceCountName: nvidia.com/gpu\n  resourceMemoryName: nvidia.com/gpumem\n  resourceCoreName: nvidia.com/gpucores\n  overwriteEnv: false\n  defaultMemory: 0\n  defaultCores: 0\n  defaultGPUNum: 1\n  deviceSplitCount: 10\n  deviceMemoryScaling: 1\n  deviceCoreScaling: 1\n  gpuCorePolicy: default\n"
  }
}'
```

> **重要：** `deviceSplitCount` 必须在两个 ConfigMap 中保持一致，否则 scheduler 计算的 GPU 数量与 device-plugin 注册的不匹配，调度会失败。

### 3.3 device-plugin DaemonSet 补丁

```bash
# 如果 device-plugin 启动报 NVML library not found，
# 需要在容器中设置 LD_LIBRARY_PATH 指向宿主 NVML 库
kubectl set env ds/hami-device-plugin -n kube-system \
  LD_LIBRARY_PATH=/usr/local/vgpu
```

### 3.4 旧版 Helm values 参考

```yaml
global:
  imageTag: "v2.9.0"

devicePlugin:
  deviceSplitCount: 10          # ← 按需调整
  deviceMemoryScaling: 1
  deviceListStrategy: "envvar"
  passDeviceSpecsEnabled: true
  nodeConfiguration:
    config: |
      {
        "nodeconfig": [
          {
            "name": "k8s-node02",
            "operatingmode": "share",
            "devicesplitcount": 10,
            "migstrategy": "none",
            "filterdevices": {
              "uuid": [],
              "index": []
            }
          }
        ]
      }
```

### 3.5 HAMi Scheduler 避坑

scheduler 应避开 containerd 不稳定的节点（我们的 node02）：

```bash
kubectl patch deploy -n kube-system hami-scheduler --type json -p '
[{"op":"add","path":"/spec/template/spec/nodeSelector","value":{"kubernetes.io/hostname":"k8s-node01"}}]'
```

---

## 4. MinerU 镜像构建

### 4.1 为什么不用官方镜像

官方 MinerU 镜像基于最新 CUDA，但我们降级到了 550.144.03 + CUDA 12.4。因此选用 `vllm/vllm-openai:v0.8.5` 作为 base（自带 CUDA 12.4 + PyTorch 2.6.0），在其上安装 MinerU。

### 4.2 Dockerfile（参考）

```dockerfile
FROM vllm/vllm-openai:v0.8.5

# 安装 MinerU
RUN pip install "mineru[pipeline]"==3.3.1

# 默认后端切换为 pipeline（启动脚本中执行也可）
RUN sed -i 's/DEFAULT_BACKEND = BACKEND_HYBRID_ENGINE/DEFAULT_BACKEND = BACKEND_PIPELINE/' \
    /usr/local/lib/python3.12/dist-packages/mineru/cli/backend_options.py

# 暴露 API 端口
EXPOSE 8000

CMD ["mineru-api", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t mineru:v0.8.5-local .
# 推送到 node02 本地镜像或私有 registry
docker tag mineru:v0.8.5-local 192.168.1.8:5000/mineru:v0.8.5-local
```

---

## 5. MinerU Deployment 部署

### 5.1 配置项解析

| 配置 | 类型 | 含义 |
|------|------|------|
| `annotations: hami.io/webhook: "ignore"` | HAMi | 绕过 HAMi webhook，不让 HAMi 注入 libvgpu |
| `schedulerName: default-scheduler` | K8s | 使用默认调度器（不经过 HAMi scheduler） |
| `NVIDIA_VISIBLE_DEVICES: all` | NVIDIA | 容器可看到所有 GPU |
| `LD_LIBRARY_PATH=/usr/local/nvidia-compat:...` | Linker | 优先加载宿主的 compat 库（550.144.03） |
| `compat-libs` Volume | hostPath | 挂载 `/var/lib/nvidia/compat-libs` → 容器 `/usr/local/nvidia-compat` |
| `output` Volume | hostPath | 挂载 node02 本地目录存放解析结果 |
| `resources.limits.nvidia.com/gpu: 1` | K8s | 申请 1 个 GPU（在 HAMi 视角是 1 个虚拟 GPU） |
| `memory: 16Gi` | K8s | **系统内存**限制（非 GPU 显存），防止 OOM |
| `backend: pipeline` | MinerU | 使用传统 OCR 管线（**这是 2080 Ti 唯一可用的后端**） |

### 5.2 后端选择

```
pipeline:         ✅ 2080 Ti 可用，中文/表格准确，不依赖 vLLM
hybrid-engine:    ❌ 需要 vLLM V1 引擎，要求 compute capability ≥ 8.0
                  （2080 Ti 是 sm_75 = Turing，V1 报错；
                   V0 在 v0.8.5 有 fallback bug）
vlm-engine:       ❌ 同样需要高版本 vLLM
vlm-http-client:  ⚠️ 需要外部 OpenAI 兼容服务
```

---

## 6. 完整 YAML 模板

```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mineru-api
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mineru-parser
      role: api
  template:
    metadata:
      labels:
        app: mineru-parser
        role: api
      annotations:
        # 绕过 HAMi webhook，不注入 libvgpu
        hami.io/webhook: "ignore"
    spec:
      # 使用默认调度器，不经 HAMi scheduler
      schedulerName: default-scheduler
      nodeSelector:
        # 只在有 GPU 的节点上运行
        nvidia.com/gpu.present: "true"
      containers:
      - name: mineru-api-worker
        image: mineru:v0.8.5-local
        imagePullPolicy: IfNotPresent

        command: ["/bin/bash", "-c"]
        args:
        - |
          # 1. 切换默认后端为 pipeline（2080 Ti 唯一可用后端）
          sed -i 's/DEFAULT_BACKEND = BACKEND_HYBRID_ENGINE/DEFAULT_BACKEND = BACKEND_PIPELINE/' \
            /usr/local/lib/python3.12/dist-packages/mineru/cli/backend_options.py
          # 2. 启动 API 服务
          exec mineru-api --host 0.0.0.0 --port 8000

        env:
        # --- MinerU 配置 ---
        - name: MINERU_MODEL_SOURCE
          value: "local"

        # --- NVIDIA 容器运行时 ---
        - name: NVIDIA_VISIBLE_DEVICES
          value: "all"
        - name: NVIDIA_DRIVER_CAPABILITIES
          value: "compute,utility"

        # --- CUDA 兼容库路径（优先加载宿主的 550.144.03）---
        - name: LD_LIBRARY_PATH
          value: "/usr/local/nvidia-compat:/usr/local/nvidia/lib:/usr/local/nvidia/lib64"

        # --- 可选：关闭 Swagger UI（安全考虑）---
        # - name: MINERU_API_ENABLE_FASTAPI_DOCS
        #   value: "0"

        # --- 可选：结果持久化路径 ---
        # - name: MINERU_API_OUTPUT_ROOT
        #   value: "/output"

        resources:
          limits:
            nvidia.com/gpu: 1        # 申请 1 个虚拟 GPU
            memory: "16Gi"            # 容器系统内存上限（非显存）
            cpu: "4"
          requests:
            cpu: "4"
            memory: "16Gi"

        volumeMounts:
        # 挂载宿主 550.144.03 兼容库（覆盖镜像内旧版）
        - name: compat-libs
          mountPath: /usr/local/nvidia-compat
        # 解析结果输出目录
        - name: output
          mountPath: /output

        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 60
          periodSeconds: 15
          failureThreshold: 5

      volumes:
      - name: compat-libs
        hostPath:
          path: /var/lib/nvidia/compat-libs
      - name: output
        hostPath:
          path: /home/gx/mineru-out
          type: DirectoryOrCreate
---
apiVersion: v1
kind: Service
metadata:
  name: mineru-api-svc
  namespace: default
spec:
  type: NodePort
  selector:
    app: mineru-parser
    role: api
  ports:
  - name: core-api
    port: 8000
    targetPort: 8000
    nodePort: 30080
```

---

## 7. 踩坑记录与解决方案

### 7.1 HAMi device-plugin 崩溃：NVML library not found

```
E0617 factory.go:116] Failed to initialize NVML: ERROR_LIBRARY_NOT_FOUND
```

| 根因 | 修复 |
|------|------|
| 容器内找不到 `libnvidia-ml.so` | 设 `LD_LIBRARY_PATH=/usr/local/vgpu`（容器已挂载宿主 NVML 库到此目录） |

### 7.2 575 驱动与 HAMi libvgpu 不兼容

```
[HAMI-core ERROR] cuInit failed:100
```

| 根因 | 修复 |
|------|------|
| HAMi v2.9.0 的 `libvgpu.so` 与 NVIDIA Open Kernel 575.51.03 的 cuInit API 不兼容 | 降级驱动到 550.144.03（闭源驱动） |

**这是本次部署最大的坑。** 从 575 → 550 降级触发了后续一整条兼容链问题。

### 7.3 CUDA compat 库版本不匹配

```
Error 803: system has unsupported display driver / cuda driver combination
```

| 根因 | 修复 |
|------|------|
| 镜像内 CUDA compat 库是 550.54.15，宿主驱动是 550.144.03，版本不一致 | 创建 `/var/lib/nvidia/compat-libs/`，复制 550.144.03 全部库文件，挂载进容器并设 `LD_LIBRARY_PATH` |

### 7.4 vLLM V0/V1 引擎冲突

| 尝试 | 结果 |
|------|------|
| `VLLM_USE_V1=0` | 实际启动了 V1 引擎，行为矛盾 |
| `VLLM_USE_V1=1` | `not supported with Compute Capability < 8.0` |
| 最终方案 | 放弃 hybrid-engine，改用 pipeline 后端 |

RTX 2080 Ti 是 Turing 架构（sm_75），vLLM V1 要求 ≥ Ampere（sm_80）。V0 fallback 在 v0.8.5 版本有已知 bug。

### 7.5 `/etc/ld.so.preload` 毒化节点

| 症状 | 根因 | 修复 |
|------|------|------|
| 所有容器（含 device-plugin 自身）异常崩溃 | `/etc/ld.so.preload` 指向 `/usr/local/vgpu/libvgpu.so`，强制所有进程加载不兼容库 | `sudo rm -f /etc/ld.so.preload` |

**这个问题会反复出现**：每次 HAMi 重启都可能重新创建 `ld.so.preload` 文件。建议写成 cron 或在 node 启动脚本中清理。

### 7.6 containerd 版本不一致导致 node02 Pod 频繁重启

| 症状 | 根因 | 修复 |
|------|------|------|
| flannel、kube-proxy、HAMi device-plugin 每 ~2 分钟重启 | node02 containerd 1.7.16 (其他节点 2.2.4)，shim v2 超时触发 `SandboxChanged` | 升级 containerd 到 2.2.4 |

```bash
# ephemeral workaround: restart containerd (clears ~7.6GB memory leak)
sudo systemctl restart containerd
sudo systemctl restart kubelet

# permanent fix: upgrade containerd
sudo apt update && sudo apt install containerd=2.2.4-* -y
sudo systemctl restart containerd kubelet
```

---

## 8. GPU 调度模式对比

### 8.1 HAMi 两种模式

| | hami-core | share |
|------|------|------|
| **显存隔离** | ✅ 严格限制每个 Pod 可用显存 | ❌ 不限制，共享物理显存 |
| **算力隔离** | ✅ 限制每个 Pod 可用 SM 核心 | ❌ 仅时间分片 (time-slicing) |
| **GPU 设备传递** | ❌ 不传 `/dev/nvidia0`，走 hook 劫持 | ✅ 传设备文件，原生 CUDA |
| **libvgpu 依赖** | 必须加载 | 不需要 |
| **CUDA 兼容层** | 有额外要求 | 标准 CUDA |
| **我们的 2080 Ti** | ❌ cuInit:100 不可用 | ✅ 可用 |

### 8.2 deviceSplitCount 的含义

```
deviceSplitCount=10 → kubelet 看到 10 个 nvidia.com/gpu
                     10 个 Pod 可以同时申请 GPU
                     但显存共享（share 模式不做隔离）
```

我们设 10 个，约定总使用量不超过 18GB / 22GB（预留 ~20% 余量）。

### 8.3 绕过 HAMi Webhook

MinerU Pod 配置了两项来完全绕过 HAMi 注入：

```yaml
annotations:
  hami.io/webhook: "ignore"       # webhook 不处理此 Pod
spec:
  schedulerName: default-scheduler # 不走 HAMi scheduler
```

这样 MinerU 直接用标准 Kubernetes GPU 调度（nvidia device plugin 模式），亲和 HAMi 的 GPU 注册。

---

## 9. API 使用指南

### 9.1 端点列表

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/file_parse` | 同步解析（等待完成后返回） |
| POST | `/tasks` | 异步提交任务 |
| GET | `/tasks/{task_id}` | 查询任务状态 |
| GET | `/tasks/{task_id}/result` | 获取解析结果 |
| GET | `/health` | 健康检查 |
| GET | `/docs` | Swagger UI |

### 9.2 调用示例

```bash
# 同步模式（等完成再返回 JSON）
curl -X POST http://192.168.1.8:30080/file_parse \
  -F "files=@document.pdf" \
  -F "backend=pipeline" \
  -F "return_md=true"

# 异步模式 + ZIP 下载
curl -X POST http://192.168.1.8:30080/tasks \
  -F "files=@document.pdf" \
  -F "backend=pipeline" \
  -F "response_format_zip=true"

# 查进度
curl http://192.168.1.8:30080/tasks/{task_id}

# 下载结果
curl http://192.168.1.8:30080/tasks/{task_id}/result -o result.zip
```

### 9.3 辅助脚本



```bash
# 使用 mineru-parse.sh（见项目目录）
root@k8s-node02:/home/gx# cat mineru-parse.sh 
#!/bin/bash
#
# mineru-parse.sh — 远程调用 MinerU API 解析文档
#
# 用法:
#   ./mineru-parse.sh <PDF文件> [选项]
#
# 示例:
#   ./mineru-parse.sh document.pdf
#   ./mineru-parse.sh document.pdf --zip -o result.zip
#   ./mineru-parse.sh document.pdf --json --timeout 600
#   ./mineru-parse.sh document.pdf --backend pipeline --lang en
#
# 依赖: curl, python3

set -euo pipefail

# ============================================================
# 默认配置
# ============================================================
API_HOST="${MINERU_API_HOST:-192.168.1.8:30080}"
BACKEND="${MINERU_BACKEND:-pipeline}"
LANG="${MINERU_LANG:-ch}"
PARSE_METHOD="${MINERU_PARSE_METHOD:-auto}"
TIMEOUT="${MINERU_TIMEOUT:-600}"
POLL_INTERVAL="${MINERU_POLL_INTERVAL:-5}"
OUTPUT_FORMAT="${MINERU_OUTPUT_FORMAT:-json}"   # json | zip
OUTPUT_FILE=""
RETURN_MD="true"
RETURN_IMAGES="true"
RETURN_MIDDLE_JSON="false"
RETURN_CONTENT_LIST="false"
RETURN_ORIGINAL="false"
START_PAGE="0"
END_PAGE="99999"
FORMULA_ENABLE="true"
TABLE_ENABLE="true"
QUIET="false"

# ============================================================
# 帮助
# ============================================================
usage() {
    cat << 'EOF'
用法: mineru-parse.sh <PDF文件> [选项]

通过 MinerU API 解析 PDF/图片/Office 文档，返回 Markdown + 提取的图片。

选项:
  --backend <name>       解析后端: pipeline (默认) | vlm-http-client | hybrid-http-client
  --lang <code>          OCR 语言: ch (默认) | en | japan | korean | ...
  --parse-method <m>     解析方式: auto (默认) | txt | ocr
  --zip                  返回 ZIP 文件 (含 md + images + middle_json)
  --json                 返回 JSON (默认, md_content 在响应体中)
  --with-middle-json     结果中包含 middle_json
  --with-content-list    结果中包含 content_list
  --keep-original        ZIP 中包含原始文件
  --no-md                不返回 markdown
  --no-images            不返回图片
  --no-formula           禁用公式解析
  --no-table             禁用表格解析
  --pages <start>-<end>  指定页码范围 (从 0 开始), 如 --pages 0-10
  -o, --output <file>    结果保存路径 (默认: <PDF文件名>_result.<json|zip>)
  -q, --quiet            静默模式, 只输出结果文件路径
  --host <host:port>     API 地址 (默认: 192.168.1.8:30080)
  --timeout <seconds>    最大等待时间 (默认: 600)
  --interval <seconds>   轮询间隔 (默认: 5)
  -h, --help             显示帮助

环境变量 (可替代命令行参数):
  MINERU_API_HOST        API 地址
  MINERU_BACKEND         解析后端
  MINERU_LANG            OCR 语言
  MINERU_TIMEOUT         超时秒数
  MINERU_OUTPUT_FORMAT   json | zip

示例:
  mineru-parse.sh report.pdf
  mineru-parse.sh report.pdf --zip -o report.zip
  mineru-parse.sh report.pdf --json --no-images
  mineru-parse.sh scan.pdf --lang en --parse-method ocr
  MINERU_API_HOST=10.0.0.5:30080 mineru-parse.sh doc.pdf
EOF
    exit 0
}

# ============================================================
# 参数解析
# ============================================================
INPUT_FILE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --backend)        BACKEND="$2"; shift 2 ;;
        --lang)           LANG="$2"; shift 2 ;;
        --parse-method)   PARSE_METHOD="$2"; shift 2 ;;
        --zip)            OUTPUT_FORMAT="zip" ; shift ;;
        --json)           OUTPUT_FORMAT="json"; shift ;;
        --with-middle-json) RETURN_MIDDLE_JSON="true"; shift ;;
        --with-content-list) RETURN_CONTENT_LIST="true"; shift ;;
        --keep-original)  RETURN_ORIGINAL="true"; shift ;;
        --no-md)          RETURN_MD="false"; shift ;;
        --no-images)      RETURN_IMAGES="false"; shift ;;
        --no-formula)     FORMULA_ENABLE="false"; shift ;;
        --no-table)       TABLE_ENABLE="false"; shift ;;
        --pages)
            if [[ "$2" =~ ^([0-9]+)-([0-9]+)$ ]]; then
                START_PAGE="${BASH_REMATCH[1]}"
                END_PAGE="${BASH_REMATCH[2]}"
            else
                echo "错误: --pages 格式必须为 <start>-<end>, 如 0-10" >&2
                exit 1
            fi
            shift 2 ;;
        -o|--output)      OUTPUT_FILE="$2"; shift 2 ;;
        -q|--quiet)       QUIET="true"; shift ;;
        --host)           API_HOST="$2"; shift 2 ;;
        --timeout)        TIMEOUT="$2"; shift 2 ;;
        --interval)       POLL_INTERVAL="$2"; shift 2 ;;
        -h|--help)        usage ;;
        -*)
            echo "未知选项: $1" >&2
            usage ;;
        *)
            if [[ -z "$INPUT_FILE" ]]; then
                INPUT_FILE="$1"
            else
                echo "错误: 只能指定一个输入文件" >&2
                exit 1
            fi
            shift ;;
    esac
done

# ============================================================
# 校验
# ============================================================
if [[ -z "$INPUT_FILE" ]]; then
    echo "错误: 请指定要解析的 PDF 文件" >&2
    echo "用法: $0 <PDF文件> [选项]" >&2
    exit 1
fi

if [[ ! -f "$INPUT_FILE" ]]; then
    echo "错误: 文件不存在: $INPUT_FILE" >&2
    exit 1
fi

BASE_URL="http://${API_HOST}"
FILENAME=$(basename "$INPUT_FILE")
FILESTEM="${FILENAME%.*}"

if [[ -z "$OUTPUT_FILE" ]]; then
    if [[ "$OUTPUT_FORMAT" == "zip" ]]; then
        OUTPUT_FILE="${FILESTEM}_result.zip"
    else
        OUTPUT_FILE="${FILESTEM}_result.json"
    fi
fi

# ============================================================
# 辅助函数
# ============================================================
log() {
    if [[ "$QUIET" != "true" ]]; then
        echo "[$(date +%H:%M:%S)] $*" >&2
    fi
}

check_api() {
    local resp
    resp=$(curl -s "${BASE_URL}/health" 2>&1) || {
        echo "错误: 无法连接 MinerU API (${BASE_URL})" >&2
        exit 1
    }
    local status
    status=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null)
    if [[ "$status" != "healthy" ]]; then
        echo "错误: MinerU API 不健康: $resp" >&2
        exit 1
    fi
}

# ============================================================
# 主流程
# ============================================================

# 1. 检查 API 健康
log "检查 API 状态..."
check_api
log "API 状态: healthy"

# 2. 提交任务
log "提交解析任务: $FILENAME"
log "  后端: $BACKEND, 语言: $LANG, 方法: $PARSE_METHOD"

SUBMIT_RESP=$(curl -s -X POST "${BASE_URL}/tasks" \
    -F "files=@${INPUT_FILE}" \
    -F "backend=${BACKEND}" \
    -F "lang_list=${LANG}" \
    -F "parse_method=${PARSE_METHOD}" \
    -F "return_md=${RETURN_MD}" \
    -F "return_images=${RETURN_IMAGES}" \
    -F "return_middle_json=${RETURN_MIDDLE_JSON}" \
    -F "return_content_list=${RETURN_CONTENT_LIST}" \
    -F "return_original_file=${RETURN_ORIGINAL}" \
    -F "response_format_zip=$( [[ "$OUTPUT_FORMAT" == "zip" ]] && echo true || echo false )" \
    -F "formula_enable=${FORMULA_ENABLE}" \
    -F "table_enable=${TABLE_ENABLE}" \
    -F "start_page_id=${START_PAGE}" \
    -F "end_page_id=${END_PAGE}")

TASK_ID=$(echo "$SUBMIT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])" 2>/dev/null)
TASK_STATUS=$(echo "$SUBMIT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null)

if [[ -z "$TASK_ID" ]]; then
    echo "错误: 提交任务失败" >&2
    echo "$SUBMIT_RESP" >&2
    exit 1
fi

log "任务已提交: task_id=$TASK_ID"

# 3. 轮询等待完成
START_TIME=$(date +%s)
while true; do
    ELAPSED=$(( $(date +%s) - START_TIME ))

    if [[ $ELAPSED -ge $TIMEOUT ]]; then
        echo "错误: 任务超时 (${TIMEOUT}s)" >&2
        echo "  task_id=$TASK_ID (结果仍可在 API 中查询)" >&2
        exit 1
    fi

    STATUS_RESP=$(curl -s "${BASE_URL}/tasks/${TASK_ID}")
    TASK_STATUS=$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null)

    case "$TASK_STATUS" in
        completed)
            log "解析完成! (耗时 ${ELAPSED}s)"
            break ;;
        failed)
            ERROR_MSG=$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','unknown error'))" 2>/dev/null)
            echo "错误: 解析失败 — $ERROR_MSG" >&2
            exit 1 ;;
        processing)
            if [[ "$QUIET" != "true" ]]; then
                printf "\r[%s] 解析中... (已等待 %ds)" "$(date +%H:%M:%S)" "$ELAPSED" >&2
            fi ;;
    esac

    sleep "$POLL_INTERVAL"
done

# 4. 下载结果
log "下载结果到: $OUTPUT_FILE"

if [[ "$OUTPUT_FORMAT" == "zip" ]]; then
    curl -s -o "$OUTPUT_FILE" "${BASE_URL}/tasks/${TASK_ID}/result"
else
    curl -s "${BASE_URL}/tasks/${TASK_ID}/result" -o "$OUTPUT_FILE"
fi

FILE_SIZE=$(stat -c%s "$OUTPUT_FILE" 2>/dev/null || stat -f%z "$OUTPUT_FILE" 2>/dev/null || echo 0)
FILE_SIZE_MB=$(python3 -c "print(f'${FILE_SIZE}/1024/1024:.2f')" 2>/dev/null || echo "?")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ 解析完成"
echo "  ──────────────────────────────────────────────────────"
echo "  任务 ID   : $TASK_ID"
echo "  输入文件  : $FILENAME"
echo "  输出文件  : $OUTPUT_FILE (${FILE_SIZE_MB} MB)"
echo "  总耗时    : ${ELAPSED}s"
echo "  ──────────────────────────────────────────────────────"
echo "  查询状态  : curl ${BASE_URL}/tasks/${TASK_ID}"
echo "  重新下载  : curl ${BASE_URL}/tasks/${TASK_ID}/result -o result.zip"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 如果输出 JSON, 显示 markdown 字符数
if [[ "$OUTPUT_FORMAT" == "json" && "$QUIET" != "true" ]]; then
    MD_CHARS=$(python3 -c "
import sys, json
with open('$OUTPUT_FILE') as f:
    data = json.load(f)
for name, result in data.get('results', {}).items():
    md = result.get('md_content', '')
    print(len(md))
" 2>/dev/null)
    if [[ -n "$MD_CHARS" ]]; then
        echo "  Markdown   : ${MD_CHARS} 字符"
    fi
fi

exit 0



./mineru-parse.sh document.pdf --zip -o result.zip
./mineru-parse.sh scan.pdf --lang en --parse-method ocr
```

---

## 10. 已知限制与待办

### 🔴 严重

| 问题 | 影响 | 计划 |
|------|------|------|
| node02 containerd 1.7.16 | DaemonSet Pod 每 ~2min 重启 | 升级到 2.2.4 |
| HAMi hami-core 不可用 (cuInit:100) | 无法做显存隔离 | 等 HAMi 新版本，或换 535 驱动 |

### 🟡 中等

| 问题 | 影响 | 计划 |
|------|------|------|
| DNS 配置 nameserver 超限 | `Nameserver limits exceeded` 警告 | 精简 `/etc/resolv.conf` |
| hybrid-engine 不可用 (sm_75) | 复杂排版的 VLM 理解无法使用 | 硬件限制，无法修复 |
| pipeline 后端在处理超大 PDF 时较慢 | 9.4MB/100+ 页耗时 ~6min | 可调大并发参数 |

### 🟢 已解决

| 问题 | 方案 |
|------|------|
| CUDA compat 库不匹配 | hostPath 挂载宿主 550.144.03 库 |
| `/etc/ld.so.preload` 毒化 | 删除文件 + 写入无害注释 |
| deviceSplitCount 配置不全 | 同时修改 device-plugin + scheduler ConfigMap |

---

## 11. 运维脚本

### 11.1 集群健康检查

```bash
#!/bin/bash
# 检查 MinerU + HAMi + 关键 DaemonSet 状态

echo "=<mark> GPU 节点 </mark>="
kubectl get node k8s-node02 -o jsonpath='
  GPU Capacity:    {.status.capacity.nvidia\.com/gpu}
  GPU Allocatable: {.status.allocatable.nvidia\.com/gpu}{"\n"}'

echo "=<mark> MinerU </mark>="
kubectl get pod -n default -l role=api -o wide

echo "=<mark> MinerU Health </mark>="
curl -s http://192.168.1.8:30080/health | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(f'{d[\"status\"]} | v{d[\"version\"]} | processing:{d[\"processing_tasks\"]}')"

echo "=<mark> HAMi </mark>="
kubectl get pods -n kube-system -l app.kubernetes.io/name=hami -o wide

echo "=<mark> DaemonSets（关注重启次数）</mark>="
kubectl get pods -A -o wide | grep -E 'flannel|kube-proxy' | grep node02
```

### 11.2 应急恢复

```bash
#!/bin/bash
# node02 containerd 内存泄漏应急处理
# 在 master 节点执行

echo "重启 node02 上的 DaemonSet Pods..."
kubectl delete pod -n kube-system -l app.kubernetes.io/component=hami-device-plugin
kubectl delete pod -n kube-flannel -l app=flannel --field-selector spec.nodeName=k8s-node02
kubectl delete pod -n kube-system -l k8s-app=kube-proxy --field-selector spec.nodeName=k8s-node02

echo "等待恢复..."
sleep 30

kubectl get pods -A -o wide | grep node02
```

### 11.3 `ld.so.preload` 检查与修复

```bash
# 在 node02 上手动执行
# 检查
cat /etc/ld.so.preload 2>/dev/null && echo "⚠️ ld.so.preload 存在，可能毒化节点！"

# 检查 /usr/local/vgpu/ld.so.preload 是否为目录
if [ -d /usr/local/vgpu/ld.so.preload ]; then
    echo "⚠️ ld.so.preload 是目录！需要修复"
    sudo rm -rf /usr/local/vgpu/ld.so.preload
    echo "# HAMi share mode - preload disabled" | sudo tee /usr/local/vgpu/ld.so.preload
    sudo chmod 644 /usr/local/vgpu/ld.so.preload
fi

# 清除 /etc 下的
sudo rm -f /etc/ld.so.preload
```

---

## 12. 给部署者的注意事项

### 前置检查清单

- [ ] GPU compute capability ≥ 7.0（pipeline 后端）或 ≥ 8.0（hybrid/vlm 后端）
- [ ] GPU 驱动版本与 HAMi 兼容（550.x 闭源驱动推荐，**避开 Open Kernel 575.x**）
- [ ] 驱动版本与容器内 CUDA 版本匹配
- [ ] 检查所有节点的 containerd 版本是否一致
- [ ] 确认 HAMi device-plugin ConfigMap 中的 `name` 字段与实际 GPU 节点 `hostname` 一致
- [ ] **删除 `/etc/ld.so.preload`**（如果存在）
- [ ] 确保 GPU 节点的 `/var/lib/nvidia/compat-libs` 已填充并与驱动版本一致

### 驱动兼容性矩阵

| GPU 驱动 | HAMi v2.9.0 hami-core | HAMi v2.9.0 share |
|------|------|------|
| 550.144.03 (闭源) | ❌ cuInit:100 | ✅ 可用 |
| 535.x (闭源) | ✅ 社区报告可用 | ✅ 可用 |
| 575.51.03 (Open Kernel) | ❌ cuInit:100 | ⚠️ 未测试 |

### 常见陷阱

1. **只改了 device-plugin ConfigMap 没改 scheduler ConfigMap** → `deviceSplitCount` 不一致，调度失败

2. **设了 `LD_LIBRARY_PATH` 但没挂载 compat libs volume** → 容器仍然加载错误版本的 CUDA 库

3. **Helm reinstall 后需要重新 patch ConfigMap** → Helm 会覆盖手动修改

4. **`kubectl cp` 不支持 `deploy/<name>` 简写** → 必须用完整 Pod 名

5. **Swagger UI `/docs` 暴露了所有 API 端点信息** → 生产环境建议设 `MINERU_API_ENABLE_FASTAPI_DOCS=0`

6. **MinerU API 没有内置认证** → 内网场景 UUID task_id 隔离已足够；公网场景需要前面加 nginx 反代做 Basic Auth

7. **pipeline 后端 CPU 负载高于 GPU** → OCR 阶段在 CPU 上运行，GPU 负载间歇性，4 核 16GB 内存是推荐的底线

### 性能参考

| 文档规格 | 后端 | 耗时 | 备注 |
|------|------|------|------|
| 4 页中文简历 | pipeline | ~22s | 表格正确 |
| 27 页技术文档 | pipeline | ~22s | 8 个表格全对 |
| 100+ 页产品手册 (9.4MB) | pipeline | ~380s (6min20s) | 171 张图片，3922 行 MD |

---

## 附录：完整文件清单

| 文件 | 路径 | 用途 |
|------|------|------|
| 部署指南 | `/home/gx/hami-mineru-k8s-guide.md` | 本文档 |
| 原始部署记录 | `/home/gx/hami-mineru-rtx2080ti-deploy-record.md` | 首次部署的详细日志 |
| 解析脚本 | `/home/gx/mineru-parse.sh` | 远程调用 MinerU API |
| 测试结果 ZIP | `/home/gx/mineru-result-opentrek.zip` | 解析样例 |
