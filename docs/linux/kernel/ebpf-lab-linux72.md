---
format: md
sidebar_position: 2
title: Linux 7.2 + eBPF 实验场构建指南
---

#  Linux 7.2 + eBPF 实验场构建全景实战指南

本指南详细记录了从“澄清内核与用户态的基本概念”开始，直至成功构建一个支持 **CO-RE (一次编译到处运行)**、**BTF 符号表**、**LSM 动态防御** 的超轻量级 eBPF 战斗内核的完整工程全貌。

> 作者已经尝试用linux默认内核+ busybox编译了一个系统.

## 一、 理清核心概念与认知误区

在正式动手前，必须厘清以下三个关于 Linux 内核与用户态的底层逻辑：

### 1. 宿主机内核 vs 虚拟机内核

- **疑问**：为什么我编译后的虚拟机内核是 7.2 版本，而宿主机 Ubuntu 是 5.x 版本？
- **核心原理**：**两者完全独立**。宿主机（Ubuntu）的内核负责驱动你的物理硬件，并为 QEMU 提供虚拟化支持。而我下载的 `linux-7.2.tar.xz` 源码，是通过交叉编译工具链最终生成的一个独立的内核镜像文件（`bzImage`）。QEMU 虚拟机启动时，加载的是这个 7.2 的内核。因此，虚拟机内跑什么版本，完全由你下载并编译的内核源码决定，与宿主机内核版本无关。

### 2. eBPF 编译对内核版本的依赖

- **疑问**：eBPF 的编译需要什么内核版本？是不是用我下载的最新的 linux 内核里的版本就行？
- **核心原理**：是的。虽然 eBPF 技术在 Linux 3.15 就初具雏形，但现代 eBPF 的高级特性（如 **CO-RE 一次编译到处运行**、**BPF LSM 安全阻断**、**Ring Buffer**）要求内核版本至少在 **5.4 以上**，且强烈建议使用 5.10+ 或更高的主线内核。你所选用的 **Linux 7.2 内核** 完美原生支持现代 eBPF 的所有顶级超能力。

### 3. BusyBox 中的 `rcS` 是什么？

- **核心原理**：`rcS` 是 BusyBox 初始化系统（`init`）在开机时读取的核心**初始化 Shell 脚本**（通常位于 `/etc/init.d/rcS`）。它类似于传统大系统中的 systemd 或 sysvinit，负责开机时最基础的挂载（如执行 `mount -a` 挂载 `/etc/fstab` 中的设备）、配置网络、启动后台服务等脏活累活。

## 二、 宿主机 BPF 兵工厂工具链配置

在编译内核和后续开发 BPF 程序前，必须先在宿主机（Ubuntu）上把所有的编译器、符号提取工具和依赖库全部安装到位。

### 1. 安装核心编译与高级调试依赖

执行以下命令安装现代 eBPF 开发的核心工具链：

`sudo apt-get updatesudo apt-get install -y clang llvm libelf-dev dwarves`

- **clang & llvm**：GCC 无法编译出 BPF 字节码，必须使用 Clang 将 C 语言代码编译为 `target bpf` 的原生目标文件。
- **libelf-dev**：用户态加载库（Libbpf）在解析和加载 BPF ELF 对象文件时必须依赖的底层库。
- **dwarves (极其关键)**：**它是开启内核 BTF（BPF Type Format）的先决条件！** 该包内包含了一个神级工具 `pahole`。`pahole` 的作用是在内核编译的最后阶段，疯狂扫描 GCC 生成的臃肿的 DWARF 调试符号，并将其精简、压缩转换成内核原生能看懂的 BTF 符号表。

## 三、 内核配置神技：`make menuconfig` 搜索与快捷方式

在面对几万个配置项的内核选项时，肉眼去菜单里一层层找配置是低效且痛苦的。

### 💡 核心神技：使用 `/` 进行全局搜索

在 `make menuconfig` 的蓝屏界面中，直接按下键盘上的 **/ 键（斜杠）**，会弹出一个搜索框：

