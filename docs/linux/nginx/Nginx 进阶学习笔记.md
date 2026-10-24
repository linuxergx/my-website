# Nginx 进阶学习笔记

### 第一部分：Nginx 基础入门

## 1. Nginx 是什么？

Nginx 是一款高性能的 HTTP 和反向代理 Web 服务器，同时也提供了 IMAP/POP3/SMTP 服务。它以其高并发、低内存消耗和稳定性而闻名。

## 2. Nginx 的优势与应用场景

- **优势**: 高并发连接、内存消耗少、配置简单、成本低廉、稳定性高。
- **应用场景**:
  - 静态 Web 服务器
  - 反向代理
  - 负载均衡
  - 缓存服务
  - 动静分离
  - API 网关

## 3. 安装 Nginx

推荐使用官方 YUM 源进行安装，这样可以确保软件包的稳定性和及时的更新。

**配置 Nginx 官方 YUM 源**:

```
# cat /etc/yum.repos.d/nginx.repo
[nginx-stable]
name=nginx stable repo
baseurl=http://nginx.org/packages/centos/$releasever/$basearch/
gpgcheck=1
enabled=1
gpgkey=https://nginx.org/keys/nginx_signing.key
module_hotfixes=true
```

**安装命令**:

```
yum install nginx -y
```

## 4. Nginx 核心配置文件详解

Nginx 的主配置文件是 `/etc/nginx/nginx.conf`，它由多个配置块组成。

```
# 全局块
user  nginx; # Nginx 进程的运行用户
worker_processes  auto; # Worker 进程数，建议设置为 CPU 核心数

error_log  /var/log/nginx/error.log warn; # 错误日志路径和级别
pid        /var/run/nginx.pid; # PID 文件路径

# events 块：配置网络连接相关的参数
events {
    worker_connections  1024; # 每个 worker 进程能接受的最大连接数
    use epoll; # 使用 epoll 事件驱动模型
}

# http 块：配置 HTTP 服务器的主要参数
http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # 日志格式定义
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile        on;
    tcp_nopush      on;
    keepalive_timeout  65;

    # 包含其他配置文件，实现模块化管理
    include /etc/nginx/conf.d/*.conf;
    
    # server 块：定义一个虚拟主机
    server {
        listen       80;
        server_name  localhost;

        location / {
            root   /usr/share/nginx/html;
            index  index.html index.htm;
        }
    }
}
```

## 5. Nginx 虚拟主机配置

Nginx 可以通过三种方式实现虚拟主机，即在一台服务器上运行多个网站。

- **基于域名**: 最常用，通过 `server_name` 指令区分不同的网站。
- **基于端口**: 通过 `listen` 指令监听不同的端口来区分。
- **基于 IP**: 通过 `listen` 指令监听不同的 IP 地址来区分。

**基于域名的虚拟主机示例**: 在 `/etc/nginx/conf.d/` 目录下创建 `game.oldxu.com.conf`：

```
server {
    listen 80;
    server_name game.oldxu.com;

    location / {
        root /code/game;
        index index.html;
    }     
}
```

再创建 `blog.oldxu.com.conf`：

```
server {
    listen 80;
    server_name blog.oldxu.com;

    location / {
        root /code/blog;
        index index.html;
    }
}
```

### 第二部分：Nginx 核心功能进阶

## 6. Location 块匹配规则与优先级

`location` 块用于匹配请求的 URI，并为其指定相应的处理方式。

| 匹配符 | 规则                       | 优先级   |
| ------ | -------------------------- | -------- |
| `=`    | 精确匹配                   | 1 (最高) |
| `^~`   | 前缀匹配（匹配后停止搜索） | 2        |
| `~`    | 区分大小写的正则匹配       | 3        |
| `~*`   | 不区分大小写的正则匹配     | 4        |
| `/`    | 通用匹配                   | 5 (最低) |

**示例**:

```
server {
    listen 80;
    server_name location.oldxu.com;

    location = / {
        return 200 '精确匹配 /';
    }

    location ^~ /images/ {
        return 200 '匹配 /images/ 前缀';
    }

    location ~* \.(gif|jpg|jpeg)$ {
        return 200 '匹配图片后缀';
    }

    location / {
        return 200 '通用匹配';
    }
}
```

## 7. Nginx 常用模块

### autoindex 目录索引

当目录下没有找到 `index` 指令指定的文件时，以列表形式显示目录内容。

