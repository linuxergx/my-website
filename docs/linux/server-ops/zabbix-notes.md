---
format: md
sidebar_position: 3
title: Zabbix 笔记
---

ZABBIX安装配置流程Zabbix 介绍架构原理配置要求硬件内存和磁盘CPU其他硬件硬件资源配置参考受支持的平台软件数据库管理系统前端客户端浏览器ServerJava gateway数据库容量时间同步zabbix生产环境安装监控一台服务器主机添加主机和监控模板添加主界面CPU和可用内存仪表盘设置监控界面添加可用内存界面添加报警脚本手动测试添加钉钉机器人创建报警媒介类型添加中间件模板elasticsearchredis添加自定义中间件模板与测试xxl-jobk8s的pod异常状态其他中间件 nacos、jenkins、zookeeper在zabbix界面配置监控项和触发器导入模板在主机上添加模板自定义监控项在界面配置模板创建监控项配置监控项自定义监控项示例配置触发器web监测监控平台配置web监测

## ZABBIX安装配置流程

## Zabbix 介绍

zabbix 是一个开源的分布式监控系统，其实现了数据采集、实时图形、web监控等功能。具体介绍可参考中文官方文档：https://www.zabbix.com/documentation/4.0/zh/manual/introduction/features

其他文档可参考Zabbix中文手册： https://zabbix-manual-in-chinese.readthedocs.io/en/latest/

## 架构原理

![](/img/zabbix/56a5baf90f22d16e298e51eb4aeff3e66ba9708bb723418860d434fdb16f24f7.jpg)

配置要求

## 硬件

## 内存和磁盘

Zabbix 运行需要物理内存和磁盘空间。如果刚接触 Zabbix，128 MB 的物理内存和 256 MB 的可用磁盘空间可能是一个很好的起点。 然而，所需的内存和磁盘空间显然取决于被监控的主机数量和配置参数。如果您计划调整参数以保留较长的历史数据，那么您应该考虑至少有几 GB 磁盘空间，以便有足够的磁盘空间将历史数据存储在数据库中。

每个 Zabbix 守护程序进程都需要与数据库服务器建立多个连接。 为连接分配的内存量取决于数据库引擎的配置。

您拥有的物理内存越多，数据库（以及 Zabbix ）的工作速度就越快！

CPU

Zabbix，尤其是 Zabbix 数据库可能需要大量 CPU 资源，该具体取决于被监控参数的数量和所选的数据库引擎。

## 其他硬件

如果需要启用短信（SMS）通知功能，需要串行通讯口（serial communication port）和串行GSM调制解调器（serial GSM modem）。USB转串行转接器也同样可以工作。

## 硬件资源配置参考

下表提供了几个硬件配置参考：



| 规模 | 平台 | CPU/内存 | 数据库 | 受监控的主机数量 |
| --- | --- | --- | --- | --- |
| 小型 | CentOs | VirtualAppliance | MySQL InnoDB | 100 |
| 中型 | Centos | 2 CPUcores/2GB | MySQL InnoDB | 500 |
| 大型 | RedHatEnterprise Linux | 4 CPUcores/8GB | RAID10 MySQL InnoDB或PostgreSQL | >1000 |
| 极大型 | RedHat Enterprise Linux | 8 CPUcores/16GB | Fast RAID10 MySQL InnoDB 或PostgreSQL | >10000 |



实际上，Zabbix 环境的配置非常依赖于监控项（主动）和更新间隔。 如果是进行大规模部署，强烈建议将数据库独立部署。

## 受支持的平台

由于服务器操作的安全性要求和任务关键性，UNIX 是唯一能够始终如一地提供必要性能、容错和弹性的操作系统。 Zabbix以市场主流的操作系统版本运行。

经测试，Zabbix 可以运行在下列平台：

Linux .

IBM AIX

FreeBSD

NetBSD

OpenBSD

HP-UX

Mac OS X

Solaris

Windows：自 XP 以来的所有桌面和服务器版本（仅限 Zabbix agent）

Zabbix 可以在其他类 Unix 操作系统上运行。

如果使用加密编译，Zabbix将禁用核心转储（Core dumps），如果系统不允许禁用核心转储，则Zabbix 不会启动。

## 软件

Zabbix 是基于先进 Apache Web 服务器、领先的数据库引擎和 PHP 脚本语言构建的。

## 数据库管理系统



