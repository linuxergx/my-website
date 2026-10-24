---
format: md
sidebar_position: 2
title: 面试复习：Linux 与 Kubernetes
---

# Linux 系统管理 & Kubernetes 面试复习大纲

> 面试时间：今天下午  
> 岗位要求：Linux系统管理 + Kubernetes集群运维（含CKA相关内容）

---

# 第一部分：Linux 系统管理

## 1. 系统安装与配置

### 常用发行版
- **RHEL/CentOS/Rocky Linux**：企业级，使用 `yum`/`dnf` 包管理
- **Ubuntu/Debian**：使用 `apt` 包管理
- **关键配置文件**：
  - `/etc/hostname` — 主机名
  - `/etc/hosts` — 本地DNS解析
  - `/etc/resolv.conf` — DNS服务器配置
  - `/etc/fstab` — 文件系统挂载配置
  - `/etc/sysctl.conf` — 内核参数配置（`sysctl -p` 生效）

### 网络配置
```bash
# 查看网络接口
ip addr show
ip link show

# 配置静态IP（NetworkManager）
nmcli con mod eth0 ipv4.addresses 192.168.1.100/24
nmcli con mod eth0 ipv4.gateway 192.168.1.1
nmcli con mod eth0 ipv4.method manual
nmcli con up eth0

# 路由管理
ip route show
ip route add 10.0.0.0/8 via 192.168.1.1

# 防火墙（firewalld）
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --reload
firewall-cmd --list-all
```

---

## 2. systemd 详解（重点）

### 核心概念
- **Unit 类型**：`.service`、`.socket`、`.timer`、`.mount`、`.target`
- **Target**：类似于 SysV 的 runlevel
  - `multi-user.target` ≈ runlevel 3（多用户，无GUI）
  - `graphical.target` ≈ runlevel 5（图形界面）

### 常用命令
```bash
# 服务管理
systemctl start/stop/restart/reload nginx
systemctl enable/disable nginx        # 开机自启
systemctl status nginx                # 查看状态
systemctl is-active/is-enabled nginx

# 查看所有服务
systemctl list-units --type=service
systemctl list-units --state=failed

# 查看启动日志
journalctl -u nginx                   # 查看nginx日志
journalctl -u nginx -f                # 实时跟踪
journalctl -u nginx --since "1 hour ago"
journalctl -b                         # 本次启动日志
journalctl -p err                     # 只看错误级别

# 系统目标
systemctl get-default                 # 查看默认target
systemctl set-default multi-user.target
systemctl isolate rescue.target       # 切换到救援模式
```

### 编写自定义 Service Unit
```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Application
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/myapp
ExecStart=/opt/myapp/bin/start.sh
ExecStop=/opt/myapp/bin/stop.sh
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload               # 重新加载unit文件
systemctl enable --now myapp.service  # 启用并立即启动
```

---

## 3. cgroup（Control Groups）详解（重点）

### 概念
- **cgroup** 是 Linux 内核功能，用于**限制、记录、隔离**进程组的资源使用（CPU、内存、磁盘I/O、网络等）
- **cgroup v1** vs **cgroup v2**：
  - v1：每个子系统独立挂载，层次结构分散
  - v2（unified hierarchy）：统一层次结构，现代系统默认（Kubernetes 1.25+ 推荐）

### cgroup v2 关键子系统
| 子系统 | 作用 |
|--------|------|
| `cpu` | CPU 时间限制（`cpu.max`） |
| `memory` | 内存限制（`memory.max`、`memory.swap.max`） |
| `io` | 磁盘I/O限制 |
| `pids` | 进程数量限制 |

### 查看 cgroup 信息
```bash
# 查看cgroup版本
mount | grep cgroup

# 查看进程所属cgroup
cat /proc/<pid>/cgroup

# cgroup v2 文件系统
ls /sys/fs/cgroup/
cat /sys/fs/cgroup/system.slice/nginx.service/memory.current
cat /sys/fs/cgroup/system.slice/nginx.service/cpu.stat
```

### systemd 与 cgroup 的关系
- systemd 使用 cgroup 来管理服务的资源
- 每个 service 对应一个 cgroup slice
- 可在 unit 文件中直接配置资源限制：

```ini
[Service]
CPUQuota=50%          # 限制CPU使用率50%
MemoryMax=512M        # 限制内存512MB
MemorySwapMax=0       # 禁止使用swap
TasksMax=100          # 最大进程数
IOWeight=50           # IO权重
```

---

## 4. 系统性能优化与故障排查

