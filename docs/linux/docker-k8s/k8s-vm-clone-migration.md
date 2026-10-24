---
format: md
sidebar_position: 3
title: Kubernetes 虚拟机环境克隆与资源迁移全指南
---

# Kubernetes 虚拟机环境克隆与资源迁移全指南

> **适用人群**：K8s 运维工程师、DevOps 工程师、后端开发（需要搭建测试环境）  
> **文档版本**：v1.1  
> **最后更新**：2026-04-21

---

## 📌 应用场景（必读）

这份文档解决的是**真实生产环境中的 K8s 集群迁移问题**，不是理论教程。以下是实际使用场景：

### 场景一：服务器硬件故障后的灾备恢复
**情况**：生产环境的 master 节点硬盘损坏或整机宕机，无法启动。 
**做法**：准备一台新服务器，按照文档步骤恢复证书和配置，重建集群。 
**价值**：避免重新生成证书导致所有客户端证书失效，业务可以无缝切换。

### 场景二：机房搬迁或云厂商切换
**情况**：公司决定从自建机房迁移到阿里云/腾讯云，或者从 AWS 迁移到 Azure。 
**做法**：在新云厂商的机器上按照文档重建 K8s 集群，迁移应用和服务。 
**价值**：保持集群配置一致性，减少迁移过程中的服务中断时间。

### 场景三：测试环境快速复制
**情况**：开发团队需要在本地或测试机上快速复制一份和生产环境配置一致的 K8s 集群。 
**做法**：备份生产集群的证书和配置，在测试机上恢复并导入应用资源。 
**价值**：确保测试环境和生产环境配置一致，减少"在我机器上是好的"这类问题。

### 场景四：K8s 版本升级
**情况**：需要将 K8s 从 v1.25 升级到 v1.28，但直接 upgrade 风险太大。 
**做法**：在新机器上按文档搭建新版本集群，迁移应用后逐步切流。 
**价值**：降低升级风险，旧集群可以作为回滚预案保留一段时间。

### 场景五：多环境一致性保障
**情况**：开发、测试、预发、生产多个环境需要保持一致的 K8s 配置。 

**做法**：以生产环境为基准，按照文档克隆配置到其他环境。 

**价值**：各环境行为一致，减少因配置差异导致的线上问题。

---

## ⚠️ 重要提醒

1. **生产环境慎用 `--ignore-preflight-errors=all`** - 这个参数适合测试环境，生产环境建议去掉让 kubeadm 自动检查环境
2. **证书是核心资产** - 备份的证书文件包含集群的私钥，一旦泄露相当于掌握了整个集群的控制权，必须妥善保管
3. **存储数据要单独处理** - PV/PVC 涉及底层存储数据，不能简单拷贝 YAML，需要确保数据已迁移到新环境
4. **网段规划要提前确认** - Pod 网段和服务网段如果冲突会导致网络不通，迁移前务必确认新环境的网段规划

---

## 目录