| 数据库 | 版本 | 备注 |
| --- | --- | --- |
| MySQL | 5.0.3-8.0.x | 使用MySQL作为Zabbix后端数据库。需要InnoDB引擎。MariaDB同样支持。 |
| Oracle | 10g orlater | 使用 Oracle 作为 Zabbix 后端数据库。 |
| PostgreSQL | 8.1orlater | 使用PostgreSQL作为Zabbix后端数据库。建议使用PostgreSQL8.3以上的版本，以提供更好的VACUUM性能。 |
| IBM DB2 | 9.7 orlater | 使用 DB2作为 Zabbix 后端数据库。 |
| sQLite | 3.3.5orlater | 只有 Zabbix proxy支持 SQLite，可以使用 SQLite作为 Zabbix proxy数据库。 |



值得注意的是，对于 IBM DB2 的支持是实验性的！

## 前端

Zabbix 前端需要使用下列软件:



| 软件 | 版本 | 备注 |
| --- | --- | --- |
| Apache | 1.3.12或以上 |   |
| PHP | 5.4.0或以上 |   |
| PHP扩展库： |   |   |
| g | 2.0 orlater | PHP GD 扩展库必须支持 PNG 图像(--with-png-dir)、 JPEG 图像(--with- jpeg-dir)和 FreeType2 (-with-freetype-dir). |
| bcmath |   | php-bcmath (--enable-bcmath) |
| ctype |   | php-ctype (--enable-ctype) |
| libXML | 2.6.15或以上 | php-xmlor php5-dom，如果发布者提供独立的部署包。 |
| xmlreader |   | php-xmlreader，如果发布者提供独立的部署包。 |
| xmlwriter |   | php-xmlwriter，如果发布者提供独立的部署包。 |
| session |   | php-session，如果发布者提供独立的部署包。 |
| sockets |   | php-net-socket (--enable-sockets)。用户脚本支持所需要的组件。 |
| mbstring |   | php-mbstring (--enable-mbstring) |
| gettext |   | php-gettext (--with-gettext)。用于多语言翻译支持。 |
| Idap |   | php-ldap。只有在前端使用 LDAP 认证时才需要。 |
| ibm_db2 |   | 使用 IBM DB2作为 Zabbix 后端数据库所需要的组件。 |
| mysqli |   | 使用 MySQL作为 Zabbix 后端数据库所需要的组件。 |
| oci8 |   | 使用 Oracle 作为 Zabbix 后端数据库所需要的组件。 |
| pgsql |   | 使用 PostgreSQL作为 Zabbix 后端数据库所需要的组件。 |



Zabbix 也许可以在以前的Apache、MySQL、Oracle 和 PostgreSQL 版本上运行。

值得注意的是，如果需要使用默认 DejaVu 以外的字体, 可能会需要 PHP 的 imagerotate 函数。如果缺少，则在 Zabbix 前端查看图形时显示异常。该函数只有在使用捆绑的 GD 库编译 PHP 时才可用。在Debian 和某些发行版本中，这个问题不存在。

## 客户端浏览器

浏览器必须启用 Cookies 和 Java Script 。

支持最新版本的 Google、Mozilla Firefox、Microsoft Internet Explorer 和 Opero。其他浏览器（Apple Safari、Konqueror）也许会支持。

值得注意的，为了执行 IFrame 的“同源政策”，意味着 Zabbix 不能放在不同域的 frames 中。

但是，如果放置在 frames 中的页面和 Zabbix 前端位于同一个域中，则置于 Zabbix frames 中的页面将可以访问 Zabbix 前端（通过JavaScript）。像 http://secure-zabbix.com/cms/page.html 这样的页面，如果置于 http://secure-zabbix.com/zabbix/ 的聚合图形或仪表盘上，将拥有对 Zabbix 的完整 JS 访问权限。

## Server

在 Server 中，强制性的要求总是不可避免的。而特定功能的支持则需要可选的要求。

Mandatory requirements are needed always. Optional requirements are needed for the support of the specific function.



