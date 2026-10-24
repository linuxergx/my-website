---
format: md
sidebar_position: 2
title: Hyper-V：GPU-PV 与固定 NAT 网络实战
---

# Hyper-V：GPU-PV 与固定 NAT 网络实战

---

#  Hyper-V Linux 虚拟机 GPU 半虚拟化 (GPU-PV) 实战与踩坑全纪录

## 0. 背景介绍

在 Windows 环境下进行深度学习或部署大模型（如 vLLM），WSL2 固然方便，但其高度集成的环境对于追求系统纯净度和底层控制权的开发者来说，往往显得过于黑盒且臃肿。

本文将带你实现在纯净的 **Hyper-V (Ubuntu 22.04) 虚拟机**中，通过 **GPU-PV (Paravirtualization)** 技术，直接调用 Windows 宿主机的 NVIDIA 显卡算力。这种方案性能损耗极低，环境极其纯净，且不需要在 Linux 内部安装容易引发冲突的原生显卡驱动。

## 1. 核心架构原理

GPU-PV 的逻辑不同于传统的 DDA（设备直通，PCIe Passthrough）。它不需要独占物理显卡，而是通过微软的 `dxgkrnl`（DirectX Graphics Kernel）作为桥梁，将宿主机的 GPU 资源切片分配给虚拟机：

1. **宿主机 (Windows)**：掌握物理硬件控制权，运行最新的 NVIDIA 原生驱动。
2. **虚拟机内核 (Linux)**：通过 `dxgkrnl` 内核模块与宿主机的 VMBus 进行跨系统底层通信。
3. **虚拟机用户态**：通过微软桥接库 (`libdxcore.so`)，将 Linux 侧的 CUDA 调用指令翻译并传递给宿主机。

## 2. 宿主机准备（Windows 侧）

> **💡 原理解析**：我们需要在 Windows 端主动切分一块显卡算力和显存（VRAM），并将其挂载到目标虚拟机上。

在 Windows 宿主机中，以**管理员身份**打开 PowerShell，执行以下脚本：

```
# 将 "YourVMName" 替换为你实际的虚拟机名称
$vm = "YourVMName"

# 1. 移除旧的分配（如果存在历史配置，可取消注释执行）
# Remove-VMGpuPartitionAdapter -VMName $vm

# 2. 添加 GPU 分区适配器
Add-VMGpuPartitionAdapter -VMName $vm

# 3. 设置显存分配参数 (参数单位为字节，此处配置为自适应)
Set-VMGpuPartitionAdapter -VMName $vm -MinPartitionVRAM 80000000 -MaxPartitionVRAM 100000000 -OptimalPartitionVRAM 100000000
```

## 3. 虚拟机底层基建（Linux 侧）

启动 Ubuntu 虚拟机，开始配置内核通信模块。这是万里长征的第一步。

### 3.1 升级内核版本（ExHyperV 兼容性预处理）

> **⚠️ 原因说明**：如果你使用 ExHyperV 管理工具，对于 Ubuntu 22.04，强烈推荐使用 HWE（硬件使能）内核 `6.8.0-87-generic` 或更新版本。官方兼容表明确指出，老旧的 `5.15` 内核在编译 `dxgkrnl` 模块时极易失败或发生不稳定崩溃。

```
# 更新系统包列表及现有软件
sudo apt update && sudo apt upgrade -y

# 安装 Ubuntu 22.04 的 HWE 内核
sudo apt install linux-generic-hwe-22.04 -y

# 重启使新内核生效
sudo reboot
```

### 3.2 编译并安装 dxgkrnl 内核模块

> **💡 原理解析**：标准的 Linux 内核不认识微软的虚拟化 GPU。我们利用社区脚本，从微软的 WSL2 内核源码中剥离出 `dxgkrnl` 驱动，并以 DKMS 的方式动态编译挂载到当前的 Ubuntu 内核中。

```
# 更新源并安装编译必备工具及内核头文件
sudo apt update
sudo apt install -y build-essential dkms linux-headers-$(uname -r) libglvnd0

# 使用社区维护的 dxgkrnl + NVIDIA 绑定方案
git clone [https://github.com/staralt/dxgkrnl-dkms.git](https://github.com/staralt/dxgkrnl-dkms.git)
cd dxgkrnl-dkms
sudo ./install.sh

# 手动触发加载模块
sudo modprobe dxgkrnl
```

**✅ 验证底层链路**：执行以下命令，如果能看到 `crw-rw-rw-` 开头的字符设备节点，说明 Linux 内核已经成功和 Windows 宿主机的显卡“握手”。