1. **输入关键字**：例如输入 `BPF_SYSCALL` 并回车。
2. **查看搜索结果**：搜索结果会清晰地展示：
   - 该配置项当前的开关状态（`[=y]` 或 `[=n]`）。
   - 它的**物理菜单路径**（Location），例如：`-> General setup -> BPF subsystem`。
   - 它的**依赖条件**（Depends on），如果依赖条件没满足，这个配置项在菜单里会直接**隐藏**。
3. **快捷跳转**：在搜索结果界面的左侧，通常会看到带有数字的快捷键（如 `(1)`）。直接在键盘上按下对应的数字键，**菜单会自动带你瞬间穿梭跳转到该配置项所在的物理位置**，极其高效！然后按下空格键就可以选中了。

## 四、 eBPF内核配置与硬核踩坑排查

为了释放 eBPF 的全部魔力，我们需要在 `make menuconfig` 中强制开启以下核心参数。

### 1. 核心参数开启清单

通过 `/` 搜索并跳转，确保以下参数全部勾选为 `[*]` (y)：

- `CONFIG_BPF=y` & `CONFIG_BPF_SYSCALL=y` （开启 BPF 核心总线与系统调用）
- `CONFIG_BPF_JIT=y` & `CONFIG_BPF_JIT_ALWAYS_ON=y` （开启 JIT 硬件级机器码翻译引擎，放弃解释器）
- `CONFIG_DEBUG_INFO=y` （开启内核调试符号，BTF 的原材料）
- `CONFIG_DEBUG_INFO_BTF=y` （**灵魂选项**：开启内核高清全景数据结构图纸）
- `CONFIG_BPF_LSM=y` （开启 LSM 安全模块对 BPF 钩子的支持）

### 🚨 经典故障排查：为什么在菜单里找不到 `CONFIG_DEBUG_INFO_BTF`？

#### 🧱 故障现象：

在 `menuconfig` 里翻遍了菜单，或者用 `/` 搜索 `DEBUG_INFO_BTF` 时，发现它的状态死活是 `[=n]`，而且前面没有勾选框，根本无法强开。

#### 🔍 根本原因与原理：

仔细观察搜索结果中的 `Depends on:` 提示，你会发现它强关联了两个条件：

1. `CONFIG_DEBUG_INFO [=y]` （必须先开启基础调试信息）。
2. **PAHOLE_VERSION >= 116**。如果宿主机系统里没有 `pahole` 工具，或者 `pahole` 版本过低，内核编译系统会认为当前环境**无法生成 BTF 符号**，从而强行在菜单中把这个选项**隐藏或锁定为不可选**。

#### 🛠️ 解决方案：

退出 `menuconfig`，在宿主机上老老实实执行命令安装 `dwarves` 包（内含现代 `pahole`）：

Bash`sudo apt-get install -y dwarves`

安装完成后，重新进入 `make menuconfig`，再次搜索 `DEBUG_INFO_BTF`，你会发现勾选框神奇地解封了！



##### 核对与检验

```bash
root@ebpf:~/linux_test/linux# grep -E "CONFIG_BPF_SYSCALL|CONFIG_DEBUG_INFO_BTF|CONFIG_BPF_JIT|CONFIG_BPF_LSM" .config

CONFIG_BPF_SYSCALL=y

CONFIG_BPF_JIT=y

CONFIG_BPF_JIT_ALWAYS_ON=y

CONFIG_BPF_JIT_DEFAULT_ON=y

CONFIG_BPF_LSM=y

CONFIG_DEBUG_INFO_BTF=y

CONFIG_DEBUG_INFO_BTF_MODULES=y 


```

##### 启动阶段

```bash
qemu-system-x86_64 \
    -kernel linux/arch/x86/boot/bzImage \
    -hda disk.img \
    -append "root=/dev/sda rw console=ttyS0 lsm=lockdown,capability,landlock,bpf" \
    -nographic
```



## 五、 内核编译与物理膨胀原理

配置完成后，保存为 `.config`，在宿主机启动多核编译：

Bash`make -j$(nproc)`

### 📊 内核体积“膨胀”之谜