| 需求 | 需求状态 | 描述 |
| --- | --- | --- |
| libpcre | 强制的 | Perl Compatible Regular Expression (PCRE)支持需要 PCRE库。命名可能会因 GNU/Linux发行版而不同，例如'libpcre3'或 libpcre1'。值得注意的是，您需要准确的 PCRE(v8.x)；而不使用 PCRE2(v10.x)库。 |
| libevent | 批量指标支持和 IPMI监控是必需的。需要1.4版本或更高。值得注意的是，对于 Zabbix proxy，此需求是可选的；但它对于支持 IPMI 监控是必需的。 |   |
| libpthread | 支持互斥锁和读写锁所需的。 |   |
| zlib | 支持压缩所需的。 |   |
| OpenIPMI | 可选的 | 支持IPMI所需的。 |
| libssh2 | 支持 SSH 所需的。需要 1.0版本或更高。 |   |
| fping | 支持 ICMP ping 监控项 所需的。 |   |
| libcurl | Web 监控、VMware 监控和SMTP 认证所需的。对于 SMTP认证，需要7.20.0版本或更高。同时亦是 Elasticsearch 所需的。 |   |
| libiksemel | 支持Jabber 所需的。 |   |
| libxml2 | 支持 VMware monitoring 所需的。 |   |
| net-snmp | Required for支持 SNMP 所需的。 |   |
| Requirement | Status | Description |
| libpcre | Mandatory | PCRE library is required for PerlCompatible Regular Expression (PCRE) support. The naming may differdepending on the GNU/Linux distribution,for example'libpcre3'or'libpcre1'. Notethat you need exactly PCRE(v8.x); PCRE2(v10.x) library is not used. |
| libevent | Required for bulk metricsupport and IPMImonitoring. Version 1.4 or higher. Note that for Zabbix proxy this requirement isoptional; itis needed for IPMI monitoring support. |   |
| libpthread | Required for mutex and read-write lock support. |   |
| zlib | Required for compressionsupport. |   |
| OpenIPMI | Optional | Required for IPMI support. |
| libssh2 | Required for SSH support.Version 1.0 or higher. |   |
| fping | Required for ICMP pingitems. |   |
| libcurl | Required for web monitoring, VMware monitoring and SMTP authentication. For SMTPauthentication,version7.20.0 or higher is required.Also required forElasticsearch. |   |
| libiksemel | Required for Jabbersupport. |   |
| libxml2 | Required for VMwaremonitoring. |   |
| net-snmp | Required for SNMPsupport. |   |



## Java gateway

如果从源码存储库或归档中获取 Zabbix，则在源代码树中已包含必需的依赖关系。

如果从发行包中获取 Zabbix ，则封装系统里已提供了必要的依赖关系。

在上述两种情况下，即可准备部署软件了，而不需要下载额外的依赖包。

但是，如果您希望提供这些依赖关系的版本（例如，如果您正在为某些 Linux 发行版准备软件包），则下面是 Java gateway 已知可以使用的库的版本列表。 Zabbix 也许可以与这些库的其他版本一起使用。

下表列出了原始代码中当前与 Java gateway 捆绑在一起的 JAR 文件：



| 库 | 许可 | 网站 | 备注 |
| --- | --- | --- | --- |
| logback-core-0.9.27.jar | EPL1.0,LGPL2.1 | http://logback.qos.ch/ | 0.9.27、1.0.13和1.1.1测试通过。 |
| logback-classic-0.9.27.jar | EPL1.0,LGPL2.1 | http://logback.qos.ch/ | 0.9.27、1.0.13和1.1.1测试通过。 |
| slf4j-api-1.6.1.jar | MITLicense | http://www.slf4j.org/ | 1.6.1、1.6.6和1.7.6 测试通过 |
| android- json- 4.3_r3.1.jar | ApacheLicense2.0 | https://android.googlesource.com/platform/libcore/+/master/json | 2.3.3_r1.1和4.3_r3.1测试通过。关于创建JAR 文件，详见src/zabbix_java/lib/README 说明。 |



Java gateway 使用 Java 1.6 及更高版本编译和运行。 如需要对 Java gateway 预编译版本进行编译，建议使用Java 1.6进行编译，直到最新版本。

## 数据库容量

Zabbix 配置文件数据需要固定数量的磁盘空间，且增长不大。

Zabbix 数据库大小主要取决于这些变量，这些变量决定了存储的历史数据量:

## 每秒处理值的数量

这是 Zabbix server 每秒接收的新值的平均数。 例如，如果有3000个监控项用于监控，取值间隔为60秒，则这个值的数量计算为 3000/60 = 50 。

这意味着每秒有 50 个新值被添加到 Zabbix 数据库中。

## 关于历史数据的管家设置

Zabbix 将接收到的值保存一段固定的时间，通常为几周或几个月。 每个新值都需要一定量的磁盘空间用于数据和索引。

所以，如果我们每秒收到 50 个值，且希望保留 30 天的历史数据，值的总数将大约在 (30\*243600) 50 =129.600.000，即大约 130M 个值。