### CPU 分析
```bash
top / htop              # 实时进程监控
vmstat 1 5              # 系统统计（每1秒，共5次）
mpstat -P ALL 1         # 每个CPU核心使用率
pidstat -u 1            # 进程CPU使用率
sar -u 1 10             # 历史CPU数据

# 关键指标
# us: 用户态  sy: 内核态  wa: I/O等待  st: 虚拟机被偷走的时间
# load average: 1分钟/5分钟/15分钟平均负载（理想值 ≤ CPU核数）
```

### 内存分析
```bash
free -h                 # 内存使用概览
cat /proc/meminfo       # 详细内存信息
vmstat -s               # 内存统计
slabtop                 # 内核slab缓存

# OOM（内存不足）排查
dmesg | grep -i "oom"
journalctl -k | grep -i "out of memory"
```

### 磁盘 I/O 分析
```bash
iostat -xz 1            # 磁盘I/O统计
iotop                   # 进程I/O使用
df -h                   # 磁盘空间
du -sh /var/*           # 目录大小
lsof | grep deleted     # 查找已删除但未释放的文件

# 关键指标
# %util: 磁盘利用率（接近100%说明磁盘繁忙）
# await: I/O平均等待时间（ms）
# r/s, w/s: 每秒读写次数
```

### 网络分析
```bash
ss -tuln                # 查看监听端口（替代netstat）
ss -tp                  # 查看TCP连接及进程
netstat -s              # 网络统计
iftop / nethogs         # 实时网络流量
tcpdump -i eth0 port 80 # 抓包
ping / traceroute / mtr # 网络连通性

# 查看连接状态统计
ss -s
ss -ant | awk '{print $1}' | sort | uniq -c
```

### 系统日志排查
```bash
# 系统日志
journalctl -xe          # 查看最近错误（带详情）
journalctl --since "2024-01-01" --until "2024-01-02"
dmesg -T | tail -50     # 内核日志（带时间戳）

# 传统日志文件
/var/log/messages       # 系统消息（RHEL系）
/var/log/syslog         # 系统日志（Debian系）
/var/log/auth.log       # 认证日志
/var/log/secure         # 安全日志（RHEL系）
```

---

## 5. Bash 脚本自动化运维

### 常用脚本模式
```bash
#!/bin/bash
set -euo pipefail       # 严格模式：出错退出、未定义变量报错、管道错误传递

# 函数定义
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a /var/log/myapp.log
}

# 检查root权限
[[ $EUID -ne 0 ]] && { echo "需要root权限"; exit 1; }

# 参数处理
while getopts "h:p:u:" opt; do
    case $opt in
        h) HOST=$OPTARG ;;
        p) PORT=$OPTARG ;;
        u) USER=$OPTARG ;;
        *) echo "用法: $0 -h host -p port -u user"; exit 1 ;;
    esac
done
```

### 常用运维脚本示例

**批量检查服务状态**
```bash
#!/bin/bash
SERVICES=("nginx" "mysql" "redis" "docker")
for svc in "${SERVICES[@]}"; do
    if systemctl is-active --quiet "$svc"; then
        echo "✓ $svc 运行中"
    else
        echo "✗ $svc 未运行，尝试启动..."
        systemctl start "$svc" && echo "  已启动" || echo "  启动失败！"
    fi
done
```

**磁盘空间告警**
```bash
#!/bin/bash
THRESHOLD=80
df -h | awk 'NR>1 {gsub(/%/,"",$5); if($5+0 > '"$THRESHOLD"') print "警告: "$6" 使用率 "$5"%"}'
```

**日志清理**
```bash
#!/bin/bash
find /var/log -name "*.log" -mtime +30 -exec gzip {} \;
find /var/log -name "*.gz" -mtime +90 -delete
journalctl --vacuum-time=30d
```

### Python 运维脚本
```python
#!/usr/bin/env python3
import subprocess
import smtplib
from email.mime.text import MIMEText

def check_service(service_name):
    """检查systemd服务状态"""
    result = subprocess.run(
        ['systemctl', 'is-active', service_name],
        capture_output=True, text=True
    )
    return result.stdout.strip() == 'active'

def get_disk_usage():
    """获取磁盘使用情况"""
    import shutil
    total, used, free = shutil.disk_usage('/')
    return {
        'total': total // (2**30),
        'used': used // (2**30),
        'free': free // (2**30),
        'percent': used / total * 100
    }

# 使用 paramiko 进行SSH批量操作
import paramiko

def ssh_exec(host, user, key_file, command):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, key_filename=key_file)
    stdin, stdout, stderr = client.exec_command(command)
    return stdout.read().decode()
```

---

# 第二部分：Kubernetes 集群管理

## 1. 核心架构

