# Ansible 学习笔记 

## 目录

[TOC]

## 1. Ansible 核心概念

### Ansible 是什么？

Ansible 是一款极为流行的开源 IT 自动化工具。它可以用来配置系统、部署软件、编排更高级的 IT 任务，如持续部署或零停机滚动更新。它的目标是实现简洁、易读和高效。

### 核心优势

- **简单易读**: 使用 YAML 语言编写 Playbook，结构清晰，接近自然语言。
- **无客户端 (Agentless)**: 无需在被管理节点上安装任何客户端或代理软件，通过标准的 SSH 协议进行通信，大大降低了维护成本。
- **模块化**: 拥有数千个内置模块，覆盖了从系统管理到云服务编排的各种场景。
- **幂等性 (Idempotency)**: 这是 Ansible 的一个核心特性。一个操作无论执行多少次，其结果都是相同的。例如，一个创建用户的任务，如果用户已存在，Ansible 不会再次创建或报错，而是确认状态符合预期。

### 基本架构

- **控制节点 (Control Node)**: 任何安装了 Ansible 的机器。所有指令都从这里发出。
- **被管理节点 (Managed Nodes)**: 被 Ansible 管理的服务器，也称为 "targets"。
- **Inventory**: 一个定义了被管理节点列表的文件，可以对主机进行分组和分类。
- **Modules**: Ansible 执行任务的基本单元，例如 `yum` 模块用于包管理，`copy` 模块用于文件复制。
- **Playbooks**: 自动化的“剧本”，由一个或多个“Play”组成，定义了 Ansible 要在被管理节点上执行的一系列有序任务。

## 2. 安装与环境配置

### 安装 Ansible

推荐使用系统的包管理器进行安装。

```
# 在 CentOS/RHEL 上安装
sudo yum install -y ansible

# 在 Ubuntu/Debian 上安装
sudo apt-get update
sudo apt-get install -y ansible
```

### 核心配置文件 `ansible.cfg`

Ansible 的行为可以通过 `ansible.cfg` 文件进行配置。Ansible 会按以下顺序查找该文件，并使用找到的第一个：

1. 环境变量 `ANSIBLE_CONFIG` 指定的路径。
2. 当前目录下的 `./ansible.cfg`。
3. 用户家目录下的 `~/.ansible.cfg`。
4. 全局默认的 `/etc/ansible/ansible.cfg`。

一个基础的 `ansible.cfg` 示例如下：

```
[defaults]
# 指定默认的 inventory 文件路径
inventory      = /etc/ansible/hosts
# 指定远程执行命令的用户
remote_user    = root
# 关闭首次连接时的 host key 检查，建议仅在安全内网环境中使用
host_key_checking = False
# 开启日志记录
log_path       = /var/log/ansible.log

[privilege_escalation]
# 配置权限提升，例如使用 sudo
become=True
become_method=sudo
become_user=root
become_ask_pass=False
```

### 主机清单 `Inventory`

Inventory 文件（默认为 `/etc/ansible/hosts`）定义了 Ansible 管理的主机。

```
# /etc/ansible/hosts

# 定义一个名为 webservers 的组
[webservers]
web01 ansible_host=192.168.1.10
web02 ansible_host=192.168.1.11

# 定义一个名为 databases 的组
[databases]
db01 ansible_host=192.168.1.20

# 可以在主机清单中直接定义连接变量
[special_server]
server_x ansible_host=192.168.1.30 ansible_user=admin ansible_ssh_pass='your_password' ansible_ssh_port=2222

# 也可以定义一个包含其他组的组
[datacenter:children]
webservers
databases
```

## 3. Ad-Hoc 临时命令

Ad-Hoc 命令用于执行快速、一次性的任务，非常适合进行一些简单的检查或操作。

### 命令格式

```
ansible <host-pattern> -m <module_name> -a "<arguments>"
```

- `<host-pattern>`: 主机模式，可以是 `all`、单个主机名、一个组名等。
- `-m`: 指定要使用的模块。
- `-a`: 模块的参数。