根据所使用的数据库引擎，接收值的类型（浮点数、整数、字符串、日志文件等），单个值的磁盘空间可能在 40 字节到数百字节之间变化。 通常，数值类型的每个值大约为 90 个字节。

在上面的例子中，这意味着 130M 个值需要占用 130M \* 90 bytes = 10.9GB 磁盘空间。

文本和日志类型的监控项值的大小是无法确定的，但可以以每个值大约 500 字节来计算。

## 趋势数据的管家设置

Zabbix 为表 trends 中的每个项目保留1小时的最大值 / 最小值 / 平均值 / 统计值。 该数据用于趋势图形和历史数据图形。 这一个小时的时间段是无法自定义。

Zabbix数据库，根据数据库类型，每个值总共需要大约90个字节。

假设我们希望将趋势数据保持5年。 3000 个监控项的值每年需要占用 300024365\* 90 = 2.2GB 空间，或者5年需要占用 11GB 空间。

## 事件的管家设置

每个 Zabbix 事件需要大约 170 个字节的磁盘空间。 很难估计 Zabbix 每天生成的事件数量。 在最坏的情况下，假设 Zabbix 每秒生成一个事件。

这意味着如果想要保留3年的事件，这将需要占用 3\*365243600\* 170 = 15GB 的空间。

下表包含可用于计算 Zabbix 系统所需磁盘空间的公式：



| 参数 | 所需磁盘空间的计算公式 (单位：字节) |
| --- | --- |
| Zabbix配置文件 | 固定大小。通常为10MB 或更少。 |
| History | days(items/refresh rate)243600bytes items:监控项数量。days:保留历史数据的天数。refresh rate：监控项的更新间隔。bytes：保留单个值所需要占用的字节数，依赖于数据库引擎，通常为~90字节。 |
| Trends | days(items/3600)243600bytes items:监控项数量。days:保留历史数据的天数。bytes：保留单个趋势数据所需要占用的字节数，依赖于数据库引擎，通常为~90字节。 |
| Events | daysevents243600bytes events：每秒产生的事件数量。假设最糟糕的情况下，每秒产生1个事件。days：保留历史数据的天数。bytes：保留单个趋势数据所需的字节数，取决于数据库引擎，通常为~170字节。 |



根据使用 MySQL 后端数据库的实际统计数据中收集到的平均值，例如监控项为数值类型的值约 90 个字节，事件约 170 个字节。

因此，所需要的磁盘总空间按下列方法计算：

配置文件数据+ 历史数据+ 趋势数据+ 事件数据

在安装 Zabbix 后不会立即使用磁盘空间。 数据库大小取决于管家设置，在某些时间点增长或停止增长。

## 时间同步

在运行 Zabbix 的服务器上拥有精确的系统日期非常重要。 ntpd 是最受欢迎的守护进程，它将主机的时间与其他服务器的时间同步。 对于所有运行 Zabbix 组件的系统，强烈建议这些系统的时间保持同步。

如果时间未同步，Zabbix将在建立数据连接之后，根据得到的客户端和服务器的时间戳，并通过客户端和服务器的时间差对获得值的时间戳进行调整，将获得值的时间戳转化为 Zabbix server 的时间。 为了尽可能简化并且避免可能的并发问题出现，网络延迟将会被忽略。因此，通过主动连接（active agent,active proxy, sender）获得的时间戳数据将包含网络延迟，通过被动连接（passive proxy）获得的数据已经减去了网络延迟。所有其他监控类型都在服务器时间里完成，并且不会调整其时间戳。

## zabbix生产环境安装

```shell
#安装zabbix前提，关闭selinux
1：配置zabbix的yum源
#下载zabbix-release
wget http://repo.zabbix.com/zabbix/4.0/rhel/7/x86_64/zabbix-release-4.0-
1.el7.noarch.rpm
#安装zabbix-release
rpm -ivh zabbix-release-4.0-1.el7.noarch.rpm
#将官方仓库地址替换为清华仓库地址
sed -i 's#http://repo.zabbix.com#https://mirror.tuna.tsinghua.edu.cn/zabbix#g'
/etc/yum.repos.d/zabbix.repo
2:安装zabbix服务端和zabbix-web前端
yum install zabbix-server-mysql zabbix-web-mysql -y
3：安装mariadb，创建zabbix库，授权zabbix用户
yum install mariadb-server -y
systemctl start mariadb
systemctl enable mariadb
mysql_secure_installation
先回车
再n
然后一路y
[root@app01]# mysql
MariaDB [(none)]> create database zabbix character set utf8 collate utf8_bin;
MariaDB [(none)]> grant all privileges on zabbix.* to zabbix@'%' identified by
'BJtydic_321';
#导入zabbix表结构和初始数据
zcat /usr/share/doc/zabbix-server-mysql*/create.sql.gz | mysql -uzabbix -
pBJtydic_321 -hxxx.xxx.xxx zabbix
#检查zabbix库是否导入成功
mysql -uroot -pBJtydic_321 -hxxx.xxx.xxx zabbix -e 'show tables'
```