### 控制平面组件
| 组件 | 作用 |
|------|------|
| `kube-apiserver` | API入口，所有操作的网关，唯一与etcd通信的组件 |
| `etcd` | 分布式KV存储，保存集群所有状态数据 |
| `kube-scheduler` | 将Pod调度到合适的Node |
| `kube-controller-manager` | 运行各种控制器（Deployment、Node、Endpoint等） |
| `cloud-controller-manager` | 与云厂商API交互（可选） |

### 节点组件
| 组件 | 作用 |
|------|------|
| `kubelet` | 节点代理，管理Pod生命周期，与CRI交互 |
| `kube-proxy` | 维护网络规则（iptables/ipvs），实现Service |
| `容器运行时` | containerd / CRI-O（Docker已弃用） |

---

## 2. 核心资源对象（YAML 实战）

### Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deploy
  namespace: default
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # 最多多出1个Pod
      maxUnavailable: 0    # 更新时最多0个不可用
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "256Mi"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 5
        readinessProbe:
          httpGet:
            path: /ready
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 3
```

### DaemonSet（每个节点运行一个Pod）
```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: node-exporter
  template:
    metadata:
      labels:
        app: node-exporter
    spec:
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        effect: NoSchedule    # 允许在master节点运行
      hostNetwork: true
      hostPID: true
      containers:
      - name: node-exporter
        image: prom/node-exporter:latest
        ports:
        - containerPort: 9100
          hostPort: 9100
```

### StatefulSet（有状态应用）
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  serviceName: mysql-headless   # 必须指定headless service
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
      - name: mysql
        image: mysql:8.0
        env:
        - name: MYSQL_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mysql-secret
              key: password
        volumeMounts:
        - name: data
          mountPath: /var/lib/mysql
  volumeClaimTemplates:         # 每个Pod自动创建PVC
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 10Gi
```

### Service
```yaml
# ClusterIP（集群内访问）
apiVersion: v1
kind: Service
metadata:
  name: nginx-svc
spec:
  type: ClusterIP
  selector:
    app: nginx
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP

---
# NodePort（节点端口暴露）
apiVersion: v1
kind: Service
metadata:
  name: nginx-nodeport
spec:
  type: NodePort
  selector:
    app: nginx
  ports:
  - port: 80
    targetPort: 80
    nodePort: 30080   # 范围 30000-32767

---
# LoadBalancer（云厂商LB）
apiVersion: v1
kind: Service
metadata:
  name: nginx-lb
spec:
  type: LoadBalancer
  selector:
    app: nginx
  ports:
  - port: 80
    targetPort: 80

---
# Headless Service（StatefulSet使用）
apiVersion: v1
kind: Service
metadata:
  name: mysql-headless
spec:
  clusterIP: None    # 关键：无ClusterIP
  selector:
    app: mysql
  ports:
  - port: 3306
```

### PV / PVC / StorageClass
```yaml
# StorageClass（动态供应）
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs   # 或 rancher.io/local-path
parameters:
  type: gp3
reclaimPolicy: Retain    # Delete / Retain / Recycle
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer

---
# PersistentVolume（静态供应）
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-nfs-001
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteMany    # RWO / ROX / RWX / RWOP
  persistentVolumeReclaimPolicy: Retain
  storageClassName: nfs-storage
  nfs:
    server: 192.168.1.100
    path: /data/k8s

---
# PersistentVolumeClaim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 10Gi
```

### Secret
```yaml
# Opaque Secret（base64编码）
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  username: YWRtaW4=      # echo -n 'admin' | base64
  password: cGFzc3dvcmQ=  # echo -n 'password' | base64

---
# 命令行创建
kubectl create secret generic db-secret \
  --from-literal=username=admin \
  --from-literal=password=mypassword

# TLS Secret
kubectl create secret tls my-tls \
  --cert=tls.crt \
  --key=tls.key

# 在Pod中使用Secret
spec:
  containers:
  - name: app
    env:
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: password
    volumeMounts:
    - name: secret-vol
      mountPath: /etc/secrets
      readOnly: true
  volumes:
  - name: secret-vol
    secret:
      secretName: db-secret
```

### ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  APP_ENV: production
  LOG_LEVEL: info
  config.yaml: |
    server:
      port: 8080
    database:
      host: mysql-svc
      port: 3306
```

---

## 3. Ingress 详解与故障排查

### Ingress 资源
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - example.com
    secretName: example-tls
  rules:
  - host: example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-svc
            port:
              number: 8080
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-svc
            port:
              number: 80
```