### 常用模块详解与示例

### `command` & `shell` 模块

用于在远程主机上执行命令。**强烈建议优先使用 `shell` 模块**，因为它支持管道 (`|`)、重定向 (`>`) 等 shell 特性。

#### 示例

```
# 检查所有主机的磁盘使用情况
ansible all -m shell -a "df -h"

# 查看 webservers 组中 nginx 进程的状态
ansible webservers -m shell -a "ps aux | grep nginx"
```

### `yum` 模块

用于在基于 RHEL 的系统上管理软件包。

#### 常用参数

- `name`: 软件包名称。
- `state`: 状态，可选值为 `present` (确保安装)、`latest` (确保是最新版)、`absent` (确保卸载)。
- `enablerepo`: 安装时临时启用指定的 YUM 仓库。

#### 示例

```
# 确保 httpd 已安装
ansible webservers -m yum -a "name=httpd state=present"

# 确保 httpd 是最新版本
ansible webservers -m yum -a "name=httpd state=latest"

# 卸载 httpd
ansible webservers -m yum -a "name=httpd state=absent"
```

### `copy` & `template` 模块

`copy` 模块用于将文件从控制节点复制到被管理节点。`template` 模块功能类似，但它会先使用 Jinja2 模板引擎对文件进行渲染。

#### 常用参数

- `src`: 源文件路径（在控制节点上）。
- `dest`: 目标文件路径（在被管理节点上）。
- `owner`: 文件所有者。
- `group`: 文件所属组。
- `mode`: 文件权限。
- `backup`: 在覆盖前是否创建备份，值为 `yes` 或 `no`。

#### 示例

```
# 复制本地的 nginx.conf 文件到所有 web 服务器，并创建备份
ansible webservers -m copy -a "src=/path/to/local/nginx.conf dest=/etc/nginx/nginx.conf owner=nginx group=nginx mode=0644 backup=yes"
```

### `file` 模块

用于设置文件和目录的属性，或创建/删除它们。

#### 常用参数

- `path`: 要操作的文件或目录路径。
- `state`: 状态，可选值为 `directory` (目录)、`touch` (文件)、`link` (软链接)、`absent` (删除)。
- `owner`, `group`, `mode`: 文件/目录的权限属性。
- `src`, `dest`: 当 `state=link` 时，用于指定源和目标。

#### 示例

```
# 创建一个目录
ansible all -m file -a "path=/data/app state=directory owner=app_user group=app_group mode=0755"

# 创建一个软链接
ansible all -m file -a "src=/data/app/config.yml dest=/etc/app.conf state=link"

# 删除一个文件
ansible all -m file -a "path=/tmp/old_file state=absent"
```

### `systemd` / `service` 模块

用于管理系统服务。推荐在新系统上使用 `systemd` 模块。

#### 常用参数

- `name`: 服务名称 (例如 `nginx`)。
- `state`: 状态，可选值为 `started`, `stopped`, `restarted`, `reloaded`。
- `enabled`: 是否设置开机自启，值为 `yes` 或 `no`。

#### 示例

```
# 启动 nginx 服务并设置开机自启
ansible webservers -m systemd -a "name=nginx state=started enabled=yes"

# 重启 nginx 服务
ansible webservers -m systemd -a "name=nginx state=restarted"
```

### `group` & `user` 模块

用于管理用户和组。

#### 常用参数 (`user` 模块)

- `name`: 用户名。
- `state`: `present` (创建) 或 `absent` (删除)。
- `group`: 用户的主组。
- `groups`: 用户的附加组。
- `shell`: 用户的登录 Shell。
- `remove`: 当 `state=absent` 时，是否删除用户的家目录。

#### 示例

```
# 创建一个名为 'developers' 的组
ansible all -m group -a "name=developers state=present"

# 创建一个名为 'new_user' 的用户，并将其加入 'developers' 组
ansible all -m user -a "name=new_user comment='New Developer' group=developers shell=/bin/bash"

# 删除用户及其家目录
ansible all -m user -a "name=old_user state=absent remove=yes"
```