```shell
4：配置启动zabbix-server
vi /etc/zabbix/zabbix_server.conf
DBHost=（有zabbix数据库服务器的地址）
DBName=zabbix
DBUser=zabbix
DBPassword=BJtydic_321
#启动zabbix-server
systemctl start zabbix-server
systemctl enable zabbix-server
#检查：
netstat -lntup|grep 10051
# 使用阿里云rds或者自建mysql的步骤同上
5:修改Zabbix前端的PHP配置,并启动httpd
vi /etc/httpd/conf.d/zabbix.conf
php_value date.timezone Asia/Shanghai
systemctl start httpd
systemctl enable httpd
6:前端zabbix-web的安装
#浏览器：http://10.0.0.71/zabbix
#后期修改zabbix数据库密码的时候，需要修改的配置文件：
#/etc/zabbix/web/zabbix.conf.php
#http://10.0.0.61/zabbix/zabbix.php
#登录的账号密码:
#Admin
#zabbix
```

## 监控一台服务器主机

```shell
# 监控zabbix-server自己
yum install zabbix-agent.x86_64 -y
systemctl enable zabbix-agent.service
systemctl start zabbix-agent.service
# 使用zabbix-agent监控其他主机
wget https://mirror.tuna.tsinghua.edu.cn/zabbix/zabbix/4.0/rhel/7/x86_64/zabbix
agent-4.0.16-1.el7.x86_64.rpm
rpm -ivh zabbix-agent-4.0.16-1.el7.x86_64.rpm
#修改zabbix_agent 配置文件将Server指向zabbix-server主机的内网地址
vim /etc/zabbix/zabbix_agentd.conf
sed -i '$#Server=127.0.0.1#Server=10.0.0.71#g' /etc/zabbix/zabbix_agentd.conf
#修改完启动zabbix_agent服务
systemctl enable zabbix-agent.service
systemctl start zabbix-agent.service
```

## 添加主机和监控模板

点击页面的 配置--->主机--->创建主机

![](/img/zabbix/d78218e479a835e6362122dcf92da1e5c7cd7a73d2dd24734e5f4081b3c15ade.jpg)

主机设置界面

填写主机名称、群组、agent地址和端口

![](/img/zabbix/1c34fca33458b3743290e8594cb10be13ef00cb1b59c4d015a4947be9df933df.jpg)

给主机添加 Template OS Linux 的模板 利用此模板的中的cpu和内存监控情况来在主界面创建dashboard 为后期压测来展示直观的结果

![](/img/zabbix/c996a6af4854373f5bb1df0d0fb41554721757c3a215f043f7f0e3f40c57d3f6.jpg)

## 添加主界面CPU和可用内存仪表盘

## 设置监控界面

编辑仪表盘--->添加构建 (为主机的可用内存添加监控界面)

![](/img/zabbix/e0a2efc5aa6971bb581e653f9ef8f8d092580b2bd1d2bfa3a1851a1a29b6e0fa.jpg)

## 类型选择图形

名称自己定义（在添加监控界面时尽量选择cpu和内存情况相近的几台主机，否则y轴跨度太大影响美观和观测）

刷新间隔自己定义

数据设置颜色一定要以能直观区分出来为主 颜色不相近

![](/img/zabbix/cf51274db7a64e631dbd12917b3da6107e9209130b7508be5fa9235ff4a08598.jpg)

选择主机群主和要展示数据的主机

找到 Available memory 这一项 表示可用内存

以线的绘制方式为主

透明度数值越高颜色越深 越直观



