# Docker 与容器运行时技术详解

[TOC]



## 1. 核心概念：什么是容器？

**容器**本质上是在一个**隔离环境**中运行的**进程**。这个隔离环境是 Docker 通过 Linux 内核的 **Namespaces** (资源隔离) 和 **Cgroups** (资源限制) 技术创建的。

- **隔离性**：每个容器都拥有自己独立的运行环境，包括：
  - 独立的文件系统（Root Filesystem）
  - 独立的主机名 (Hostname)
  - 独立的 IP 地址和网络栈
  - 独立的进程空间 (PID Namespace)
- **生命周期**：容器的生命周期与其中运行的主进程绑定。一旦主进程结束，容器就会停止。

为了让容器能持续在后台运行，其启动命令（主进程）必须是一个**前台夯住**的进程，例如 `nginx -g 'daemon off;'`。

下面是一个简单的 ASCII 图，展示了容器的运行模式：

```
+--------------------------------------------------+
|                  Host Machine (物理机或虚拟机)                  |
| +----------------------------------------------+ |
| |                  Host OS (Linux Kernel)                  | |
| +----------------------------------------------+ |
| |    Docker Engine                             | |
| | +-----------+  +-----------+  +-----------+  | |
| | | Container |  | Container |  | Container |  | |
| | |-----------|  |-----------|  |-----------|  | |
| | | Process A |  | Process B |  | Process C |  | |
| | | (Isolated)|  | (Isolated)|  | (Isolated)|  | |
| | +-----------+  +-----------+  +-----------+  | |
| +----------------------------------------------+ |
+--------------------------------------------------+
```

## 2. 容器与虚拟机的区别

| 特性         | 虚拟机 (Virtual Machine)                                     | 容器 (Container)                                     |
| ------------ | ------------------------------------------------------------ | ---------------------------------------------------- |
| **隔离级别** | **硬件级隔离**                                               | **进程级隔离**                                       |
| **底层技术** | 通过 **Hypervisor** 模拟一整套硬件（CPU, 内存, 硬盘）        | 共享宿主机的 **Linux 内核**                          |
| **启动过程** | 完整的操作系统启动流程（BIOS -> Grub -> Kernel -> Init）     | 直接启动容器内的指定进程                             |
| **资源占用** | **重**。每个虚拟机都有独立的完整操作系统，占用大量磁盘和内存。 | **轻**。不包含操作系统内核，镜像体积小，内存占用少。 |
| **启动速度** | **慢**（分钟级）                                             | **快**（秒级甚至毫秒级）                             |
| **性能损耗** | 较大，因为有硬件虚拟化和完整 OS 的开销。                     | 极小，接近原生性能，因为只是一个被隔离的进程。       |

**简单比喻**：

- **虚拟机**就像是买了一套完整的**房子** 🏠，有独立的地基、墙壁、水电系统。
- **容器**则像是在一栋**大楼**里租了一个**公寓** 🚪，共享大楼的基础设施（地基、承重墙），但有自己独立的房间和门锁。

## 3. Docker Community Edition (CE) 的安装

以下是在 CentOS 7/8 系统上安装 Docker CE 的标准步骤。

**环境准备**:

| 主机名   | 内存 | IP 地址   |
| -------- | ---- | --------- |
| docker01 | 2G   | 10.0.0.11 |
| docker02 | 2G   | 10.0.0.12 |

**安装步骤**:

```
# 1. 下载 Docker 的官方 YUM 仓库配置文件
wget -O /etc/yum.repos.d/docker-ce.repo https://download.docker.com/linux/centos/docker-ce.repo

# 2. (可选但推荐) 将 YUM 源地址替换为国内镜像，以加快下载速度
sed -i 's+download.docker.com+mirrors.tuna.tsinghua.edu.cn/docker-ce+' /etc/yum.repos.d/docker-ce.repo

# 3. 使用 yum 安装 docker-ce
yum install docker-ce -y

# 4. 设置 Docker 服务开机自启并立即启动
systemctl enable docker
systemctl start docker

# 5. 验证安装是否成功
docker version
# 如果能看到 Client 和 Server 的版本信息，则表示安装成功。
```