### Ingress 故障排查步骤
```bash
# 1. 检查 IngressClass 是否存在
kubectl get ingressclass

# 2. 检查 Ingress 资源状态
kubectl describe ingress my-ingress
kubectl get ingress -A

# 3. 检查 Ingress Controller Pod 状态
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx deploy/ingress-nginx-controller

# 4. 检查后端 Service 和 Endpoints
kubectl get svc api-svc
kubectl get endpoints api-svc    # 确认有Pod IP

# 5. 检查 TLS Secret
kubectl get secret example-tls
kubectl describe secret example-tls

# 6. 测试连通性
kubectl exec -it debug-pod -- curl http://api-svc:8080/health
kubectl exec -it debug-pod -- curl -H "Host: example.com" http://<ingress-controller-ip>/api

# 7. 检查 nginx 配置（nginx ingress）
kubectl exec -n ingress-nginx <controller-pod> -- nginx -T | grep example.com
```

---

## 4. CNI（容器网络接口）

### 常见 CNI 插件对比
| CNI | 模式 | 特点 |
|-----|------|------|
| Flannel | VXLAN/host-gw | 简单，适合小集群 |
| Calico | BGP/VXLAN | 支持NetworkPolicy，性能好 |
| Cilium | eBPF | 高性能，支持L7策略 |
| Weave | VXLAN | 简单，支持加密 |

### CNI 故障排查
```bash
# 1. 检查CNI插件Pod状态
kubectl get pods -n kube-system | grep -E "calico|flannel|cilium"
kubectl logs -n kube-system <cni-pod>

# 2. 检查节点网络接口
ip addr show
ip route show
# Calico: 检查 tunl0 或 bird 路由
# Flannel: 检查 flannel.1 接口

# 3. 检查CNI配置文件
ls /etc/cni/net.d/
cat /etc/cni/net.d/10-calico.conflist

# 4. Pod间网络测试
kubectl exec pod-a -- ping <pod-b-ip>
kubectl exec pod-a -- curl http://<pod-b-ip>:<port>

# 5. 检查NetworkPolicy
kubectl get networkpolicy -A
kubectl describe networkpolicy <name>

# 6. Calico 专用工具
calicoctl node status
calicoctl get nodes
calicoctl get bgppeers
```

### NetworkPolicy 示例
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 3306
```

---

## 5. CSI（容器存储接口）

### CSI 架构
- **CSI Driver**：由存储厂商实现，包含 Controller Plugin 和 Node Plugin
- **External Provisioner**：监听 PVC，调用 CSI 创建卷
- **External Attacher**：将卷附加到节点
- **Node Driver Registrar**：在节点注册 CSI 驱动

### CSI 故障排查
```bash
# 1. 检查 CSI 驱动 Pod
kubectl get pods -n kube-system | grep csi
kubectl logs -n kube-system <csi-controller-pod> -c csi-provisioner
kubectl logs -n kube-system <csi-node-pod> -c csi-driver

# 2. 检查 StorageClass
kubectl get storageclass
kubectl describe storageclass fast-ssd

# 3. 检查 PVC 状态
kubectl get pvc
kubectl describe pvc my-pvc
# 关注 Events 中的错误信息

# 4. 检查 PV 状态
kubectl get pv
kubectl describe pv <pv-name>

# 5. 检查 VolumeAttachment
kubectl get volumeattachment

# 6. 常见问题
# PVC Pending: StorageClass不存在 / 没有可用PV / CSI驱动异常
# Pod挂载失败: 节点CSI插件问题 / 权限问题 / 存储后端问题
```

---

## 6. kubectl 常用命令速查

```bash
# === 基础操作 ===
kubectl get pods -A -o wide                    # 所有命名空间的Pod，显示节点信息
kubectl get all -n myapp                       # 查看命名空间所有资源
kubectl describe pod <pod-name>                # 详细信息（重点看Events）
kubectl logs <pod-name> -c <container> -f      # 实时日志
kubectl logs <pod-name> --previous             # 上一个容器的日志（崩溃后）
kubectl exec -it <pod-name> -- /bin/bash       # 进入容器
kubectl cp <pod>:/path/to/file ./local-file    # 从Pod复制文件

# === 资源管理 ===
kubectl apply -f manifest.yaml                 # 应用配置
kubectl delete -f manifest.yaml                # 删除资源
kubectl edit deployment nginx-deploy           # 在线编辑
kubectl scale deployment nginx-deploy --replicas=5
kubectl rollout status deployment nginx-deploy # 查看滚动更新状态
kubectl rollout history deployment nginx-deploy
kubectl rollout undo deployment nginx-deploy   # 回滚
kubectl rollout undo deployment nginx-deploy --to-revision=2