| 监控项 |   |   |   |   |   |
| --- | --- | --- | --- | --- | --- |
|   |   |   | 群组 Templates | < 主机 | 10.0.0.162 √ |
| 名称 | 键值 |   | 类型 | 信息类型 | 状态 |
|   | Agent ping | agent ping |   | Zabbix客户端数字(无正负） | 已启用 |
|   | Available memory | vm.memory.size[available] | Zabbix客户端数字(无正负）已启用 |   |   |
|   | Checksum of /etc/passwd | vfs.file.cksum[/etc/passwd] | Zabbix客户端数字(无正负）已启用 |   |   |
|   | Context switches per second | system.cpu.switches | Zabbix客户端数字(无正负） |   | 已启用 |
|   | CPU guest nice time | system.cpu.util.guest_nice] | Zabbix客户端浮点数 |   | 已启用 |
|   | CPU guesttime | system.cpu.util, guest] | Zabbix客户端浮点数 |   | 已启用 |
|   | CPU idle time | system.cpu.util,idle] | Zabbix客户端浮点数 |   | 已启用 |
|   | CPU interrupttime | system.cpu.util,interrpt] | Zabbix客户端浮点数 |   | 已启用 |
|   | CPU iowait time | system.cpu.util,.iowait] | Zabbix 客户端浮点数 |   | 已启用 |
|   | CPU nice time | system.cpu.util,nice] | Zabbix客户端浮点数 |   | 已启用 |
|   | CPU softirq time | system.cpu.util[,softiq] | Zabbix客户端浮点数 |   | 已启用 |
|   | CPU steal time | system.cpu.util,sta] | Zabbix客户端浮点数 |   | 已启用 |
|   | CPU system time | system.cpu.util,system] | Zabbix客户端浮点数 |   | 已启用 |
|   | CPU user time | system.cpu.util[,user] | Zabbix客户端浮点数 |   | 已启用 |
|   | Free disk space on / Free disk space on /(percentage) | vfs.fs.size[/,free] |   | Zabbix客户端数字(无正负) | 已启用 |
|   | Free inodes on/(percentage) | vfs.fs.size[/,pfree] | Zabbix客户端浮点数 |   | 已启用 |
|   | Free swap space | vfs.fs.inode[,free] | Zabbix 客户端浮点数 |   | 已启用 |
|   | Free swap space in % | system.swap.size[.free] |   | Zabbix客户端数字(无正负) | 已启用 |
|   | Host boottime | system.swap.size[,pfree] | Zabbix客户端浮点数 |   | 已启用 |
|   |   | system.boottime | Zabbix客户端数字(无正负) |   | 已启用 |
|   | Hostlocal time | system.localtime | Zabbix 客户端数字(无正负) |   | 已启用 |
|   | Incoming network traffic on cnio | net.f.in[cni0] | Zabbix客户端数字(无正负) |   | 已启用 |
|   | Incoming network traffic on docker0 | net.f.in[docker0] | Zabbix客户端数字(无正负) |   | ）已启用 |



设置时间期间参数可以展示从xx到xx时间内的内容  
![](/img/zabbix/490493a8395aac0bbf411e5b80f71857cb91670c183404711841303eda602a20.jpg)

![](/img/zabbix/68523c12df36ac42fdf9b83b0f563f65ebdc06a732dcbbea1ebf16c10e5711ad.jpg)

## 添加可用内存界面

与上述内从容步骤大体一致

将监控取值项设置为 CPU user time cpu用户态时间

![](/img/zabbix/ba61b920f2cbe0fcbea598602d2de2e0dc2ed482aa7455a68d5aadddb3ba32f2.jpg)

## 添加报警脚本手动测试

## 添加钉钉机器人

步骤：拉起一个钉钉报警群-->添加机器人--->获取机器人的webhook

注意：请保管好此Webhook 地址，不要公布在外部网站上，泄露后有安全风险。

钉钉开放平台api服务文档

https://ding-doc.dingtalk.com/doc#/serverapi2/qf2nxq

```python
[root@middleware03 ~]# vim /usr/lib/zabbix/alertscripts/zabbix_dingding.py
#!/usr/bin/python3
import requests
import json
import sys
import os
headers = {'Content-Type': 'application/json;charset=utf-8'}
api_url = "https://oapi.dingtalk.com/robot/send?access_token=xxxxxxx"
def msg(text):
json_text= {
"msgtype": "text",
"text": {
"content": text
},
"at": {
"atMobiles": [
"1xxxxxxxxxxxxx"
],
"isAtAll": False
}
}
print(requests.post(api_url,json.dumps(json_text),headers=headers).content)
if __name__ == '__main__':
text = sys.argv[1]
msg(text)
```

添加之后可以进行手动测试