```
root@Virtual-Machine:~# ls -l /dev/dxg
crw-rw-rw- 1 root root 10, 263  5月 10 22:26 /dev/dxg
```

### 3.3 建立标准目录规范

> **💡 原理解析**：动态链接库冲突（Library Collision）是跨系统桥接的万恶之源。我们必须在 Linux 中建立严格的“隔离区”，区分微软的桥接库和 NVIDIA 的计算库。

```
sudo mkdir -p /usr/lib/wsl/lib      # 专用于存放微软的 DirectX 桥接库
sudo mkdir -p /usr/lib/wsl/drivers  # 专用于存放 NVIDIA 的原厂计算库
```

## 4. 驱动库跨系统物理映射（全流程核心）

> **⚠️ 核心红线**：由于我们走的是 GPU-PV 架构，Linux 虚拟机**绝对不能**安装任何 NVIDIA 原生驱动（严禁执行 `apt install nvidia-driver`）。硬件属于 Windows，我们只需要把 Windows 里的 API 库“借”过来即可。

### 4.1 搬运微软桥接库

1. 在 Windows 宿主机中，进入系统受保护目录：`C:\Windows\System32\lxss\lib`。

2. 复制该目录下的所有文件（核心文件为翻译官 `libdxcore.so`）。

3. 通过 SCP 等方式，将它们完整传进虚拟机的 `/usr/lib/wsl/lib/` 目录下。

4. 修复文件执行权限：

   ```
   sudo chmod 755 /usr/lib/wsl/lib/*
   ```

### 4.2 搬运 NVIDIA 原厂计算库 (🚨 极易踩坑)

1. 在 Windows 宿主机进入驱动仓库：`C:\Windows\System32\DriverStore\FileRepository\`。
2. **将文件夹按【修改时间】降序排列！** 寻找**最新生成**的、以 `nv_dispi.inf_amd64_`（或 `nvmdig.inf_amd64_`）开头的哈希文件夹。
3. 将整个文件夹原封不动地上传到虚拟机的 `/usr/lib/wsl/drivers/` 目录下。

## 5. 环境链接与终极测试

### 5.1 写入动态链接库配置

> **💡 原理解析**：我们需要告诉 Linux 系统的动态链接器（`ld`），在启动程序时，去哪里寻找我们刚刚手动搬运进来的库文件。

创建或修改 `/etc/ld.so.conf.d/ld.wsl.conf` 文件，写入以下两行路径： *(注意：第二行必须替换为你实际搬运的哈希文件夹名称)*

```
/usr/lib/wsl/lib
/usr/lib/wsl/drivers/nv_dispi.inf_amd64_67995ceab8993b08
```

保存后，刷新系统动态链接器缓存使之生效：

```
sudo ldconfig
```

### 5.2 终极验证测试

> **💡 原理解析**：闭源的 NVIDIA 驱动库内部写死了环境检测代码。如果它发现自己在虚拟机里，就会触发自我保护装死（报找不到驱动）。我们必须通过注入环境变量，伪装成合法的 WSL 容器环境来“骗”过它。

```
# 1. 安装基础依赖
sudo apt update && sudo apt install -y python3-pip

# 2. 安装 PyTorch 本体验证包
# (添加超时控制与禁用本地脏缓存，防止下载几百兆包时网络断流引发 Hash 不匹配)
pip3 install torch --no-cache-dir --default-timeout=1000

# 3. 注入伪装环境变量
export WSL_INTEROP=1
export WSL_VERSION=2