## 4. Docker 的核心组成

Docker 采用 **客户端-服务器 (Client-Server)** 架构。`docker` 命令是我们使用的客户端，它通过 REST API 与后台运行的 Docker 守护进程 (Docker Daemon) 通信。

- **镜像 (Image)**: 一个只读的模板，包含了运行应用程序所需的所有内容（代码、运行时、库、环境变量和配置文件）。镜像是创建容器的基础。
- **容器 (Container)**: 镜像的运行实例。容器可以被启动、停止、移动和删除。
- **仓库 (Repository)**: 集中存放和分发镜像的服务。最著名的是 Docker Hub。仓库分为公共仓库和私有仓库。

## 5. Docker 镜像常用命令

| 命令                                       | 详细说明与示例                                               |
| ------------------------------------------ | ------------------------------------------------------------ |
| `docker search [keyword]`                  | 从 Docker Hub 搜索镜像。优先选择 `OFFICIAL` 为 `[OK]` 且 `STARS` 数量多的镜像。`docker search nginx` |
| `docker pull [image_name:tag]`             | 从仓库拉取（下载）镜像。`docker pull nginx:latest`           |
| `docker push [image_name:tag]`             | 将本地镜像推送到仓库。需要先登录 (`docker login`)。`docker push my-registry/my-app:v1.0` |
| `docker images`                            | 查看本地已有的所有镜像。                                     |
| `docker rmi [image_id/name]`               | 删除一个或多个本地镜像。如果镜像被容器使用，需要先删除容器。 |
| `docker tag [source_image] [target_image]` | 为镜像打上一个新的标签，常用于推送前重命名。`docker tag nginx:latest 10.0.0.11:5000/my-nginx:v1` |
| `docker save -o [file.tar] [image]`        | 将镜像导出为一个 `.tar` 归档文件，用于离线迁移。`docker save -o nginx.tar nginx:latest` |
| `docker load -i [file.tar]`                | 从一个 `.tar` 归档文件导入镜像。`docker load -i nginx.tar`   |

## 6. Docker 容器常用命令

| 命令                                     | 详细说明与示例                                               |
| ---------------------------------------- | ------------------------------------------------------------ |
| `docker run [options] [image] [command]` | **创建并启动**一个新容器。这是最核心的命令。`docker run -d -p 80:80 --name web1 nginx` |
| `docker create [options] [image]`        | 只**创建**容器，但不启动。                                   |
| `docker start [container_id/name]`       | 启动一个或多个已停止的容器。                                 |
| `docker stop [container_id/name]`        | 优雅地停止一个或多个正在运行的容器（发送 SIGTERM 信号）。    |
| `docker kill [container_id/name]`        | 强制停止一个或多个容器（发送 SIGKILL 信号）。                |
| `docker restart [container_id/name]`     | 重启一个容器。                                               |
| `docker ps`                              | 查看**正在运行**的容器列表。                                 |
| `docker ps -a`                           | 查看**所有**容器的列表（包括已停止的）。                     |
| `docker rm [container_id/name]`          | 删除一个或多个已停止的容器。                                 |
| `docker rm -f $(docker ps -aq)`          | **批量删除所有容器**（`-f` 强制删除运行中的，`-q` 只显示ID）。 |
| `docker exec -it [container] [command]`  | **进入正在运行的容器并执行新命令**。这会分配一个新的终端。这是最常用的进入容器的方式。`docker exec -it web1 /bin/bash` |
| `docker attach [container]`              | **附加到正在运行的容器的主进程终端**。共享同一个输入输出。退出时会导致主进程结束。不常用。 |

## 7. Docker 端口映射

端口映射 (`-p` 或 `-P`) 是让外部网络能够访问容器内服务的关键。