```shell
curl 'https://oapi.dingtalk.com/robot/send?access_token=xxxxxxx' -H 'Content-
Type: application/json' -d '{"msgtype": "text","text": {"content": "message
test"}}'
./zabbix_dingding.py 亚朵生产环境监控告警机器人 message
```

![](/img/zabbix/980cc0d82d9ca2c94210c660f067be9874dd6516f2c44a5e0674bd058a8e95cf.jpg)

创建报警媒介类型

![](/img/zabbix/269acbab419a026dda180fa1d33df0dcf69e9b86394da312400ae1a296813397.jpg)

## 添加中间件模板

### elasticsearch

```shell
#在安装中间件服务的主机上添加服务脚本 没有此路径的可以进行创建 利用es丰富的api接口可以查询到多项指标
# es是多节点的服务 记得要放到其他的安装节点 在web界面操作的时候同样要在安装es的主机上添加监控项和触发器
#elasticsearch 监控脚本文件
[root@middleware03 ~]# ll /etc/zabbix/scripts/
-rwxr-xr-x 1 root root 2441 Dec 19 21:13 elastizabbix.py
#添加键值
[root@middleware03 ~]# vim /etc/zabbix/zabbix_agentd.d/es.conf
UserParameter=elastizabbix[*],/etc/zabbix/scripts/elastizabbix.py $1 $2
#使用zabbix_get 监测键值情况
```

### redis

```shell
# redis info的命令可以知道redis的各种指标
# redis是多节点的服务 记得要放到其他的安装节点 在web界面操作的时候同样要在安装redis的主机上添加监控项和触发器
[root@middleware03 ~]# vim /etc/zabbix/zabbix_agentd.d/redis.conf
Timeout=8
UserParameter=redis[*],/usr/local/redis/bin/redis-cli -a STcomm2020 info 2>/dev/null | grep $1":" cut -d -f 2
UserParameter=redis-ping,/usr/local/redis/bin/redis-cli -a STcomm2020 ping 2>/dev/null | grep -c PONG
UserParameter=redis.version, /usr/local/redis/bin/redis-server --version 2>/dev/null | cut -d " " -f 3 | cut -d "=" -f 2
#使用zabbix_get 监测键值情况
```

## 添加自定义中间件模板与测试

### xxl-job

```shell
#xxl-job 监测页面状态脚本
[root@middleware03 ~]# vim /etc/zabbix/scripts/xxl-job.sh
#!/bin/bash
curl -sL -w "%{http_code}" "http://47.96.31.122:8801/xxl-job-admin/" -o /dev/null
#添加键值
[root@middleware03 ~]# vim /etc/zabbix/zabbix_agentd.d/xxl-job.conf
UserParameter=xxl-job,/etc/zabbix/scripts/xxl-job.sh 2>/dev/null
#使用zabbix_get 监测键值情况
```

## k8s的pod异常状态

```shell
#添加脚本
#!/bin/bash
kubectl get pods -n prod|grep -ci error
#添加键值
[root@middleware03 ~]# vim /etc/zabbix/zabbix_agentd.d/k8s.conf
UserParameter=k8s_error,/etc/zabbix/scripts/k8s-error.sh 2>/dev/null
#使用zabbix_get 监测键值情况
```

## 其他中间件 nacos、jenkins、zookeeper

```shell
# zookeeper是多节点的服务 记得要放到其他的安装节点 在web界面操作的时候同样要在安装zookeeper
的主机上添加监控项和触发器
[root@middleware03 ~]# vim /etc/zabbix/zabbix_agentd.d/middleware.conf
UserParameter=nacos, nc=$( ps -ef |grep nacos|wc -l );if [ $nc -eq 1 ]; then
echo 1 ;fi
# ps -ef |grep nacos|wc -l 进程存在的话结果是2
UserParameter=jenkins, jk=$(ps -ef |grep jenkins |grep -v grep |wc -l);if [ $jk
-eq 0 ]; then echo 1;fi
UserParameter=zookeeper, zk=$(ss -lntup |grep -v grep |grep 2181 |wc -l);if [
$zk -eq 0 ];then echo 1;fi
#使用zabbix_get 监测键值情况
```

## 在zabbix界面配置监控项和触发器

## 导入模板

![](/img/zabbix/5481b50a85435202496e16120eacf8da6a65d1ffeed914b1e77297b4b5a03ff6.jpg)

## 在主机上添加模板

这一步操作需要把安装了es和redis服务的主机都加上模板