- [一、证书与认证：6 组核心资产备份](#一证书与认证 6 组核心资产备份)
- [二、节点适配与 kubeadm-config.yaml 生成](#二节点适配与-kubeadm-configyaml-生成)
- [三、镜像预拉取与集群初始化](#三镜像预拉取与集群初始化)
- [四、Worker 节点加入集群](#四 worker 节点加入集群)
- [五、应用资源迁移](#五应用资源迁移)
- [六、常见问题与解决方案](#六常见问题与解决方案)
- [七、完整操作清单](#七完整操作清单)

---

## 一、证书与认证：6 组核心资产备份

### 原理说明

Kubernetes 各组件间通过双向 TLS（mTLS）通信。`kubeadm` 在初始化时会检查 `/etc/kubernetes/pki` 目录。如果提前放入这 6 组证书，新集群将沿用旧集群的 CA 根，从而保持认证体系的一致性。

### 1.1 源集群：备份证书

在**源集群**的 master 节点上执行：

```bash
# 创建备份目录
mkdir -p /root/k8s-backup/pki/etcd

# 备份 6 组核心证书
cp /etc/kubernetes/pki/ca.{crt,key} /root/k8s-backup/pki/                    # 1. 集群根 CA
cp /etc/kubernetes/pki/front-proxy-ca.{crt,key} /root/k8s-backup/pki/       # 2. 代理 CA (用于 API Aggregation)
cp /etc/kubernetes/pki/sa.{pub,key} /root/k8s-backup/pki/                   # 3. ServiceAccount 签名密钥对
cp /etc/kubernetes/pki/etcd/ca.{crt,key} /root/k8s-backup/pki/etcd/         # 4. ETCD 根 CA
cp /etc/kubernetes/pki/apiserver-etcd-client.{crt,key} /root/k8s-backup/pki/ # 5. API Server 访问 ETCD 的客户端证书
cp /etc/kubernetes/pki/apiserver-kubelet-client.{crt,key} /root/k8s-backup/pki/ # 6. API Server 访问 Kubelet 的客户端证书

# 打包备份文件
tar -czf /root/k8s-backup/pki-backup.tar.gz -C /root k8s-backup
```

### 1.2 目标集群：恢复证书

在**新集群**的 master 节点上执行：

```bash
# 上传备份文件到新机器（使用 scp 或其他工具）
scp root@source-node:/root/k8s-backup/pki-backup.tar.gz /tmp/

# 解压到正确位置
mkdir -p /etc/kubernetes/pki/etcd
tar -xzf /tmp/pki-backup.tar.gz -C /
rm /tmp/pki-backup.tar.gz

# 设置正确的权限
chmod 600 /etc/kubernetes/pki/*.key
chmod 644 /etc/kubernetes/pki/*.crt
```

> **⚠️ 注意事项**：
> - 确保新旧集群的 Kubernetes 版本一致或兼容
> - 证书备份后应妥善保管，避免泄露
> - 如果只需要快速搭建测试环境，可以跳过此步骤，让 kubeadm 重新生成证书

---

## 二、节点适配与 kubeadm-config.yaml 生成

### 2.1 修改节点标识（Hostname）

**坑点**：Kubernetes 证书会绑定节点名。如果新旧环境 Hostname 不一致，Kubelet 认证会失败。

```bash
# 设置新的 hostname（根据实际规划修改）
hostnamectl set-hostname k8s-master1

# 刷新 /etc/hosts 映射
echo "$(hostname -I | awk '{print $1}') $(hostname)" >> /etc/hosts

# 验证 hostname 是否生效
hostname
```

### 2.2 生成与定制化配置文件

**操作**：生成默认配置并根据物理环境修改。

```bash
# 生成默认配置
kubeadm config print init-defaults > kubeadm-config.yaml

# 编辑配置文件
vi kubeadm-config.yaml
```

**具体修改逻辑**：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `nodeRegistration.criSocket` | CRI 适配器 | Containerd: `/run/containerd/containerd.sock`<br>Docker: `/var/run/cri-dockerd.sock` |
| `networking.podSubnet` | Pod 网段（必须与 CNI 插件一致） | `10.244.0.0/16` (Calico)<br>`10.244.0.0/24` (Flannel) |
| `nodeRegistration.name` | 节点名称（必须与 hostname 严格一致） | `k8s-master1` |
| `imageRepository` | 镜像仓库地址（国内环境必填） | `registry.cn-hangzhou.aliyuncs.com/google_containers` |

**完整配置示例（带详细注释）**：

```yaml
# ================== Kubeadm ClusterConfiguration ==================
# 这是 kubeadm init 的主配置文件，控制整个集群的初始化参数
apiVersion: kubeadm.k8s.io/v1beta3
kind: ClusterConfiguration

# Kubernetes 版本号，必须与所有节点上安装的 kubeadm 版本兼容
kubernetesVersion: v1.28.0

# 控制平面端点（可选）
# 如果使用负载均衡器（如 keepalived+haproxy），这里填 LB 的 VIP
# 单节点集群可以省略或填 master 节点的 IP
controlPlaneEndpoint: "192.168.1.100:6443"

# 网络配置部分
networking:
  # Pod 网段 - 所有 Pod 的 IP 地址范围
  # 必须与后续安装的 CNI 插件（如 Calico/Flannel）配置一致
  # Calico 默认使用 10.244.0.0/16
  # Flannel 默认使用 10.244.0.0/16
  podSubnet: "10.244.0.0/16"
  
  # Service 网段 - 所有 Service ClusterIP 的地址范围
  # 这个网段不能和物理网络冲突，也不能和 podSubnet 重叠
  serviceSubnet: "10.96.0.0/12"

# API Server 配置
apiServer:
  # 额外参数，会传递给 kube-apiserver
  extraArgs:
    # 授权模式：Node 代表 Kubelet 提交的请求用 Node 身份验证，RBAC 代表基于角色的访问控制
    authorization-mode: "Node,RBAC"
    # API Server 超时设置
    timeoutForControlPlane: "4m0s"

# Controller Manager 配置
controllerManager:
  extraArgs:
    # FlexVolume 插件目录（用于云厂商的卷插件）
    flex-volume-plugin-dir: "/kubernetes/cloud-provider-volumes/external"
  # 主机挂载卷配置
  extraVolumes:
    - name: flexvolume
      hostPath: /kubernetes/cloud-provider-volumes/external
      mountPath: /kubernetes/cloud-provider-volumes/external
      readOnly: false
      pathType: DirectoryOrCreate

# Scheduler 配置（空对象表示使用默认配置）
scheduler: {}

# 节点注册配置 - 所有节点都会用到这部分配置
nodeRegistration:
  # CRI Socket - 容器运行时接口 socket 路径
  # containerd: /run/containerd/containerd.sock
  # docker: /var/run/docker.sock
  # cri-dockerd: /var/run/cri-dockerd.sock
  criSocket: "/run/containerd/containerd.sock"
  
  # 节点名称 - 必须与 hostname 完全一致，否则证书认证会失败
  name: "k8s-master1"
  
  # 节点污点 - 默认为 master 节点添加 NoSchedule 污点，阻止普通 Pod 调度到 master
  # 如果想让 master 也能运行 Pod，可以设为 null 或删除此字段
  taints: null

---
# ================== KubeletConfiguration ==================
# 这是 kubelet 的独立配置文件，通过 --config 参数传递给 kubelet
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration

# Cgroup 驱动方式 - 必须与 containerd/docker 的配置一致
# containerd 和 docker 都使用 systemd cgroup driver
cgroupDriver: systemd

# DNS 服务器 IP - 通常是 serviceSubnet 中的第一个 IP
# CoreDNS 默认会分配 10.96.0.10
clusterDNS:
  - 10.96.0.10

# 集群域名 - 所有服务内部使用的域名后缀
clusterDomain: cluster.local
```

---

## 三、镜像预拉取与集群初始化

### 3.1 镜像预拉取（Pre-pull）

在执行 `kubeadm init` 之前，建议先手动把 Kubernetes 组件所需的容器镜像拉取到本地。

**原因**：
- 这些镜像默认在 `registry.k8s.io`（国外镜像源），下载速度可能非常慢
- 如果下载超时，`kubeadm init` 会直接报错失败
- 预拉取可以将"下载"和"配置"解耦，下载失败可以重试，不影响初始化逻辑

**操作步骤**：

```bash
# 查看需要拉取的镜像列表
kubeadm config images list

# 指定国内镜像源拉取镜像
kubeadm config images pull --image-repository registry.cn-hangzhou.aliyuncs.com/google_containers

# 或者使用其他国内镜像源
# 腾讯云：registry.tencentyun.com/google_containers
# 阿里云：registry.cn-hangzhou.aliyuncs.com/google_containers
# 网易云：hub.163.com/library-images/k8s.gcr.io
```

**需要拉取的核心镜像**：

| 镜像 | 作用 |
|------|------|
| `kube-apiserver` | 集群大脑，API 服务入口 |
| `kube-controller-manager` | 负责集群状态一致性 |
| `kube-scheduler` | 负责 Pod 调度 |
| `kube-proxy` | 负责网络转发规则 |
| `etcd` | 键值对数据库（集群数据存储） |
| `pause` | Pod 容器的沙盒父容器（非常重要） |
| `coredns` | 负责集群内部域名解析 |

### 3.2 执行集群初始化

```bash
# 执行初始化（忽略预检错误，适合测试环境）
kubeadm init --config=kubeadm-config.yaml --ignore-preflight-errors=all

# 生产环境建议去掉 --ignore-preflight-errors=all，让 kubeadm 自动检查环境
# kubeadm init --config=kubeadm-config.yaml
```

**初始化成功后，执行以下命令配置 kubectl**：

```bash
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# 或者当前用户
# cp /etc/kubernetes/admin.conf ~/.kube/config
# chown $(whoami):$(whoami) ~/.kube/config
```

### 3.3 修正已运行集群的 kubeadm-config

**踩坑记录**：如果初始化后发现 Calico 无法获取 Pod 网段，需要手动修改集群内的 ConfigMap。

```bash
# 编辑 ConfigMap
kubectl edit cm kubeadm-config -n kube-system

# 在 data -> Configuration 中添加或修改 podSubnet
podSubnet: "10.244.0.0/16"
```

**原理**：虽然提供了 `kubeadm-config.yaml` 文件，但 `kubeadm` 有时不会将所有字段完整同步到集群内的 ConfigMap 中。手动补齐 `podSubnet` 是确保 Tigera Operator 正确生成 BGP 配置的关键。

---

## 四、Worker 节点加入集群

### 4.1 获取 join 命令

在 master 节点上执行：

```bash
# 生成 worker 节点加入命令
kubeadm token create --print-join-command

# 输出示例：
# kubeadm join 192.168.1.100:6443 --token abcdef.0123456789abcdef \
#     --discovery-token-ca-cert-hash sha256:1234567890abcdef...
```

### 4.2 Worker 节点执行 join

在**每个 worker 节点**上执行上面生成的命令：

```bash
kubeadm join 192.168.1.100:6443 --token abcdef.0123456789abcdef \
    --discovery-token-ca-cert-hash sha256:1234567890abcdef...
```

### 4.3 验证节点状态

```bash
# 在 master 节点上查看节点状态
kubectl get nodes

# 预期输出：
# NAME         STATUS   ROLES           AGE   VERSION
# k8s-master1  Ready    control-plane   24h   v1.28.0
# k8s-worker1  Ready    <none>          5m    v1.28.0
```

---

## 五、应用资源迁移

### 5.1 导出"脱水"YAML

使用 `kubectl-neat` 移除系统干扰项，让导出的配置更干净。

```bash
# 安装 kubectl-neat（如果没有安装）
# brew install kubectl-neat  # macOS
# 或使用 Docker: docker run --rm -it nicolaka/netshoot

# 导出命名空间下的资源
kubectl get deploy,svc,ing,cm,ds,sts -n <namespace> -o yaml | kubectl neat > <namespace>_clean.yaml

# 导出所有命名空间的资源
kubectl get all --all-namespaces -o yaml | kubectl neat > all_resources_clean.yaml
```

### 5.2 解决 Service ClusterIP 冲突

**报错原因**：`spec.clusterIPs[0]: Invalid value: may not change once set`

**原理**：Service IP 在创建时由控制平面分配，不可热修改。

**解决方法**：

```bash
# 方法 1：使用 sed 删除所有包含 clusterIP 的行
sed -i '/clusterIP:/d' <namespace>_clean.yaml
sed -i '/clusterIPs:/d' <namespace>_clean.yaml

# 方法 2：使用 kubectl replace 强制更新
kubectl replace --force -f <namespace>_clean.yaml

# 方法 3：使用 kustomize 清理特定字段
kustomize build . | kubectl apply -f -
```

### 5.3 Ingress Controller 与节点标签

**现象**：Pod `Pending`，报错 `nodeSelector` 不匹配。

**原理**：迁移过来的 Deployment 可能带有旧集群的标签约束。

**解决方法**：

```bash
# 为新节点添加所需标签
kubectl label nodes <new-node-name> dedicated=ingress

# 查看所有节点标签
kubectl get nodes --show-labels

# 如果需要删除标签
kubectl label nodes <node-name> key-
```

### 5.4 持久化存储（PV/PVC）处理

**重要提示**：PV/PVC 的迁移需要特别注意，因为涉及底层存储数据。

#### 方案 A：使用动态存储（推荐）

如果使用的是支持动态供给的 StorageClass，只需迁移 PVC 定义，PV 会自动创建。

```bash
# 导出 PVC 定义
kubectl get pvc -n <namespace> -o yaml | kubectl neat > pvc_clean.yaml

# 删除 clusterIP 和 uid 等不可迁移字段
sed -i '/uid:/d' pvc_clean.yaml
sed -i '/resourceVersion:/d' pvc_clean.yaml
sed -i '/selfLink:/d' pvc_clean.yaml
sed -i '/creationTimestamp:/d' pvc_clean.yaml

# 应用 PVC
kubectl apply -f pvc_clean.yaml
```

#### 方案 B：静态 PV 迁移

如果使用的是静态 PV，需要：
1. 确保底层存储数据已迁移到新环境
2. 修改 PV 定义中的节点亲和性配置
3. 重新创建 PV 资源

---

## 六、常见问题与解决方案

### 6.1 CoreDNS 启动失败

**症状**：CoreDNS Pod 一直处于 `CrashLoopBackOff` 状态。

**排查步骤**：

```bash
# 查看 CoreDNS 日志
kubectl logs -n kube-system -l k8s-app=kube-dns

# 检查 ConfigMap 配置
kubectl describe cm coredns -n kube-system

# 检查 Pod 网络是否正常
kubectl get pods -A -o wide | grep CoreDNS
```

**常见原因**：
- Pod 网段未正确配置
- CNI 插件未正常工作
- 镜像拉取失败

### 6.2 Calico 节点状态异常

**症状**：Calico Node Pod 处于 `Error` 或 `CrashLoopBackOff` 状态。

**排查步骤**：

```bash
# 查看 Calico 日志
kubectl logs -n kube-system -l k8s-app=calico-node

# 检查 IP 自动检测配置
kubectl get ds calico-node -n kube-system -o yaml | grep CALICO_IPV4POOL_CIDR

# 检查 BGP 配置
kubectl get bgppeers -A
```

### 6.3 节点 NotReady

**症状**：节点状态为 `NotReady`。

**排查步骤**：

```bash
# 查看节点详情
kubectl describe node <node-name>

# 检查 kubelet 状态
systemctl status kubelet

# 检查 kubelet 日志
journalctl -u kubelet -f

# 检查网络连接
ping <master-node-ip>
curl -k https://<master-node-ip>:6443
```

### 6.4 镜像拉取失败

**症状**：Pod 处于 `ImagePullBackOff` 或 `ErrImagePull` 状态。

**解决方法**：

```bash
# 配置容器运行时使用国内镜像源

# containerd 配置
cat > /etc/containerd/config.toml << EOF
[plugins."io.containerd.grpc.v1.cri".registry.mirrors]
  [plugins."io.containerd.grpc.v1.cri".registry.mirrors."docker.io"]
    endpoint = ["https://mirror.gcr.io"]
EOF

systemctl restart containerd

# Docker 配置
cat > /etc/docker/daemon.json << EOF
{
  "registry-mirrors": [
    "https://mirror.gcr.io",
    "https://registry.docker-cn.com"
  ]
}
EOF

systemctl restart docker
```

---

## 七、完整操作清单

### 7.1 源集群操作清单

- [ ] 备份 6 组核心证书
- [ ] 记录当前集群配置（kubeadm config view）
- [ ] 导出应用资源 YAML
- [ ] 记录 PV/PVC 信息
- [ ] 记录节点标签和污点信息

### 7.2 目标集群操作清单

- [ ] 安装相同版本的 Kubernetes 组件
- [ ] 配置 Hostname 和 /etc/hosts
- [ ] 恢复证书文件
- [ ] 生成并定制 kubeadm-config.yaml
- [ ] 预拉取所有必需镜像
- [ ] 执行 kubeadm init
- [ ] 配置 kubectl
- [ ] 安装 CNI 插件（Calico/Flannel）
- [ ] 加入 Worker 节点
- [ ] 导入应用资源
- [ ] 验证所有服务正常运行

### 7.3 验证清单

- [ ] `kubectl get nodes` - 所有节点 Ready
- [ ] `kubectl get pods -A` - 所有系统 Pod Running
- [ ] `kubectl get svc -A` - 所有 Service 正常
- [ ] DNS 解析测试：`nslookup kubernetes.default`
- [ ] 应用服务连通性测试
- [ ] 持久化存储挂载测试

---

## 附录：常用命令速查

```bash
# 查看集群版本
kubeadm version
kubectl version

# 查看节点信息
kubectl get nodes -o wide
kubectl describe node <node-name>

# 查看 Pod 信息
kubectl get pods -A
kubectl describe pod <pod-name> -n <namespace>

# 查看日志
kubectl logs <pod-name> -n <namespace>
kubectl logs -f <pod-name> -n <namespace>

# 调试 Pod
kubectl exec -it <pod-name> -n <namespace> -- /bin/sh
kubectl debug -it <pod-name> -n <namespace> --target=container-name

# 网络诊断
kubectl run -it --rm --restart=Never dns-test --image=busybox -- nslookup kubernetes.default
kubectl run -it --rm --restart=Never nettest --image=nicolaka/netshoot -- bash
```