| 选项                                        | 详细说明                                                     |
| ------------------------------------------- | ------------------------------------------------------------ |
| `-p [host_port]:[container_port]`           | 将宿主机的指定端口映射到容器的指定端口。`docker run -d -p 8080:80 nginx` |
| `-p [host_ip]:[host_port]:[container_port]` | 将宿主机指定 IP 的端口映射到容器端口，用于多网卡服务器。     |
| `-p [host_port]:[container_port]/udp`       | 指定使用 UDP 协议进行映射。                                  |
| `-p [host_ip]::[container_port]`            | 宿主机端口**随机**分配，容器端口固定。                       |
| `-P` (大写)                                 | 将 Dockerfile 中 `EXPOSE` 指令声明的所有端口都随机映射到宿主机的高位端口。 |

## 8. Docker 数据卷 (Volumes)

数据卷用于**持久化**容器内的数据，以及在容器和宿主机之间共享数据。

| 选项                                  | 详细说明                                                     |
| ------------------------------------- | ------------------------------------------------------------ |
| `-v [host_abs_path]:[container_path]` | **绑定挂载 (Bind Mount)**：将宿主机的**指定绝对路径**挂载到容器内。性能高，但耦合性强。`docker run -v /data/mysql:/var/lib/mysql mysql` |
| `-v [volume_name]:[container_path]`   | **命名卷 (Named Volume)**：由 Docker 管理的持久化存储。推荐使用此方式，因为它与宿主机文件系统解耦。`docker run -v mysql_data:/var/lib/mysql mysql` |
| `-v [container_path]`                 | **匿名卷 (Anonymous Volume)**：不指定宿主机路径或卷名，Docker 会自动创建一个匿名的卷。不推荐，因为难以管理。 |
| `--volumes-from [container_name]`     | 从另一个已存在的容器挂载所有的数据卷。                       |

## 9. 手动制作 Docker 镜像

通过在一个基础容器中安装和配置好所需服务，然后使用 `docker commit` 命令将其保存为一个新镜像。

**思路**:

1. 启动一个纯净的基础镜像容器（如 `centos:7`）。
2. 使用 `docker exec` 进入容器，执行所有必要的安装和配置命令（如 `yum install`, 修改配置文件等）。
3. 退出容器。
4. 使用 `docker commit [container_id] [new_image_name:tag]` 命令提交更改，生成新镜像。
5. 使用新镜像启动容器进行测试。

**示例：制作一个包含 Nginx 的 CentOS 6 镜像**

```
# 1. 启动一个 CentOS 6.9 容器
docker run -it --name builder centos:6.9 /bin/bash

# 2. 在容器内部进行操作
# (在容器的 shell 中执行)
yum install -y epel-release
yum install -y nginx
exit

# 3. 提交容器为新镜像
docker commit builder my-centos-nginx:v1

# 4. 测试新镜像
docker run -d -p 8080:80 my-centos-nginx:v1 nginx -g 'daemon off;'
```

## 10. 自动制作 Docker 镜像 (Dockerfile)

Dockerfile 是一个文本文件，包含了一系列指令，用于自动构建 Docker 镜像。这是**推荐的、可重复的、透明的**镜像构建方式。

**Dockerfile 常用指令**:

| 指令         | 详细说明                                                     |
| ------------ | ------------------------------------------------------------ |
| `FROM`       | 指定基础镜像，必须是第一条指令。                             |
| `MAINTAINER` | 镜像维护者的信息（已废弃，推荐使用 `LABEL`）。               |
| `LABEL`      | 为镜像添加元数据，如 `LABEL version="1.0"`。                 |
| `RUN`        | 在镜像**构建过程**中执行的命令，如安装软件。每条 `RUN` 指令都会创建新的一层。 |
| `COPY`       | 将构建上下文（Dockerfile 所在目录）中的文件或目录复制到镜像中。 |
| `ADD`        | 功能与 `COPY` 类似，但额外支持解压本地 `.tar` 压缩包和下载 URL。 |
| `WORKDIR`    | 设置后续 `RUN`, `CMD`, `ENTRYPOINT` 指令的工作目录。         |
| `ENV`        | 设置环境变量。                                               |
| `EXPOSE`     | 声明容器运行时计划要监听的端口，仅起文档作用，不会实际映射端口。 |
| `VOLUME`     | 创建一个可以挂载的卷，用于持久化数据。                       |
| `CMD`        | **容器启动时**默认执行的命令。可被 `docker run` 后面的命令覆盖。 |
| `ENTRYPOINT` | **容器启动时**执行的命令。不会被 `docker run` 后面的命令覆盖，而是将 `docker run` 的命令作为其参数。 |

**`CMD` vs `ENTRYPOINT`**:

- `CMD`: 提供默认命令，易于被用户在 `docker run` 时覆盖。适合作为可变的应用入口。
- `ENTRYPOINT`: 提供固定的容器入口，`docker run` 的参数会追加到其后。适合制作固定用途的工具镜像。
- **最佳实践**: 两者结合使用，`ENTRYPOINT` 定义主程序，`CMD` 提供默认参数。

**示例：构建 Nginx 镜像的 Dockerfile**

```
# 使用 CentOS 7 作为基础镜像
FROM centos:7

# 添加镜像元数据
LABEL maintainer="Your Name <your.email@example.com>"

# 安装 epel 源和 nginx
RUN yum install -y epel-release && \
    yum install -y nginx && \
    yum clean all

# 声明容器将监听 80 端口
EXPOSE 80

# 容器启动时执行的默认命令
CMD ["nginx", "-g", "daemon off;"]
```

**构建命令**: `docker build -t my-nginx:v1 .` (注意最后的 `.` 表示当前目录)

## 11. Docker 镜像的分层结构

Docker 镜像是**分层**的，每一层都是前一层之上的一系列文件系统变更。

```
+---------------------------------+
| Writable Container Layer (读写层) |  <-- 容器启动后创建，所有修改发生在此层
+---------------------------------+
| Image Layer 3 (e.g., RUN yum install nginx) | (只读层)
+---------------------------------+
| Image Layer 2 (e.g., RUN yum update) | (只读层)
+---------------------------------+
| Base Image Layer (e.g., FROM centos:7) | (只读层)
+---------------------------------+
```

- **共享与复用**: 如果多个镜像共享相同的基础层，那么在宿主机上这些层只需要存储一份，极大地节省了磁盘空间。
- **写时复制 (Copy-on-Write)**: 当容器需要修改一个来自只读层的文件时，Docker 会将该文件复制到顶部的读写层中进行修改，而原始的只读层文件保持不变。

## 12. Dockerfile 优化策略

1. **使用更小的基础镜像**: 例如，使用 `alpine` 代替 `centos`，可以使镜像体积从几百 MB 减小到几 MB。
2. **合并 `RUN` 指令**: 将多个 `RUN` 指令用 `&&` 连接起来，可以减少镜像的层数。
3. **及时清理缓存**: 在 `RUN` 指令的末尾清理软件包管理器的缓存，如 `yum clean all` 或 `apt-get clean`。
4. **优化层缓存**: 将**不经常变动**的指令（如安装基础依赖）放在 Dockerfile 的**前面**，将**经常变动**的指令（如 `COPY` 应用程序代码）放在**后面**，以最大限度地利用构建缓存。
5. **使用 `.dockerignore` 文件**: 类似于 `.gitignore`，可以忽略构建上下文中不需要的文件和目录，避免将它们发送给 Docker 守护进程，加快构建速度。

## 13. 容器间通信

### 13.1. `--link` (旧版，不推荐)

```
--link` 可以在两个容器之间建立一个安全的通道，并通过修改 `/etc/hosts` 文件和设置环境变量的方式，让源容器可以访问到目标容器。 `docker run --name web --link db:mysql -d my-webapp
```