等待一段时间服务取到值之后监控项会变为可用

![](/img/zabbix/6c6c545db3eb0520190e461480731c455879825053570c046f581bf725ab7d4e.jpg)

## Redis服务

![](/img/zabbix/cb52bc8fa0e712a0c522dfef9c63934258027a5d4cae73e60f562827d2a254db.jpg)

## ES服务

![](/img/zabbix/96ac889a79f5566619cabd06e6d3c323c5b0b9cea9030274430b2c3724d23f74.jpg)

## 自定义监控项在界面配置模板

## 创建监控项

配置--->主机--->创建监控项

![](/img/zabbix/cd16ef41ecef8818e48380294cb74ee8055733b5cc42de6fea9a6c9908e88105.jpg)

## 配置监控项

名称：要符合自定义监控项服务的名称

键值：自己配置文件里写的键值是什么这里就写什么

更新时间： 一般建议设置成2min

新的应用集： 为了方便自己查找可以自定义一个名称

![](/img/zabbix/4a91b146f7879c8eb0bccefb712b6570db7e4f0951a254e732c002a21ae7a1df.jpg)

## 自定义监控项示例

这里以nacos为例 状态为已启用就是创建监控项成功了

![](/img/zabbix/3825fc14da4ec1dba02d946a462275c2d20b53749aa72e2f0ae61a75f28425da.jpg)

## 配置触发器

配置-->主机--> 创建触发器

![](/img/zabbix/42af585e713716d22605b335c95e7f55d9ecf7e3199bfcfc60dbcdc1792ad1be.jpg)

触发器的名称 要切合服务名称 这里自己定义

严重等级自己定义

表达式：

监控项： 选择自己刚才创建的nacos监控项

功 能： 取一个最新的值

间 隔： 120s

结 果： 这里的结果是 当结果为某一个参数时就报警

结合之前的脚本可以看出只要服务挂掉就输出1 当设置的结果和键值输出结果相同就会触发报警

![](/img/zabbix/6ca1b41bb3095354eb6501725d67bd61fd4e6494184afd254249ee3026079123.jpg)  
注：其他服务添加监控项和添加触发器的流程相似 不再一一赘述

## web监测

业务中总会让我们去监控⼀些URL，⽐如⽀付接⼝中的微信⽀付，⽀付宝⽀付，那么这些URL是怎么监控的呢？可以使⽤zabbix提供的web监测功能。

web监控⼀般在⽣产环境中⼀般不会配置到模板，⼀般都是某个业务机由于业务需要去监控本机或者下游某个机器的URL的，所以我这⾥配置也是针对某个机器来配置的。本实验中我是给node1来配置实验步骤

1. 给node1安装⼀个web站点，然后⽤web监测来监控该web

2. 监控平台配置web监测

## 为node1部署⼀个站点

```shell
#安装服务
[root@node1 ~]# yum -y install httpd
#配置页面
[root@node1 ~]# echo haha > /var/www/html/index.html
#启动服务
[root@node1 ~]# systemctl start httpd
[root@node1 ~]# systemctl enable httpd
Created symlink from /etc/systemd/system/multi-user.target.wants/httpd.service
```

## 监控平台配置web监测

配置—主机—选择被监控机的web监测

![](/img/zabbix/1df60d2c299019c6fdd76438841f1c1d14ed2716f1ba6902b61975e7c26ad836.jpg)

点击web监测进⼊本机的web监测管理⻚⾯，这⾥继续选择创建 web场景

![](/img/zabbix/d6ead58180e4d2fe51c681d095357b8bf6b2b7d2c974ce7cafabd1905e0c4e04.jpg)  
点击 创建web场景

![](/img/zabbix/7432fd04968410db04bd3c4874bf57db73e23dffdf5833a4d9cb4e6690882e48.jpg)  
按要求填写内容后选择步骤

出图  
![](/img/zabbix/0b470836d59a8b8c9ec921ea97a3916198c864191356992eaf042dafb8ea3ca1.jpg)

![](/img/zabbix/05d1af51be5402c80f15bdff55b3695876f460ab8bc7d5004cc635bc9e37ab45.jpg)

继续选择添加

![](/img/zabbix/57ce3c7fe1df05e7c6ee2b9ece2ee3d27df7102cc874079cc48682e10e1ff3ec.jpg)

![](/img/zabbix/bb017911847e1f671e6d4d56d0afb6a03f027c982626374d87570a0bb947e7e8.jpg)