# 4. 执行终极调用
python3 -c "import torch; print('GPU 就绪:', torch.cuda.is_available()); print('设备名:', torch.cuda.get_device_name(0))"
```

如果终端输出 `GPU 就绪: True` 并成功打印出你的显卡型号，恭喜，底层基建全面竣工！

## 6. 避坑复盘 (SRE 排障视角)

在本次环境搭建中，我们遭遇并排除了几个非常经典的系统级深坑，记录如下：

### ❌ 坑 1：PyTorch 报错 `found version 11040` (驱动版本过低)

- **现象**：宿主机明明已经更新到了最新的 Game Ready 驱动 (如 596.x)，但 Linux 里 PyTorch 初始化时依然报错底层驱动太老（11040 即 CUDA 11.4 级别），导致 `is_available()` 返回 False。
- **根源**：在步骤 4.2 中，从 Windows 搬运驱动文件夹时，没有严格按照“最新修改时间”筛选，误拿了 Windows 历史残留的旧驱动库（“幽灵文件夹”）。
- **解法**：去宿主机重新定位最新的 `nv_dispi` 哈希目录。在 Linux 中 `rm -rf /usr/lib/wsl/drivers/*` 清空旧库后，重新传过去并执行 `ldconfig` 更新缓存。

### ❌ 坑 2：`nvidia-smi` 报错 `Failed to initialize NVML: N/A`

- **现象**：执行驱动目录下的 `nvidia-smi` 时，提示 NVML 初始化失败。
- **原理解析**：**这是架构决定的正常现象。** NVML (NVIDIA Management Library) 负责读取物理传感器（功耗、温度、风扇转速）。在 GPU-PV 的半虚拟化架构下，宿主机不会把物理传感器的控制权下放给虚拟机。这**完全不影响** CUDA 算力的满血调用，请直接以 PyTorch 的测试结果为准。

### ❌ 坑 3：库路径污染导致找不到 `libdxcore.so`

- **现象**：通过 `strace` 追踪调用时，发现系统返回 `-1 ENOENT` 找不到 `libdxcore.so`，导致硬件链路断裂。
- **根源**：在前期摸索阶段，如果将 `libnvidia-ml.so` 等原厂库散装扔进了 `/usr/lib/wsl/lib` 目录下，会导致严重的动态链接库冲突。
- **解法**：严格遵守目录纯净度红线。`/usr/lib/wsl/lib` **只放**微软桥接库，NVIDIA 所有库**必须**锁死在 `drivers/` 目录下的专属哈希文件夹里。

## 7. 结语

完成上述操作后，你获得了一个毫无系统冗余、性能损耗可忽略不计的硬核 AI 推理底座。后续无论是跑 vLLM 还是其他大模型框架，都能彻底释放本地算力。

*(注：在使用 vLLM 时，建议添加 `--gpu-memory-utilization 0.8` 参数，为宿主机的 UI 渲染预留一部分显存缓冲，防止 OOM 崩溃。)*

---

### 手动创建带固定 NAT 的内部交换机

如果你的宿主机环境限制严格（比如公司网络禁用未注册 MAC 地址），或者你想让虚拟机在一个完全独立的固定网段里，你需要手动建一个静态的 NAT 网络。

**第 1 步：创建内部交换机**

1. 在 Windows 中以**管理员身份运行 PowerShell**。

2. 创建一个新的内部交换机（名称设为 `MyNAT`）：

   

   ```powershell
   New-VMSwitch -SwitchName "MyNAT" -SwitchType Internal
   ```

**第 2 步：配置宿主机的固定网关和 NAT 规则**

1. 为这个新交换机分配一个固定的网关 IP（例如 `192.168.200.1`）：

   

   ```powershell
   New-NetIPAddress -IPAddress 192.168.200.1 -PrefixLength 24 -InterfaceAlias "vEthernet (MyNAT)"
   ```

2. 创建 NAT 规则，将该网段（`192.168.200.0/24`）的流量转发出去：

   

   ```powershell
   New-NetNat -Name "MyNATNetwork" -InternalIPInterfaceAddressPrefix 192.168.200.0/24
   ```

**第 3 步：配置虚拟机**

1. 在 Hyper-V 管理器中，将 Ubuntu 虚拟机的网络适配器修改为新创建的 `MyNAT`。
2. 进入 Ubuntu 系统，你需要手动将网络配置为静态 IP：
   - IP 地址：`192.168.200.2` (到 254 之间任选)
   - 子网掩码：`255.255.255.0`
   - 网关：`192.168.200.1`
   - DNS：`8.8.8.8` 或其他可用 DNS。 这样设置后，Ubuntu 的 IP 将被永久固定在这个子网中。

**如果你需要虚拟机和宿主机之间互通（可选操作）：** 你可以通过 PowerShell 将这个虚拟网卡的网络类型强制修改为“专用（Private）”，这样可以放宽防火墙限制。在管理员身份的 PowerShell 中运行：

PowerShell

```
Set-NetConnectionProfile -InterfaceAlias "vEthernet (MyNAT)" -NetworkCategory Private
```







不要手动修改新新创建的虚拟网卡 这块 `vEthernet (MyNAT)` 虚拟网卡，**它自己本身就是网关**。 这个 NAT 网络拓扑里，你的 Windows 宿主机扮演的是“路由器”的角色，而这块虚拟网卡就是路由器朝向虚拟机内部的“接口”。

如果你给这个虚拟网卡再配一个网关，Windows 系统的全局路由表就会瞬间混乱。系统可能会误以为这条虚拟网络是一条可以通向真实互联网的出口，从而把宿主机正常的上网流量错误地引流到这个根本出不去的死胡同里，结果就是**你的 Windows 宿主机会直接断网**。