### `mount` 模块

用于管理文件系统挂载。

#### 常用参数

- `path`: 挂载点路径。
- `src`: 源设备或地址。
- `fstype`: 文件系统类型 (例如 `nfs`, `xfs`)。
- `state`: `mounted` (挂载并写入 fstab)、`present` (仅写入 fstab)、`unmounted` (卸载)。

#### 示例

```
# 挂载 NFS 共享，并确保写入 /etc/fstab
ansible webservers -m mount -a "path=/mnt/nfs_share src=192.168.1.100:/exports/data fstype=nfs state=mounted"
```

## 4. Playbook 剧本

Playbook 是 Ansible 的核心，它允许你定义复杂、可重复的自动化流程。

### YAML 语法基础

Playbook 使用 YAML 格式编写，非常注重格式。

- 文件以 `---` 开头。
- **缩进**: 使用两个空格表示层级关系，**严禁使用 Tab**。
- **键值对**: 使用冒号 (`:`) 分隔，冒号后必须有一个空格。
- **列表**: 列表中的每个项都以 `- ` (短横线 + 空格) 开头。

### Playbook 核心组件

- **`hosts`**: 定义这个 Play 将在哪组主机上执行。
- **`tasks`**: 任务列表，按顺序执行。
- **`name`**: 每个 Play 和 Task 都可以有一个描述性的名称，会在执行时显示。

### 第一个 Playbook 示例

下面是一个完整的 Playbook，用于在 `webservers` 组的所有主机上安装并启动 Nginx。

`deploy_nginx.yml`:

```
---
- hosts: webservers
  become: yes
  tasks:
    - name: Ensure nginx is at the latest version
      yum:
        name: nginx
        state: latest

    - name: Start and enable nginx service
      systemd:
        name: nginx
        state: started
        enabled: yes
```

执行这个 Playbook:

```
ansible-playbook deploy_nginx.yml
```

## 5. 变量 (Variables)

变量使得 Playbook 更加灵活和可重用。

### 变量的定义方式

1. **在 Playbook 中使用 `vars` 关键字**:

   ```
   - hosts: webservers
     vars:
       package_name: httpd
     tasks:
       - name: Install package
         yum:
           name: "{{ package_name }}"
           state: present
   ```

2. **使用 `group_vars` 和 `host_vars` 目录**: 这是最推荐的组织变量的方式。在 Playbook 所在目录创建 `group_vars` 或 `host_vars` 目录。

   - `group_vars/webservers.yml` 中的变量会对 `webservers` 组生效。
   - `host_vars/web01.yml` 中的变量只对 `web01` 主机生效。

3. **在命令行中传递**:

   ```
   ansible-playbook my_playbook.yml --extra-vars "user=admin"
   ```

### Facts 系统变量

Ansible 会在运行 Playbook 之前自动收集被管理节点的系统信息，这些信息被称为 "Facts"，可以直接作为变量使用。

- `{{ ansible_hostname }}`: 主机名
- `{{ ansible_distribution }}`: 发行版名称 (如: CentOS)
- `{{ ansible_distribution_major_version }}`: 主版本号 (如: 7)
- `{{ ansible_default_ipv4.address }}`: 默认的 IPv4 地址

### 变量优先级

如果一个变量在多个地方被定义，Ansible 会根据优先级来决定使用哪个值。**命令行 `--extra-vars` 的优先级最高**。

## 6. 任务控制与逻辑

### 循环 (`loop`)

用于对一个列表进行迭代，执行相同的任务。

```
- name: Create multiple users
  user:
    name: "{{ item }}"
    state: present
  loop:
    - user1
    - user2
    - user3
```

### 条件判断 (`when`)

允许你根据条件来决定是否执行一个任务。

```
- name: Install Apache on CentOS
  yum:
    name: httpd
    state: present
  when: ansible_distribution == "CentOS"

- name: Install Apache on Debian
  apt:
    name: apache2
    state: present
  when: ansible_distribution == "Debian"
```