# === 调试 ===
kubectl get events --sort-by='.lastTimestamp' -n default
kubectl top pods -A                            # 需要metrics-server
kubectl top nodes
kubectl debug -it <pod> --image=busybox --target=<container>  # 临时调试容器

# === 节点管理 ===
kubectl get nodes -o wide
kubectl describe node <node-name>
kubectl cordon <node-name>                     # 标记不可调度
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data  # 驱逐Pod
kubectl uncordon <node-name>                   # 恢复调度

# === 标签与选择器 ===
kubectl label node worker1 disk=ssd
kubectl get pods -l app=nginx,env=prod
kubectl get pods --field-selector status.phase=Running

# === 输出格式 ===
kubectl get pods -o yaml                       # YAML格式
kubectl get pods -o json                       # JSON格式
kubectl get pods -o jsonpath='{.items[*].metadata.name}'
kubectl get pods -o custom-columns=NAME:.metadata.name,STATUS:.status.phase

# === 命名空间 ===
kubectl create namespace myapp
kubectl config set-context --current --namespace=myapp  # 切换默认命名空间
```

---

## 7. Pod 调度与亲和性

### 资源请求与限制
```yaml
resources:
  requests:
    cpu: "250m"      # 0.25核，调度依据
    memory: "256Mi"  # 调度依据
  limits:
    cpu: "1"         # 超出会被throttle
    memory: "512Mi"  # 超出会被OOMKilled
```

### 节点选择
```yaml
# nodeSelector（简单）
spec:
  nodeSelector:
    disk: ssd

# nodeAffinity（复杂）
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:  # 硬要求
        nodeSelectorTerms:
        - matchExpressions:
          - key: kubernetes.io/arch
            operator: In
            values: ["amd64"]
      preferredDuringSchedulingIgnoredDuringExecution:  # 软要求
      - weight: 100
        preference:
          matchExpressions:
          - key: disk
            operator: In
            values: ["ssd"]

# Pod反亲和性（避免同一节点）
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: nginx
        topologyKey: kubernetes.io/hostname
```

### Taint 与 Toleration
```bash
# 给节点打污点
kubectl taint nodes node1 key=value:NoSchedule
kubectl taint nodes node1 key=value:NoExecute
kubectl taint nodes node1 key=value:PreferNoSchedule

# 删除污点
kubectl taint nodes node1 key:NoSchedule-
```

```yaml
# Pod容忍污点
spec:
  tolerations:
  - key: "key"
    operator: "Equal"
    value: "value"
    effect: "NoSchedule"
  - key: "node.kubernetes.io/not-ready"
    operator: "Exists"
    effect: "NoExecute"
    tolerationSeconds: 300
```

---

## 8. Helm 包管理

### 核心概念
- **Chart**：Helm 包，包含 K8s 资源模板
- **Release**：Chart 的一次部署实例
- **Repository**：Chart 仓库
- **Values**：配置参数

### 常用命令
```bash
# 仓库管理
helm repo add stable https://charts.helm.sh/stable
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm repo list

# 搜索与查看
helm search repo nginx
helm show values bitnami/nginx
helm show chart bitnami/nginx

# 安装与管理
helm install my-nginx bitnami/nginx \
  --namespace web \
  --create-namespace \
  --set replicaCount=3 \
  --set service.type=ClusterIP \
  -f custom-values.yaml

helm upgrade my-nginx bitnami/nginx --set replicaCount=5
helm upgrade --install my-nginx bitnami/nginx  # 不存在则安装

helm list -A                    # 查看所有release
helm status my-nginx            # 查看release状态
helm history my-nginx           # 查看历史版本
helm rollback my-nginx 1        # 回滚到版本1
helm uninstall my-nginx

# 调试
helm template my-nginx bitnami/nginx -f values.yaml  # 渲染模板（不安装）
helm lint ./my-chart            # 检查chart语法
helm dry-run my-nginx bitnami/nginx  # 模拟安装
```

### Chart 目录结构
```
my-chart/
├── Chart.yaml          # Chart元数据
├── values.yaml         # 默认配置值
├── templates/          # K8s资源模板
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── _helpers.tpl    # 模板辅助函数
│   └── NOTES.txt       # 安装后提示信息
└── charts/             # 依赖的子Chart
```

---

## 9. 监控系统与 PromQL

### Prometheus 架构
```
应用/Exporter → Prometheus Server → Alertmanager → 通知
                      ↓
                   Grafana（可视化）
