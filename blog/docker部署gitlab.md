[TOC]

# docker部署gitlab

### 现状

> 因为150为新购买机器，出现过系统故障，为保险起见，gitlab暂时在宗工的vmware虚拟机中运行，但公司节假日所有设备直接断电，vmware虚拟机会直接出现磁盘故障，无法开机，或者数据未落盘现象，导致数据丢失。所以目前需要将gitlab 转移到另一台123主机



### 123主机状况

|                  |                                                              | 备注                                                   |
| :--------------: | ------------------------------------------------------------ | ------------------------------------------------------ |
|      **IP**      | 192.168.22.123                                               |                                                        |
|   **系统版本**   | centos8                                                      |                                                        |
| **gitlab兼容性** | gitlab已经不对centos8做免费支持，且官网已经无适配的gitlab版本 | 使用与宗工虚拟机中相同的docker版本部署 **10.0.0-ce.0** |
|  **gitlab端口**  | 8090                                                         |                                                        |
|   **备份策略**   | 每日全备                                                     | 备份脚本在宝塔面板的计划任务中                         |



### 部署

####  1. 在dockerhub官网找到相同版本

```bash
[root@localhost backups]# docker images |grep gitlab
gitlab/gitlab-ce                                    10.0.0-ce.0                    3e69c420577a   7 years ago     1.28GB
```



#### 2. 规划本地目录与挂载目录和端口

```bash
# 1. 容器与本机的路径映射关系
	# 配置文件路径
	容器  /etc/gitlab
	本机  /home/gitlab/config
	# 日志路径
	容器  /var/log/gitlab
	本机  /home/gitlab/logs
	# 数据路径（含备份数据）
	容器  /var/opt/gitlab
	本机  /home/gitlab/data
# 2. 容器与本机的端口映射关系 提前规划
	# 提前配置好https端口
	容器 443
	本机 443
	# web页面访问地址
	容器 8090
	本机 8090
	# ssh互信地址
	容器 22
	本机 222

```

#### 3. 启动gitlab容器

```bash
[root@localhost ]# docker run --detach --hostname gitlab --publish 443:443 --publish 8090:8090 --publish 222:22 --cpus=4 -m 8G --memory-swap -1 --name gitlab --restart always -v /home/gitlab/config:/etc/gitlab -v /home/gitlab/logs:/var/log/gitlab -v /home/gitlab/data:/var/opt/gitlab gitlab/gitlab-ce:10.0.0-ce.0

# 命令解析
--cpus=4 -m 8G --memory-swap -1  限制资源 4c 8G 禁用swap分区
--name gitlab                    容器名称为gitlab
--restart always                 容器挂掉之后总是自动重启
```

#### 4.宝塔面板放行端口