编译完成后，你会发现最终在 `arch/x86/boot/bzImage` 生成的内核镜像体积达到了惊人的 **17MB** 左右。而如果跑官方默认的 `make defconfig`，体积通常只有 **7MB ~ 9MB**。

#### 为什么多出了将近 9MB 的体积？

1. **BTF 符号表物理加料**：开启 `CONFIG_DEBUG_INFO_BTF=y` 后，内核会把系统里几十万个结构体、函数和全局变量的名称、大小、成员偏移量等“官方说明书”全部打包压缩，**死死地固化在内核镜像的一个特殊区域（Section）里**。
2. **DWARF 残留**：为了转换出 BTF，编译器在中间阶段保留了极其臃肿的调试基线，导致最终压缩的 `bzImage` 依然残存了大量符号元数据。
3. **物超所值的技术代价**：这多出来的体积，换来的是内核 100% 的透明度（eBPF 程序可以动态识别任意内核结构，实现 **CO-RE 一次编译到处运行**）以及底层的原生硬件加速（JIT Always On）。

## 六、 虚拟机文件系统配置与开机自检

内核编译完成后，我们使用 BusyBox 构建了虚拟机的最小文件系统，并将其烧录进 `disk.img`。但在实际进入 QEMU 虚拟机后，发生了一系列关于挂载的博弈。

### 1. 虚拟机开机初验的困惑

进入虚拟机后，执行查看命令：

```bash
~ # ls -la /sys/fs/bpftotal 0dr-xr-xr-x    2 0        0                0 Jul 16 17:07 .drwxr-xr-x    8 0        0                0 Jul 16 17:07 ..
```

- **现象**：里面只有 `.` 和 `..` 两个隐藏目录，`total 0`。
- **原理澄清**：**这完全正常！** 因为 `/sys/fs/bpf` 挂载的是一个**虚拟内存文件系统（bpffs）**。此时由于你刚开机，还没有运行任何 BPF 程序，没有向里面 Pin（固定）任何数据通道，所以它自然是空的。

### 2. 遭遇 `mount | grep bpf` 无输出故障

为了验证 bpffs 是否真的挂载成功，在虚拟机执行：

`~ # mount | grep bpf~ # `

#### 🧱 故障现象：

没有任何输出，说明 BPF 虚拟文件系统**根本没有挂载上**。

#### 🔍 原因分析：

虽然我们在内核里开启了支持，且在硬盘里创建了 `/sys/fs/bpf` 这个空的挂载点（插座），但 BusyBox 的系统初始化脚本（`rcS`）在执行 `mount -a` 时，只会去读取 `/etc/fstab` 配置文件。如果里面没写，内核是不会主动把数据插上这个插座的。

#### 🛠️ 终极解决方案：

**步骤一：在虚拟机内手动拉一把进行紧急挂载与验证**

Bash`# 1. 手动将 bpffs 挂载到指定挂载点mount -t bpf none /sys/fs/bpf# 2. 再次验证挂载关系mount | grep bpf`

**🔬 预期正确输出：**

Plaintext`none on /sys/fs/bpf type bpf (rw,relatime)`

看到 `type bpf`，说明 BPF 文件系统彻底现出原形。

**步骤二：宿主机一劳永逸持久化配置（写入 fstab）**

为了让虚拟机每次开机都自动挂载，必须修改虚拟机的 `/etc/fstab`。但由于我们在运行 QEMU 前执行了 `sudo umount mnt` 确保安全，宿主机的 `mnt` 此时是空的。必须在宿主机重新挂载并追加配置：

> **⚠️ 铁律警示**：绝对不能在宿主机挂载 `disk.img` 的同时运行 QEMU 虚拟机，否则两边同时写会导致 ext4 文件系统彻底损坏！

Bash`cd ~/linux_test# 1. 确保虚拟机关闭，重新挂载虚拟硬盘到宿主机 mntsudo mount disk.img mnt# 2. 使用 tee 追加自动挂载三驾马车规则到 fstabecho 'none   /sys/fs/bpf   bpf     defaults        0       0' | sudo tee -a mnt/etc/fstab# 3. 检查写入结果cat mnt/etc/fstab`