### 13.2. 自定义 Bridge 网络 (推荐)

最佳实践是创建一个自定义的 `bridge` 网络，并将需要通信的容器连接到同一个网络中。在同一个自定义网络里的容器，可以通过**容器名**直接相互访问。

```
# 1. 创建一个自定义网络
docker network create my-app-net

# 2. 启动数据库容器并连接到该网络
docker run -d --name db --network my-app-net mysql

# 3. 启动应用容器并连接到该网络
# 在应用代码中，可以直接使用 "db" 作为数据库主机名
docker run -d --name web --network my-app-net my-webapp
```

## 14. 单机容器编排：Docker Compose

Docker Compose 是一个用于定义和运行多容器 Docker 应用程序的工具。它使用一个 `YAML` 文件来配置应用的服务，然后使用一条命令就可以创建并启动所有服务。

**`docker-compose.yml` 示例 (Zabbix)**:

```
version: '3.7'

services:
  mysql-server:
    image: mysql:5.7
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: root_pwd
      MYSQL_DATABASE: zabbix
      MYSQL_USER: zabbix
      MYSQL_PASSWORD: zabbix_pwd
    volumes:
      - mysql_data:/var/lib/mysql

  zabbix-server:
    image: zabbix/zabbix-server-mysql:latest
    restart: always
    depends_on:
      - mysql-server
    ports:
      - "10051:10051"
    environment:
      DB_SERVER_HOST: "mysql-server"
      MYSQL_DATABASE: "zabbix"
      MYSQL_USER: "zabbix"
      MYSQL_PASSWORD: "zabbix_pwd"

volumes:
  mysql_data:
```

**常用命令**:

- `docker-compose up -d`: 在后台创建并启动所有服务。
- `docker-compose down`: 停止并移除所有服务、网络。
- `docker-compose ps`: 查看所有服务的状态。
- `docker-compose logs -f`: 实时查看所有服务的日志。

## 15. 私有镜像仓库：Registry & Harbor

### 15.1. Docker Registry

Docker 官方提供的最基础的私有仓库镜像。

```
# 1. 启动 Registry 容器，并将数据持久化到宿主机的 /opt/myregistry 目录
docker run -d -p 5000:5000 --restart=always --name registry -v /opt/myregistry:/var/lib/registry registry

# 2. 配置 Docker Daemon 以信任不安全的 HTTP 仓库
# 编辑 /etc/docker/daemon.json 文件
# {
#   "insecure-registries": ["10.0.0.11:5000"]
# }
# systemctl restart docker

# 3. 标记并推送镜像
docker tag alpine:3.9 10.0.0.11:5000/alpine:3.9
docker push 10.0.0.11:5000/alpine:3.9

# 4. 从私有仓库拉取镜像
docker pull 10.0.0.11:5000/alpine:3.9
```

### 15.2. Harbor (企业级)

Harbor 是一个开源的企业级 Docker 镜像仓库，提供了用户管理、基于角色的访问控制 (RBAC)、镜像扫描、图形化界面等高级功能。它通常通过 Docker Compose 进行部署。

## 16. Docker 网络模式详解

| 网络模式    | 描述                                                         | 使用场景                                                     |
| ----------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `bridge`    | **默认模式**。Docker 会创建一个虚拟网桥 `docker0`，每个容器都会分配一个该网段的私有 IP。容器通过 NAT 访问外部网络。 | 单机环境下容器之间的隔离通信。                               |
| `host`      | 容器**不创建**自己的网络栈，而是直接共享宿主机的网络命名空间。容器端口直接暴露在宿主机 IP 上。 | 需要极高性能、对网络延迟敏感的应用，因为它避免了 NAT 的开销。 |
| `container` | 让一个新容器共享另一个已存在容器的网络命名空间。             | Kubernetes 中的 Pod 就是基于此概念实现的。                   |
| `none`      | 容器拥有自己的网络命名空间，但没有任何网络配置。             | 需要完全隔离网络或进行自定义网络配置的场景。                 |
| `macvlan`   | 允许为容器分配一个与宿主机在**同一物理网络**中的 MAC 地址和 IP 地址，使容器看起来就像是网络中的一台独立的物理设备。 | 需要容器拥有独立物理 IP 的场景，如传统应用迁移。             |
| `overlay`   | **多主机网络**解决方案，用于 Docker Swarm 集群。它可以在不同的宿主机之间创建一个虚拟的二层网络，让跨主机的容器能够直接通信。 | Docker Swarm 集群中跨主机容器通信。                          |