![1749448329449](https://linuxergx.github.io/img/1749448329449.png)

#### 5. 修改配置文件设置备份策略

```bash
# 服务启动之后配置文件路径为/home/gitlab/config/gitlab.rb
[root@localhost backups]# grep -Ev "^$|^#" /home/gitlab/config/gitlab.rb
external_url 'http://192.168.22.123:8090'                          #指定本机访问地址
gitlab_rails['gitlab_ssh_host'] = '192.168.22.123'                 # 指定ssh主机
gitlab_rails['manage_backup_path'] = true                          #开启备份策略
gitlab_rails['backup_path'] = "/var/opt/gitlab/backups"            #设置备份路径（注意实际挂载位置）
gitlab_rails['backup_archive_permissions'] = 0644                  #目录权限
gitlab_rails['gitlab_shell_ssh_port'] = 222                        #本地的ssh端口


# 修改完重新载入docker配置
[root@localhost backups]# /usr/bin/docker exec  gitlab /bin/bash -c 'gitlab-ctl reconfigure'
```

### 备份与还原

#### 备份脚本

```bash
[root@localhost backups]# cat backup.sh 
#!/bin/bash
#source /etc/profile
# 使用绝对路径执行docker 取消 -it选项 否则执行定时任务时 crontab无法拉起一个终端，会自动推出执行
/usr/bin/docker exec  gitlab /bin/bash -c 'gitlab-rake gitlab:backup:create' >> /home/gitlab/logs/backup.log
#查找到当天生成的全备tar包，并转移到/NAS/git下 且找到本地7天以前的全备数据删掉
find /home/gitlab/data/backups -name *`date +%Y_%m_%d`*.tar -exec cp {} /NAS/git \; && find /home/gitlab/data/backups -name *.tar -mtime +7 -exec rm -f {} \;

```

#### 定时执行策略

> 放到宝塔面板的计划任务中，设置每天3点半执行

![1749448989286](https://linuxergx.github.io/img/1749448989286.png)

#### 还原策略

```bash
每日备份全在内网的/NAS/git下 ，找到想要还原的数据放到123主机的/home/gitlab/data/backups的目录下
# 先停止写入
[root@localhost backups]# docker exec -it  gitlab /bin/bash -c 'gitlab-ctl stop unicron'
[root@localhost backups]# docker exec -it  gitlab /bin/bash -c 'gitlab-ctl stop sidekiq'
[root@localhost backups]# docker exec -it  gitlab /bin/bash -c 'gitlab-ctl stop nginx'
# 指定恢复备份的名字 不带tar结尾 只需要写时间戳即可，服务会自行解压
docker exec -it gitlab /bin/bash -c 'gitlab-rake gitlab:backup:restore BACKUP=1749205619_2025_06_06_10.0.0'

## 恢复期间内存与cpu占用会较高，恢复之后请根据gitlab的内容提示进行检查
# 检查恢复情况
[root@localhost backups]# docker exec -it  gitlab /bin/bash -c 'gitlab-rake gitlab：check SANITIZE=true'
# 检查gitlab状态
[root@localhost backups]# docker exec -it  gitlab /bin/bash -c 'gitlab-rake gitlab:check SANITIZE=true'

#重启gitlab
[root@localhost backups]# docker exec -it  gitlab /bin/bash -c 'gitlab-ctl restart'
```

### 容易踩坑的风险项

* gitlab默认的仓库目录与备份路径全在/var/opt/gitlab/下，如果主机`/` 空间不足 很容易备份或恢复失败，造成缺少数据的情况发生

  

```bash
[root@localhost data]# df -h
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda3        18G  9.3G  8.5G  53% /
# 此时/ 目录下只有8.5个G 最多备份一到两次 就会满
devtmpfs        3.8G     0  3.8G   0% /dev
tmpfs           3.9G  4.0K  3.9G   1% /dev/shm
tmpfs           3.9G   13M  3.8G   1% /run
tmpfs           3.9G     0  3.9G   0% /sys/fs/cgroup
/dev/sda1       297M  157M  140M  53% /boot
tmpfs           781M   12K  781M   1% /run/user/42
tmpfs           781M     0  781M   0% /run/user/0
/dev/sdb1        20G   11G  7.7G  59% /data
# 主机默认的仓库目录与备份路径全在/var/opt/gitlab/下
[root@localhost data]# ll /var/opt/gitlab/
total 8
drwx------.  2 git               root         6 Apr 14  2023 backups
-rw-------.  1 root              root        38 Apr 14  2023 bootstrapped
drwx------.  2 git               root        46 Jun  4 04:06 gitaly
drwx------.  3 git               root        26 Jun  4 03:22 git-data
drwxr-xr-x.  7 git               root       120 Jun  4 04:06 gitlab-ci
drwxr-xr-x.  2 git               root        32 Jun  4 03:48 gitlab-monitor
drwxr-xr-x. 13 git               root       264 Jun  4 04:06 gitlab-rails
drwx------.  2 git               root        24 Jun  4 03:48 gitlab-shell
drwxr-x---.  2 git               gitlab-www  54 Jun  4 04:06 gitlab-workhorse
drwx------.  3 root              root        71 Jun  4 04:16 logrotate
drwxr-x---.  9 root              gitlab-www 163 Jun  4 04:06 nginx
drwxr-xr-x.  3 root              root        32 Apr 14  2023 node-exporter
drwx------.  2 gitlab-psql       root        26 Jun  4 03:48 postgres-exporter
drwxr-xr-x.  3 gitlab-psql       root        81 Jun  4 04:06 postgresql
drwxr-x---.  3 gitlab-prometheus root        40 Jun  4 03:48 prometheus
drwxr-x---.  2 gitlab-redis      git         82 Jun  4 04:21 redis
-rw-r--r--.  1 root              root        40 Apr 14  2023 trusted-certs-directory-hash

```