```
location /download/ {
    root /data;
    autoindex on; # 开启目录索引
    autoindex_exact_size off; # 显示文件大概大小 (KB, MB, GB)
    autoindex_localtime on;  # 显示文件的服务器本地时间
}
```

### 访问控制 (allow/deny)

基于 IP 地址进行访问控制。

```
location /admin/ {
    allow 192.168.1.0/24; # 允许内网 IP 段访问
    deny  all;             # 拒绝其他所有 IP
}
```

### 用户认证 (auth_basic)

基于用户名和密码进行访问控制。

**1. 创建密码文件**: (需要安装 `httpd-tools`)

```
yum install httpd-tools -y
htpasswd -bc /etc/nginx/auth_conf admin 123456
```

**2. Nginx 配置**:

```
location /secure/ {
    auth_basic "Restricted Area"; # 弹窗提示信息
    auth_basic_user_file /etc/nginx/auth_conf; # 密码文件路径
}
```

### 连接与请求限制

- `limit_conn_zone`: 限制来自单个 IP 的并发连接数。
- `limit_req_zone`: 限制来自单个 IP 的请求速率。

```
# 在 http 块中定义
limit_conn_zone $binary_remote_addr zone=addr:10m;
limit_req_zone $binary_remote_addr zone=req_one:10m rate=1r/s;

server {
    ...
    # 在 server 或 location 块中应用
    limit_conn addr 1; # 每个 IP 只允许 1 个并发连接
    limit_req zone=req_one burst=5 nodelay; # 每秒 1 个请求，允许 5 个突发请求
}
```

### 状态监控 (stub_status)

提供 Nginx 的基本运行状态信息。

```
location = /nginx_status {
    stub_status;
}
```

访问 `http://yourdomain/nginx_status` 即可查看。

## 8. Nginx 日志管理

- **access_log**: 记录用户访问日志。
- **error_log**: 记录错误信息。
- **log_format**: 自定义日志格式。

**常用日志变量**:

- `$remote_addr`: 客户端 IP。
- `$time_local`: 服务器本地时间。
- `$request`: 请求的 URI 和 HTTP 协议。
- `$status`: HTTP 状态码。
- `$body_bytes_sent`: 发送给客户端的 body 字节数。
- `$http_referer`: 访问来源。
- `$http_user_agent`: 客户端浏览器信息。
- `$http_x_forwarded_for`: 经过代理的真实客户端 IP。

## 9. Rewrite URL 重写

`rewrite` 指令用于修改用户请求的 URI。

**语法**: `rewrite regex replacement [flag];`

**Flag 标记**:

- `last`: 停止当前 `location` 的处理，并用重写后的 URI 重新开始搜索 `location`。
- `break`: 停止当前 `location` 的处理，不再搜索。
- `redirect`: 返回 302 临时重定向。
- `permanent`: 返回 301 永久重定向。

**示例：HTTP 自动跳转到 HTTPS**:

```
server {
    listen 80;
    server_name www.oldxu.com;
    return 301 https://$server_name$request_uri;
}
```

### 第三部分：Nginx 高级应用与架构

## 10. Nginx 反向代理

反向代理是指以代理服务器来接受客户端的连接请求，然后将请求转发给内部网络上的服务器，并将从服务器上得到的结果返回给客户端。

**配置示例**:

```
server {
    listen 80;
    server_name web.oldxu.com;

    location / {
        proxy_pass http://10.0.0.7:80; # 代理到后端的 Web 服务器
        
        # 传递客户端真实 IP 和 Host
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 11. Nginx 负载均衡 (Load Balancing)

### 负载均衡概念

负载均衡是反向代理的一种扩展，它可以将客户端请求分发到多台后端服务器上，从而提高网站的性能、可用性和扩展性。

**配置示例**:

```
# 在 http 块中定义一个上游服务器组
upstream web_servers {
    server 172.16.1.7:80;
    server 172.16.1.8:80;
}