## 17. Docker 容器监控 (实战部署流程)

采用 **Prometheus + Grafana** 的监控方案，配合 **Node Exporter** 和 **cAdvisor** 进行数据采集。

### 第一步：在被监控节点上部署 Exporters

在所有需要监控的 Docker 宿主机（例如 `10.0.0.11`, `10.0.0.12`）上执行以下操作。

1. **启动 Node Exporter (采集宿主机指标)**

   ```
   docker run -d \
     -p 9100:9100 \
     -v "/:/host:ro,rslave" \
     --name=node_exporter \
     quay.io/prometheus/node-exporter \
     --path.rootfs /host
   ```

2. **启动 cAdvisor (采集容器指标)**

   ```
   docker run -d \
     --volume=/:/rootfs:ro \
     --volume=/var/run:/var/run:rw \
     --volume=/sys:/sys:ro \
     --volume=/var/lib/docker/:/var/lib/docker:ro \
     --publish=8080:8080 \
     --name=cadvisor \
     google/cadvisor:latest
   ```

### 第二步：在监控服务器上部署 Prometheus

在一台独立的服务器上作为监控中心。

1. **下载并解压 Prometheus**

   ```
   # 从官网下载最新版本的 Prometheus
   wget https://github.com/prometheus/prometheus/releases/download/v2.12.0/prometheus-2.12.0.linux-amd64.tar.gz
   tar xf prometheus-2.12.0.linux-amd64.tar.gz
   cd prometheus-2.12.0.linux-amd64/
   ```

2. **配置 `prometheus.yml` 文件** 修改配置文件，添加 `node_exporter` 和 `cadvisor` 的采集任务。

   ```
   global:
     scrape_interval:     15s
   
   scrape_configs:
     - job_name: 'prometheus'
       static_configs:
         - targets: ['localhost:9090']
   
     - job_name: 'node_exporter'
       static_configs:
         - targets: ['10.0.0.11:9100', '10.0.0.12:9100']
   
     - job_name: 'cadvisor'
       static_configs:
         - targets: ['10.0.0.11:8080', '10.0.0.12:8080']
   ```

3. **启动 Prometheus**

   ```
   # 在后台启动 Prometheus
   nohup ./prometheus --config.file="prometheus.yml" &
   ```

   现在可以通过 `http://<监控服务器IP>:9090` 访问 Prometheus UI。

### 第三步：在监控服务器上部署并配置 Grafana

1. **安装并启动 Grafana**

   ```
   # 下载并使用 yum 安装
   wget https://dl.grafana.com/oss/release/grafana-6.3.3-1.x86_64.rpm
   yum localinstall grafana-6.3.3-1.x86_64.rpm -y
   
   # 启动并设置开机自启
   systemctl start grafana-server
   systemctl enable grafana-server
   ```