**🔬 预期正确输出：**

Plaintext`proc   /proc   proc   defaultssysfs  /sys    sysfs  defaultsnone   /sys/fs/bpf   bpf     defaults        0       0`

修改完成后，安全卸载：

Bash`sudo umount mnt`

### 3. 为什么 `df -h` 查不到 `/sys/fs/bpf`？

重新启动 QEMU 虚拟机，在系统内执行 `mount -a`（此时会弹出一行 `mount used greatest stack depth...` 的内核 hacking 调试信息，属于正常 log，无视即可）。

接着执行磁盘查验：

Bash`~ # df -hFilesystem                Size      Used Available Use% Mounted on/dev/root                56.0M      2.6M     48.9M   5% /devtmpfs                 37.8M         0     37.8M   0% /dev`

- **现象**：`df -h` 里依然找不到 `/sys/fs/bpf`、`/proc` 和 `/sys`。
- **物理原理**：**因为 df (Disk Free) 只负责统计基于真实物理块设备的磁盘文件系统（如 ext4）。** 而 `proc`、`sysfs`、`bpffs` 全都是**虚拟伪文件系统（Pseudo Filesystems）**，它们的数据直接驻留在内核内存里，不占用磁盘扇区，因此被 `df` 自动过滤。
- **正确验尸命令**：直接输入 `mount` 或者 `cat /proc/mounts`，即可清清楚楚地看到这三大内存守护神老老实实地各就各位。

## 七、 宏观战略：eBPF 与可观测性及商业化

### 1. 为什么 eBPF 是长链路变慢排查的“降维打击”武器？

在微服务长链路中，业务抱怨变慢时，传统监控（APM）需要侵入代码打点。而 eBPF 通过内核层实现了**无侵入的纵向与横向串联**：

- **横向（跨服务）**：eBPF 在内核网络协议栈（TC/Socket）直接拦截 TCP 流量，动态解析或注入 Trace ID，逆向还原微服务拓扑。
- **纵向（跨层级）**：通过同一个请求的上下文，eBPF 能把“用户态业务耗时 ➡️ 系统调用 `openat` 耗时 ➡️ 内核 VFS 锁等待 ➡️ 底层磁盘 I/O 延迟”一条龙串联起来。
- **性能定位**：利用 `perf_event` 触发内核堆栈周期性采样，能直接生成无死角的**火焰图（Flame Graph）**，一眼揪出拖慢链路的“平顶山”函数。
- **前置条件**：像 **Apache SkyWalking (Rover)**、**Cilium (Tetragon)** 这样顶级的开源监控与安全阻断工具，其底层必须依赖我们上述在内核中开启的 **BTF 符号支持** 和 **LSM 钩子** 才能正常运转。

### 2. 定制系统与商业化落地路径

如果你未来为企业定制这种高安全、轻量级的专用操作系统（Appliance OS）：

- **商业价值**：通过 `menuconfig` 极端裁剪掉无用驱动与工具，大幅缩小攻击面（极致安全），降低硬件开销并实现毫秒级启动（边缘计算/Serverless）。
- **稳定性保障**：必须引入 **LTP (Linux Test Project)** 进行数百小时的高并发与死锁极限压测；配置 **Kdump** 以便在 Kernel Panic 时留存编译尸体（`vmcore`）供 `crash` 工具分析。
- **交付流水线**：不能靠人工敲命令，必须借助 **Buildroot** 或 **Yocto Project** 实现声明式、自动化的 OS 构建物料流水线，并具备长期的 LTS 内核热补丁（`kpatch`）漏洞修复维护能力。

## 八、 总结与下一步行动

至此，你的 **Linux 7.2 顶级 eBPF 内核实验场** 已经完全通过了物理挂载与符号支持的终极自检。底层的地基已经稳固如磐石。

**下一阶段实战**：我们将回到宿主机，在新建的工作目录下正式编写内核态 BPF 源码 `hello.bpf.c`，利用 Clang 编译出我们的第一颗 eBPF 监控导弹，然后送入虚拟机内发射！
