---
format: md
sidebar_position: 2
title: K8s 故障排查：conntrack-tools 缺失
---

# K8s 故障排查案例：conntrack-tools 缺失导致的网络问题

## 一、故障背景（Situation）

### 场景描述
当时我们有一个生产环境的 Kubernetes 集群，大约有 20 多个节点，运行着几十个微服务。某天早上监控报警，说集群内部的服务发现出现了异常，很多 Pod 之间的调用开始超时。

### 初步现象
- 部分 Pod 无法通过 Service DNS 名称解析到其他服务
- 一些跨节点的 Pod 间通信出现间歇性失败
- 监控系统显示大量连接超时错误

---

## 二、任务目标（Task）

快速定位问题根因并恢复服务。由于影响范围较大，需要尽快止血，同时找到根本原因避免复发。

---

## 三、排查过程（Action）

### 第一步：快速止损和范围确认

先确认了问题的影响范围——不是所有服务都受影响，而是集中在某些节点上的 Pod。这排除了全局性的问题，比如 etcd 故障或者控制平面崩溃。

### 第二步：分层排查

按照从上层到下层的顺序进行排查：

#### 1. DNS 层
在问题 Pod 中执行 `nslookup`，发现确实无法解析 Service 名称，返回的是 DNS 查询超时。

```bash
kubectl run -it --rm --restart=Never dns-test \
  --image=busybox -- nslookup kubernetes.default.svc.cluster.local
;; connection timed out; no servers could be reached
```

#### 2. CoreDNS 检查
查看 CoreDNS Pod 状态正常，日志也没有明显错误。

```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns
```

#### 3. kube-proxy 检查
这时候注意到 kube-proxy 的日志里有一些关键错误：

```
Jul 6 01:05:50 k8s-node01-21 kube-proxy: 
E0706 01:05:50.056241 proxier.go:746] "Failed to delete endpoint connections" 
err="error deleting conntrack entries for udp peer {10.0.0.2, 172.17.65.13}, 
error: error looking for path of conntrack: 
exec: \"conntrack\": executable file not found in $PATH" 
servicePortName="kube-system/kube-dns:dns"
```

### 第三步：定位根因

这个错误信息非常关键——它说明 `kube-proxy` 在执行 iptables 规则更新时，需要调用 `conntrack` 工具来清理旧连接，但是节点上根本没有安装这个工具。

**进一步分析：**
- 这是因为集群部署时，运维同学只安装了 Kubernetes 的核心组件，但遗漏了 `conntrack-tools` 这个依赖包
- 在某些版本的 kube-proxy 中，这个依赖是隐式要求的
- 当 Service Endpoint 变更时（比如 Pod IP 变化），如果旧连接没有被正确清理，新的请求可能会被路由到已经不存在的 Pod

### 第四步：修复验证

在受影响的节点上安装 `conntrack-tools`：

```bash
# CentOS/RHEL/Fedora
yum install -y conntrack-tools

# Ubuntu/Debian
apt-get install -y conntrack
```

然后重启 kube-proxy Pod，让它重新加载配置：

```bash
kubectl delete pod -n kube-system -l k8s-app=kube-proxy
```

之后观察日志，错误不再出现，DNS 解析和服务调用也恢复正常。

---

## 四、解决结果（Result）

### 恢复情况
整个故障从发现到恢复大概用了 30 分钟左右。

### 后续改进措施

1. **补充文档**：将 `conntrack-tools` 列为 K8s 节点的标准依赖，写入部署手册。

2. **自动化检查**：在 CI/CD 流程中加入节点依赖检查脚本，确保新节点部署时不会遗漏。

3. **监控增强**：为 kube-proxy 的错误日志添加告警规则，下次类似问题可以更早发现。

---

## 五、总结反思

### 核心收获

1. **不要只看表面现象**：DNS 解析失败只是表象，真正的根因在更底层的网络组件依赖。

2. **善用日志线索**：kube-proxy 的错误日志虽然不起眼，但直接指向了问题核心。

3. **依赖管理很重要**：很多故障源于"看不见的依赖"，需要在部署阶段就做好检查和验证。

### 正确的排查思路

```
发现问题 → 确认范围 → 分层排查（应用→Service→DNS→网络→内核）→ 定位根因 → 修复验证 → 复盘改进
```

---

## 六、附录：相关命令速查

### 检查 conntrack 工具是否安装
```bash
which conntrack
conntrack --version
```

### 检查内核 conntrack 模块
```bash
lsmod | grep conntrack
modprobe nf_conntrack
```

### 查看连接跟踪表
```bash
conntrack -L
cat /proc/net/nf_conntrack | wc -l
```

### 检查 kube-proxy 日志
```bash
kubectl logs -n kube-system -l k8s-app=kube-proxy | grep conntrack
```

### 安装 conntrack-tools
```bash
# CentOS/RHEL
yum install -y conntrack-tools

# Ubuntu/Debian
apt-get install -y conntrack