### 触发器 (`handlers` & `notify`)

Handlers 是特殊的任务，它们只有在被 `notify` 指令“通知”时才会被执行，并且在所有普通任务执行完毕后**只会执行一次**，即使被多次通知。这通常用于配置文件更改后重启服务。

```
- hosts: webservers
  tasks:
    - name: Copy nginx config file
      copy:
        src: nginx.conf
        dest: /etc/nginx/nginx.conf
      notify: Restart Nginx

  handlers:
    - name: Restart Nginx
      systemd:
        name: nginx
        state: restarted
```

### 标签 (`tags`)

可以为任务打上标签，以便在运行时选择性地执行或跳过某些任务。

```
tasks:
  - name: Install packages
    yum:
      name: httpd
    tags:
      - packages

  - name: Configure httpd
    template:
      src: httpd.conf.j2
      dest: /etc/httpd/conf/httpd.conf
    tags:
      - configuration
```

- 只运行配置任务: `ansible-playbook playbook.yml --tags "configuration"`
- 跳过配置任务: `ansible-playbook playbook.yml --skip-tags "configuration"`

### 错误处理

- **`ignore_errors: yes`**: 如果一个任务失败，Playbook 会中断。使用此选项可以让 Playbook 忽略该任务的失败并继续执行。
- **`force_handlers: yes`**: 即使有任务失败，也要强制执行被通知的 handlers。

## 7. 模板引擎 (Jinja2)

Ansible 使用 Jinja2 模板引擎，允许你在文件中使用变量、循环和条件判断。模板文件通常以 `.j2` 结尾。

`httpd.conf.j2`:

```
Listen {{ http_port | default(80) }}

<VirtualHost *:{{ http_port | default(80) }}>
    ServerName {{ ansible_hostname }}
</VirtualHost>
```

在 Playbook 中使用 `template` 模块来部署它：

```
- name: Deploy httpd config from template
  template:
    src: templates/httpd.conf.j2
    dest: /etc/httpd/conf/httpd.conf
```

## 8. 角色 (Roles)

### Roles 的作用

当 Playbook 变得越来越复杂时，Roles 提供了一种组织和复用自动化内容的机制。它将一个 Playbook 拆分成多个目录，分别存放变量、任务、模板等。

### Roles 目录结构

一个标准的 Role（例如 `nginx`）目录结构如下：

```
roles/
└── nginx/
    ├── tasks/          # 存放任务文件，main.yml 是主入口
    ├── handlers/       # 存放 handlers 文件
    ├── templates/      # 存放模板文件 (.j2)
    ├── files/          # 存放需要 copy 的静态文件
    ├── vars/           # 存放该角色的变量
    └── defaults/       # 存放该角色的默认变量（优先级最低）
```

### 如何使用 Roles

在你的主 Playbook 文件中，通过 `roles` 关键字来调用一个或多个 Role。

`site.yml`:

```
---
- hosts: webservers
  roles:
    - common      # 应用一个通用的基础配置 Role
    - nginx       # 应用 Nginx Role

- hosts: databases
  roles:
    - common
    - mariadb
```

## 9. 常见问题与排错

- **SSH 连接失败**:
  - `"UNREACHABLE! => {"changed": false, "msg": "Failed to connect to the host via ssh..."}`
  - **排查**: 确保控制节点能免密 SSH 登录到目标主机。检查 IP、端口、用户名是否正确。可以手动执行 `ssh user@host` 进行测试。
- **YAML 语法错误**:
  - `"Syntax Error while loading YAML."`
  - **排查**: 仔细检查缩进（必须是空格），冒号后的空格，以及短横线的格式。
- **权限不足**:
  - `"fatal: [hostname]: FAILED! => {"msg": "permission denied"}`
  - **排查**: 确认执行任务的用户（`remote_user`）有足够的权限。如果需要 `root` 权限，请在 Playbook 或 `ansible.cfg` 中配置 `become: yes`。