server {
    listen 80;
    server_name web.oldxu.com;

    location / {
        proxy_pass http://web_servers; # 代理到服务器组
        include proxy_params; # 包含通用的代理参数
    }
}
```

### 负载均衡调度算法

| 算法            | 描述                                                         |
| --------------- | ------------------------------------------------------------ |
| **轮询 (默认)** | 按顺序逐一分配到后端服务器。                                 |
| **weight**      | 加权轮询，权重越高的服务器被分配的几率越大。                 |
| **ip_hash**     | 根据请求的源 IP 进行哈希，确保同一客户端的请求总是被发送到同一台服务器。 |
| **url_hash**    | 根据请求的 URL 进行哈希，可用于后端缓存。                    |
| **least_conn**  | 将请求分配给当前连接数最少的服务器。                         |

### 后端服务器状态

| 状态             | 描述                                                   |
| ---------------- | ------------------------------------------------------ |
| **down**         | 标记服务器为不可用，不参与负载均衡。                   |
| **backup**       | 标记为备份服务器，只有在所有主服务器都宕机时才会启用。 |
| **max_fails**    | 允许请求失败的次数，默认为 1。                         |
| **fail_timeout** | 在达到 `max_fails` 次数后，暂停服务的时间。            |
| **max_conns**    | 限制同时连接到该服务器的最大连接数。                   |

### 健康检查与故障转移

当后端服务器返回 5xx 或 404 等错误码时，Nginx 可以自动将请求转发到另一台健康的服务器上。

```
location / {
    proxy_pass http://web_servers;
    proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
}
```

## 12. 动静分离与 PHP 解析

动静分离是指将网站的静态资源（如图片、CSS、JS）和动态请求（如 PHP）分开处理，以提高性能。

```
server {
    listen 80;
    server_name php.oldxu.com;
    root /code;
    index index.php index.html;

    # 匹配静态文件，直接返回
    location ~* \.(jpg|jpeg|gif|png|css|js)$ {
        expires 30d; # 设置浏览器缓存时间
    }

    # 匹配 PHP 文件，转发给 PHP-FPM 处理
    location ~ \.php$ {
        fastcgi_pass   127.0.0.1:9000;
        fastcgi_index  index.php;
        fastcgi_param  SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include        fastcgi_params;
    }
}
```

## 13. HTTPS 配置与 SSL 证书

### HTTPS 工作流程

1. **客户端** 发起 HTTPS 请求。
2. **服务器** 返回包含其公钥的 SSL 证书。
3. **客户端** 验证证书的有效性。
4. **客户端** 生成一个随机的对称密钥，并用服务器的公钥加密后发送给服务器。
5. **服务器** 用自己的私钥解密，得到对称密钥。
6. 后续双方使用这个对称密钥进行加密通信。

### Nginx 配置 HTTPS

```
server {
    listen 443 ssl;
    server_name www.oldxu.com;

    ssl_certificate      /etc/nginx/ssl/server.crt; # 证书文件
    ssl_certificate_key  /etc/nginx/ssl/server.key; # 私钥文件

    ssl_session_cache    shared:SSL:1m;
    ssl_session_timeout  5m;

    ssl_ciphers  HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers  on;

    location / {
        root /code/ssl;
        index index.html;
    }
}
```

## 14. 高可用方案：Nginx + Keepalived

### 高可用与 Keepalived 原理

高可用 (High Availability) 是指通过设计减少系统不能提供服务的时间。Keepalived 是一款基于 VRRP 协议的软件，常用于实现 Nginx、LVS 等服务的高可用。它通过一个虚拟 IP (VIP) 在两台服务器之间漂移，当主服务器故障时，备用服务器会自动接管 VIP，从而实现服务的无缝切换。

### Keepalived 核心概念

- **选举**: 通过 `priority` (优先级) 选举出 Master 节点。
- **抢占模式**: 当 Master 节点恢复后，会自动抢回 VIP。
- **非抢占模式**: Master 恢复后不抢回 VIP，直到 Backup 节点也故障。
- **脑裂**: 由于网络问题导致两台服务器都认为自己是 Master，都占用了 VIP，可以通过心跳线或仲裁机制解决。

### Keepalived 安装与配置

**1. 安装**:

```
yum install keepalived -y
```

**2. Master (lb01) 配置**: `/etc/keepalived/keepalived.conf`

```
global_defs {
   router_id lb01
}

vrrp_instance VI_1 {
    state MASTER
    interface eth0
    virtual_router_id 50
    priority 150
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass 1111
    }
    virtual_ipaddress {
        10.0.0.3 # 虚拟 IP
    }
}
```

**3. Backup (lb02) 配置**:

```
global_defs {
   router_id lb02
}

vrrp_instance VI_1 {
    state BACKUP
    interface eth0
    virtual_router_id 50
    priority 100
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass 1111
    }
    virtual_ipaddress {
        10.0.0.3
    }
}
```

**4. 启动服务**:

```
systemctl start keepalived
systemctl enable keepalived
```