```

### 核心组件
- **Prometheus Server**：抓取、存储、查询指标
- **Alertmanager**：告警路由、分组、抑制、通知
- **Pushgateway**：短期任务推送指标
- **Exporter**：暴露指标（node-exporter、kube-state-metrics等）

### PromQL 语法详解

#### 数据类型
- **Instant vector**：某时刻的时间序列集合
- **Range vector**：时间范围内的时间序列集合
- **Scalar**：标量数值

#### 选择器
```promql
# 基本查询
http_requests_total                          # 所有标签
http_requests_total{job="api", status="200"} # 精确匹配
http_requests_total{status=~"2.."}           # 正则匹配
http_requests_total{status!~"5.."}           # 正则不匹配

# 范围查询
http_requests_total[5m]                      # 过去5分钟的样本
```

#### 常用函数
```promql
# rate：计算每秒平均增长率（适合counter，自动处理重置）
rate(http_requests_total[5m])

# irate：瞬时增长率（最后两个样本，对突刺敏感）
irate(http_requests_total[5m])

# increase：时间范围内的增量
increase(http_requests_total[1h])

# sum/avg/max/min/count：聚合操作
sum(rate(http_requests_total[5m])) by (job)
avg(node_cpu_seconds_total) without (cpu, mode)

# histogram_quantile：计算分位数（P99延迟）
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# predict_linear：线性预测
predict_linear(node_filesystem_free_bytes[1h], 4*3600)  # 预测4小时后的值

# absent：检测指标是否缺失
absent(up{job="api"})
```

#### 实用查询示例
```promql
# CPU使用率（每个节点）
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# 内存使用率
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# 磁盘使用率
(1 - node_filesystem_free_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes{fstype!="tmpfs"}) * 100

# HTTP错误率
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100

# Pod重启次数（过去1小时）
increase(kube_pod_container_status_restarts_total[1h]) > 3

# 节点是否就绪
kube_node_status_condition{condition="Ready",status="true"} == 0

# P99 请求延迟
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))
```

### 告警规则配置
```yaml
# prometheus-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: node-alerts
  namespace: monitoring
  labels:
    prometheus: kube-prometheus
    role: alert-rules