2. **配置 Grafana**

   - **访问 Grafana**: 打开浏览器访问 `http://<监控服务器IP>:3000`，默认账号密码为 `admin` / `admin`。
   - **添加数据源**:
     - 点击左侧齿轮图标 -> `Data Sources` -> `Add data source`。
     - 选择 `Prometheus`。
     - 在 `HTTP` -> `URL` 处填写 Prometheus 的地址，例如 `http://localhost:9090`。
     - 点击 `Save & Test`，如果成功会显示绿色提示。
   - **导入 Dashboard**:
     - 点击左侧加号图标 -> `Import`。
     - 从 [Grafana 官方社区](https://grafana.com/grafana/dashboards/) 查找适用于 Node Exporter 和 Docker 的 Dashboard ID（例如 `1860` for Node Exporter, `8180` for Docker）。
     - 在输入框中粘贴 ID，点击 `Load`。
     - 在下一个页面选择你刚刚创建的 Prometheus 数据源，然后点击 `Import`。
   - 现在，你应该能看到丰富的监控图表了。

## 18. 容器运行时接口 (CRI) 的历史与生态

CRI（Container Runtime Interface）是 Kubernetes 为了实现容器运行时的“可插拔”而设计的标准接口。它的历史是 Kubernetes 从一个封闭系统走向开放生态的关键一步。

### 阶段一：混沌初开 (K8s 1.5 之前) - Kubelet 与 Docker 的紧密耦合

在 Kubernetes 项目的早期，**Docker 是唯一被支持的容器运行时**。`kubelet`（每个节点上的代理程序）的代码里，**直接硬编码了与 Docker Daemon 通信的逻辑**。这部分代码被称为 **`dockershim`**。

```
+-----------------+      +-----------------+
|     Kubelet     |----->|  Docker Daemon  |
| (内置dockershim) |      +-----------------+
+-----------------+
```

- **优点**: 简单直接，能用就行。
- **致命缺点**: **紧密耦合**。如果想支持另一个容器运行时（如 `rkt`），就必须在 `kubelet` 的核心代码里再写一套逻辑，这使得 `kubelet` 越来越臃肿，难以维护。

### 阶段二：标准诞生 (K8s 1.5) - CRI 接口的出现

为了解耦，Kubernetes 社区推出了 **CRI**。CRI 本质上是一份**“标准合同”**（一个基于 gRPC 的 API 规范），它定义了 `kubelet` 与容器运行时之间的所有交互操作（如创建 Pod、启动/停止容器等）。

从此，`kubelet` 不再关心底层具体是谁在干活，它只负责向一个符合 CRI 标准的 **“CRI Shim”** (适配器) 发送标准指令。

```
+---------+      +-----------+      +-----------------+
| Kubelet |----->|  CRI Shim |----->| Container Runtime |
+---------+      +-----------+      +-----------------+
```

这就像是发明了 **USB 接口**。以前每种设备都有自己的接口，后来有了 USB 标准，电脑只需要提供标准的 USB 口，设备自己负责适配，大大增强了扩展性。

### 阶段三：生态成熟与 `dockershim` 的移除 (K8s 1.24)

CRI 标准催生了多个优秀的容器运行时实现，它们可以直接与 `kubelet` 对话：

- **containerd**: 从 Docker 项目中剥离出来的核心容器管理组件，通过一个 `cri-containerd` 插件原生支持 CRI。它成为了事实上的行业标准。
- **CRI-O**: 由 Red Hat 主导，一个纯粹为 Kubernetes CRI 标准而生的、轻量级的容器运行时。

随着这些原生 CRI 运行时的成熟，维护 `kubelet` 内部的 `dockershim` 代码成了一个历史包袱。因此，Kubernetes 社区在 **1.24 版本中，将 `dockershim` 的代码从 `kubelet` 中彻底移除**。

这一举动并不意味着“Kubernetes 不再支持 Docker”，而是：

1. **推荐直接使用 `containerd` 或 `CRI-O`** 作为运行时，因为它们更高效、更轻量。
2. 如果仍需使用完整的 Docker Engine，可以安装一个由社区维护的、独立于 `kubelet` 的适配器 `cri-dockerd`。

**总结：CRI 的历史是 Kubernetes 从依赖单一实现走向一个开放、标准化的接口，最终实现了容器运行时的可插拔，为整个云原生生态的繁荣奠定了基础。**