spec:
  groups:
  - name: node.rules
    interval: 30s
    rules:
    # 节点CPU告警
    - alert: NodeCPUHigh
      expr: |
        100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 85
      for: 5m
      labels:
        severity: warning
        team: ops
      annotations:
        summary: "节点 {{ $labels.instance }} CPU使用率过高"
        description: "CPU使用率 {{ $value | printf \"%.1f\" }}%，持续超过5分钟"

    # 节点内存告警
    - alert: NodeMemoryHigh
      expr: |
        (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100 > 90
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "节点 {{ $labels.instance }} 内存不足"
        description: "内存使用率 {{ $value | printf \"%.1f\" }}%"

    # 磁盘空间告警
    - alert: DiskSpaceLow
      expr: |
        (1 - node_filesystem_free_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes{fstype!="tmpfs"}) * 100 > 85
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "磁盘空间不足: {{ $labels.instance }} {{ $labels.mountpoint }}"
        description: "磁盘使用率 {{ $value | printf \"%.1f\" }}%"

    # Pod频繁重启
    - alert: PodCrashLooping
      expr: |
        increase(kube_pod_container_status_restarts_total[1h]) > 5
      for: 0m
      labels:
        severity: critical
      annotations:
        summary: "Pod {{ $labels.namespace }}/{{ $labels.pod }} 频繁重启"
        description: "过去1小时重启 {{ $value }} 次"

    # 服务不可用
    - alert: ServiceDown
      expr: |
        up == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "服务 {{ $labels.job }} 不可用"
        description: "实例 {{ $labels.instance }} 已下线超过1分钟"
```

### Alertmanager 配置
```yaml
# alertmanager.yaml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'alertmanager@example.com'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s        # 等待同组告警聚合
  group_interval: 5m     # 同组告警发送间隔
  repeat_interval: 4h    # 告警重复发送间隔
  receiver: 'default'
  routes:
  - match:
      severity: critical
    receiver: 'pagerduty'
    continue: true
  - match:
      team: ops
    receiver: 'ops-team'

receivers:
- name: 'default'
  email_configs:
  - to: 'ops@example.com'
    send_resolved: true

- name: 'ops-team'
  webhook_configs:
  - url: 'https://hooks.slack.com/services/xxx'
    send_resolved: true

inhibit_rules:
- source_match:
    severity: 'critical'
  target_match:
    severity: 'warning'
  equal: ['alertname', 'instance']  # critical时抑制同实例的warning
```

---

## 10. 常见故障排查场景

### Pod 无法启动排查流程
```bash
# 1. 查看Pod状态
kubectl get pod <pod-name> -o wide

# 2. 查看详细事件
kubectl describe pod <pod-name>
# 重点关注：Events、Conditions、容器状态

# 3. 查看日志
kubectl logs <pod-name>
kubectl logs <pod-name> --previous  # 上次崩溃的日志

# 常见状态及原因：
# Pending: 资源不足/节点选择器不匹配/PVC未绑定/镜像拉取策略
# ImagePullBackOff: 镜像不存在/仓库认证失败
# CrashLoopBackOff: 应用启动失败/配置错误/依赖服务不可用
# OOMKilled: 内存超出limits
# Evicted: 节点资源压力，Pod被驱逐
# Terminating: 卡在终止状态（可能需要强制删除）
```

### 强制删除卡住的 Pod
```bash
kubectl delete pod <pod-name> --grace-period=0 --force
```

### 节点 NotReady 排查
```bash
# 1. 查看节点状态
kubectl describe node <node-name>
# 关注：Conditions、Taints、Events

# 2. 登录节点检查
systemctl status kubelet
journalctl -u kubelet -f

# 3. 检查容器运行时
systemctl status containerd
crictl ps

# 4. 检查网络
ping <master-ip>
curl -k https://<apiserver>:6443/healthz

# 5. 检查磁盘/内存压力
df -h
free -h
```

### etcd 故障排查
```bash
# 检查etcd健康状态
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  endpoint health

# 查看etcd成员
etcdctl member list

# etcd备份
etcdctl snapshot save /backup/etcd-$(date +%Y%m%d).db

# etcd恢复
etcdctl snapshot restore /backup/etcd-20240101.db \
  --data-dir=/var/lib/etcd-restore
```

---

## 11. RBAC 权限管理

```yaml
# ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-sa
  namespace: default

---
# Role（命名空间级别）
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch", "update", "patch"]

---
# ClusterRole（集群级别）
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-reader
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get", "list", "watch"]

---
# RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: default
subjects:
- kind: ServiceAccount
  name: app-sa
  namespace: default
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

```bash
# 检查权限
kubectl auth can-i get pods --as=system:serviceaccount:default:app-sa
kubectl auth can-i create deployments --as=developer -n production
```

---

## 12. 集群升级与维护

### 集群升级流程（kubeadm）
```bash
# 1. 升级控制平面
apt-get update && apt-get install -y kubeadm=1.29.0-00
kubeadm upgrade plan
kubeadm upgrade apply v1.29.0

# 2. 升级 kubelet 和 kubectl
apt-get install -y kubelet=1.29.0-00 kubectl=1.29.0-00
systemctl daemon-reload && systemctl restart kubelet

# 3. 升级工作节点（逐个操作）
kubectl cordon worker1
kubectl drain worker1 --ignore-daemonsets --delete-emptydir-data
# 在worker1上执行：
kubeadm upgrade node
apt-get install -y kubelet=1.29.0-00 kubectl=1.29.0-00
systemctl daemon-reload && systemctl restart kubelet
# 回到master：
kubectl uncordon worker1
```

---

# 第三部分：高频面试问题 Q&A

## Linux 部分

**Q: systemd 和 SysV init 的区别？**
> systemd 并行启动服务（SysV串行），使用 cgroup 管理进程，统一日志（journald），支持 socket 激活和按需启动，启动速度更快。

**Q: cgroup v1 和 v2 的区别？**
> v1 每个子系统独立挂载，层次结构分散，不同子系统可以有不同的层次；v2 统一层次结构（unified hierarchy），所有子系统共享同一棵树，更简洁，Kubernetes 1.25+ 推荐使用 v2。

**Q: 如何排查系统负载高的问题？**
> 1. `top/htop` 看 CPU、内存、负载；2. `vmstat` 看 CPU 等待和上下文切换；3. `iostat` 看磁盘 I/O；4. `ss` 看网络连接；5. 找到高负载进程后用 `strace`/`perf` 深入分析。

**Q: Linux 内存回收机制？**
> 内存分为匿名内存（进程堆栈）和文件缓存（page cache）。内存不足时，内核通过 kswapd 回收 page cache，或通过 OOM Killer 杀死进程。`/proc/sys/vm/swappiness` 控制使用 swap 的倾向（0-100）。

## Kubernetes 部分

**Q: Pod 的生命周期？**
> Pending → Running → Succeeded/Failed。关键阶段：调度（Scheduler）→ 拉取镜像 → 运行 Init Container → 运行主容器（含 postStart hook）→ 就绪探针通过 → 接收流量 → 终止（preStop hook → SIGTERM → 等待 terminationGracePeriodSeconds → SIGKILL）。

**Q: Deployment、StatefulSet、DaemonSet 的区别？**
> - **Deployment**：无状态应用，Pod 可随机调度，支持滚动更新
> - **StatefulSet**：有状态应用，Pod 有固定名称（pod-0/1/2），有序启停，每个 Pod 有独立 PVC
> - **DaemonSet**：每个节点运行一个 Pod，适合日志收集、监控等基础设施组件

**Q: Service 的几种类型及使用场景？**
> - **ClusterIP**：集群内访问，默认类型
> - **NodePort**：通过节点IP+端口访问，适合开发测试
> - **LoadBalancer**：云厂商提供外部LB，生产环境对外暴露
> - **ExternalName**：将 Service 映射到外部 DNS 名称
> - **Headless**（clusterIP: None）：直接返回 Pod IP，StatefulSet 使用

**Q: kube-proxy 的工作原理？**
> kube-proxy 监听 Service 和 Endpoints 变化，在每个节点维护网络规则：
> - **iptables 模式**：通过 iptables DNAT 规则转发流量，随机负载均衡
> - **ipvs 模式**：使用内核 IPVS，性能更好，支持多种负载均衡算法（rr/lc/sh等）

**Q: 如何实现 Pod 的零停机部署？**
> 1. 使用 RollingUpdate 策略，设置 `maxUnavailable: 0`；2. 配置 readinessProbe，确保新 Pod 就绪后才接收流量；3. 配置 preStop hook 和足够的 terminationGracePeriodSeconds；4. 应用代码支持优雅关闭（处理 SIGTERM）。

**Q: etcd 在 K8s 中的作用？如何保证高可用？**
> etcd 是 K8s 的唯一数据存储，保存所有集群状态。高可用通过奇数个节点（3/5/7）组成 Raft 集群实现，需要超过半数节点存活才能正常工作。生产环境建议 3 个 etcd 节点，定期备份（`etcdctl snapshot save`）。

**Q: Ingress 和 Service 的区别？**
> Service 是 L4（TCP/UDP）负载均衡，Ingress 是 L7（HTTP/HTTPS）路由，支持基于域名和路径的路由、TLS 终止、重写等功能。Ingress 需要 Ingress Controller（如 nginx-ingress）才能工作。

**Q: 什么是 PodDisruptionBudget？**
> PDB 限制同时中断的 Pod 数量，保证应用在节点维护（drain）时的可用性。
> ```yaml
> spec:
>   minAvailable: 2    # 或 maxUnavailable: 1
>   selector:
>     matchLabels:
>       app: nginx
> ```

---

# 第四部分：快速记忆卡片

## 重要端口
| 组件 | 端口 |
|------|------|
| kube-apiserver | 6443 |
| etcd | 2379（客户端）, 2380（集群通信） |
| kubelet | 10250 |
| kube-scheduler | 10259 |
| kube-controller-manager | 10257 |
| node-exporter | 9100 |
| Prometheus | 9090 |
| Alertmanager | 9093 |
| Grafana | 3000 |

## 重要文件路径
| 文件 | 说明 |
|------|------|
| `/etc/kubernetes/admin.conf` | kubeconfig（管理员） |
| `/etc/kubernetes/manifests/` | 静态Pod配置（控制平面组件） |
| `/etc/kubernetes/pki/` | 证书文件 |
| `/var/lib/etcd/` | etcd数据目录 |
| `/var/lib/kubelet/` | kubelet数据目录 |
| `/etc/cni/net.d/` | CNI配置 |
| `/opt/cni/bin/` | CNI插件二进制 |

## kubectl 快捷别名（面试可提及）
```bash
alias k=kubectl
alias kgp='kubectl get pods'
alias kgs='kubectl get svc'
alias kgn='kubectl get nodes'
alias kdp='kubectl describe pod'
export do='--dry-run=client -o yaml'  # 快速生成YAML模板

# 快速生成YAML
kubectl create deployment nginx --image=nginx $do > deploy.yaml
kubectl create service clusterip nginx --tcp=80:80 $do > svc.yaml
kubectl create configmap myconfig --from-literal=key=value $do > cm.yaml
```

---

> 💡 **面试建议**：
> 1. 回答问题时先说**原理**，再说**命令**，最后说**实际经验**
> 2. 遇到不确定的问题，诚实说"我了解基本原理，但具体细节需要查文档确认"
> 3. 主动提及自己的**CKA认证**和实际运维经验
> 4. 对于故障排查类问题，按**系统化的排查步骤**回答，展示思维逻辑
> 5. 准备1-2个**实际解决过的复杂问题**案例，能详细描述问题现象、排查过程和解决方案
