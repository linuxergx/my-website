# MySQL高可用架构实战手册

## 目录

[toc]



## 第一部分：MySQL基础核心

## 第一章：MySQL入门与安装

### 1.1 数据库核心概念与体系结构

- **RDBMS (关系型数据库管理系统)**: 基于关系模型来管理数据的数据库，如 Oracle, **MySQL**, PostgreSQL。

- **NoSQL (非关系型数据库)**: 通常用于处理大规模和高并发的数据场景，如 MongoDB, Redis, Elasticsearch。

- **MySQL体系结构**:

  ```
      +-----------------------------------------+
      |               客户端 (Client)           |
      |        (mysql, navicat, API等)          |
      +-----------------------------------------+
                       | (网络连接)
      +-----------------------------------------+
      |              MySQL 服务 (Server)        |
      |-----------------------------------------|
      |    连接层 (Connection Pool, Auth)       |
      |-----------------------------------------|
      |      SQL层 (Parser, Optimizer, Cache)   |
      |-----------------------------------------|
      |  存储引擎层 (Pluggable Storage Engines) |
      |   (InnoDB, MyISAM, Memory, TokuDB...)   |
      +-----------------------------------------+
                       | (磁盘交互)
      +-----------------------------------------+
      |            物理文件 (Data Files)        |
      +-----------------------------------------+
  ```

  - **连接层**: 处理客户端连接请求，进行身份验证和权限检查。
  - **SQL层**: 对SQL语句进行解析、优化，并生成执行计划。查询缓存（Query Cache，8.0版本已移除）也在此层。
  - **存储引擎层**: 负责数据的实际存储和提取。MySQL支持插件式存储引擎，是事务、索引等特性的具体实现者。

### 1.2 MySQL版本选择

- **主流厂商**: Oracle MySQL, Percona Server, MariaDB。
- **企业版本建议**:
  - **5.7**: **目前最主流**，性能和功能有显著提升。建议使用`5.7.20+`的双数版本。
  - **8.0**: 最新大版本，引入了窗口函数、CTE等新特性，并对性能做了进一步优化。建议使用`8.0.11+`的版本。

### 1.3 二进制包安装MySQL 5.7

二进制包安装方式灵活，便于多实例部署和版本控制。

**1. 环境准备**

```
# 创建相关目录
mkdir -p /data/app /data/3306/data /data/3306/binlog

# 创建专用的mysql用户
useradd -s /sbin/nologin mysql

# 清理系统可能残留的mariadb包
yum remove mariadb-libs -y

# 安装依赖
yum install -y libaio-devel numactl-libs
```

**2. 软件安装与配置**

```
# 解压并创建软链接
cd /data/app
tar xf mysql-5.7.28-linux-glibc2.12-x86_64.tar.gz
ln -s mysql-5.7.28-linux-glibc2.12-x86_64 mysql
chown -R mysql.mysql /data/ /data/app/mysql*

# 设置环境变量
echo 'export PATH=/data/app/mysql/bin:$PATH' >> /etc/profile
source /etc/profile

# 创建配置文件 /etc/my.cnf
cat > /etc/my.cnf <<EOF
[mysqld]
user=mysql
basedir=/data/app/mysql
datadir=/data/3306/data
socket=/tmp/mysql.sock
port=3306
server_id=6

[mysql]
socket=/tmp/mysql.sock
EOF

# 初始化数据库 (datadir目录必须为空)
mysqld --initialize-insecure --user=mysql --basedir=/data/app/mysql --datadir=/data/3306/data
```

### 1.4 MySQL启动、连接与多实例配置

**1. 启动服务 (systemd方式，推荐)**

```
# 创建service文件 /etc/systemd/system/mysqld.service
[Unit]
Description=MySQL Server
After=network.target

[Service]
User=mysql
Group=mysql
ExecStart=/data/app/mysql/bin/mysqld --defaults-file=/etc/my.cnf
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target

# 启动并设置开机自启
systemctl daemon-reload
systemctl start mysqld.service
systemctl enable mysqld.service
```

**2. 多实例配置** 核心思想是为每个实例提供独立的配置文件、数据目录、端口和socket文件。

```
# 1. 创建新实例目录
mkdir -p /data/3307/data

# 2. 创建新配置文件 /data/3307/my.cnf，修改port, server_id, datadir, socket等
# 3. 初始化新实例
mysqld --initialize-insecure --user=mysql --datadir=/data/3307/data

# 4. 创建新的systemd启动脚本，如mysqld3307.service，并修改ExecStart指向新的配置文件
# 5. 启动新实例
systemctl start mysqld3307.service
```

## 第二章：SQL语言深度应用

### 2.1 SQL语言分类与DDL操作

- **SQL分类**:

  - **DDL (数据定义语言)**: `CREATE`, `ALTER`, `DROP`
  - **DML (数据操作语言)**: `INSERT`, `UPDATE`, `DELETE`
  - **DCL (数据控制语言)**: `GRANT`, `REVOKE`
  - **DQL (数据查询语言)**: `SELECT`

- **DDL操作 (表)**:

  ```
  -- 创建表
  CREATE TABLE `student` (
    `sno` INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `sname` VARCHAR(20) NOT NULL,
    `sage` TINYINT UNSIGNED NOT NULL,
    `ssex` ENUM('f','m') NOT NULL DEFAULT 'm'
  ) ENGINE=InnoDB CHARSET=utf8mb4;
  
  -- 修改表结构 (Online DDL)
  ALTER TABLE student ADD telnum CHAR(11) NOT NULL UNIQUE KEY;
  ```

  **注意**: 在生产环境中，对大表的DDL操作应使用`pt-online-schema-change`或`gh-ost`等工具，避免锁表。

### 2.2 DML操作与数据安全

```
-- 插入数据
INSERT INTO student(sname, sage, ssex) VALUES('张三', 18, 'm');

-- 更新数据 (必须带WHERE条件)
UPDATE student SET sage=21 WHERE sno=1;

-- 删除数据 (必须带WHERE条件)
DELETE FROM student WHERE sno=2;

-- 逻辑删除：通过状态字段标记数据为“已删除”，而非物理删除
ALTER TABLE student ADD state TINYINT NOT NULL DEFAULT 1;
UPDATE student SET state=0 WHERE sno=2;
```

**对比 `DELETE`, `TRUNCATE`, `DROP`**:

- `DELETE`: DML，逐行删除，可回滚，产生大量binlog。
- `TRUNCATE`: DDL，删除所有数据页，不可回滚，binlog记录少。
- `DROP`: DDL，删除表结构和数据，不可回滚。

### 2.3 DQL查询语言核心语法

`SELECT`语句的逻辑执行顺序为：`FROM` -> `WHERE` -> `GROUP BY` -> `HAVING` -> `SELECT` -> `ORDER BY` -> `LIMIT`。

```
-- 统计中国城市数量大于10个的省份，并按数量降序排列
SELECT District, COUNT(Name) AS city_count
FROM city
WHERE CountryCode = 'CHN'
GROUP BY District
HAVING city_count > 10
ORDER BY city_count DESC;
```

### 2.4 多表连接查询

- **内连接 (INNER JOIN)**: 返回两个表中能匹配的行。
- **外连接 (LEFT/RIGHT JOIN)**: 返回一个表的全部行和另一个表的匹配行。

```
-- 查询'zhang3'同学选修的所有课程名称
SELECT s.sname, c.cname
FROM student s
JOIN sc ON s.sno = sc.sno
JOIN course c ON sc.cno = c.cno
WHERE s.sname = 'zhang3';
```

**优化建议**: 多表连接时，应将结果集较小的表作为**驱动表**。

## 第三章：InnoDB存储引擎与事务

### 3.1 存储引擎概述 (InnoDB vs MyISAM)

| 特性         | InnoDB          | MyISAM |
| ------------ | --------------- | ------ |
| **事务**     | **支持** (ACID) | 不支持 |
| **锁级别**   | **行级锁**      | 表级锁 |
| **外键**     | **支持**        | 不支持 |
| **MVCC**     | **支持**        | 不支持 |
| **崩溃恢复** | **支持**        | 不支持 |

自MySQL 5.5起，**InnoDB**成为默认存储引擎，是绝大多数场景的首选。

### 3.2 InnoDB核心特性与体系结构

- **核心特性**: 事务、行级锁、MVCC、聚簇索引、双写缓冲、自适应哈希索引、更改缓冲。
- **体系结构**:
  - **内存结构**: 缓冲池 (Buffer Pool)、重做日志缓冲 (Redo Log Buffer)。
  - **磁盘结构**: 表空间 (Tablespace)、重做日志 (Redo Log)、撤销日志 (Undo Log)。

### 3.3 事务ACID特性详解

- **原子性 (Atomicity)**: 事务是一个不可分割的工作单元，要么全部执行，要么全部不执行。由**Undo Log**保证。
- **一致性 (Consistency)**: 事务执行前后，数据库从一个一致性状态转移到另一个一致性状态。是事务的最终目的。
- **隔离性 (Isolation)**: 一个事务的执行不能被其他事务干扰。由**锁**和**MVCC**保证。
- **持久性 (Durability)**: 一旦事务提交，其结果就是永久性的。由**Redo Log**保证。

### 3.4 事务隔离级别与锁机制

- **隔离级别**:
  - **读未提交 (READ UNCOMMITTED)**: 脏读。
  - **读已提交 (READ COMMITTED)**: 不可重复读。
  - **可重复读 (REPEATABLE READ)**: **MySQL默认级别**。理论上存在幻读（InnoDB通过MVCC和Next-Key Lock解决）。
  - **可串行化 (SERIALIZABLE)**: 最高级别，性能最低。
- **锁**:
  - **共享锁 (S锁)**: 读锁，多个事务可同时持有。
  - **排他锁 (X锁)**: 写锁，一次只能有一个事务持有。
  - **记录锁、间隙锁、Next-Key锁**: InnoDB用于实现行级锁和防止幻读的具体锁类型。

## 第四章：索引与查询优化

### 4.1 索引基础与B-Tree结构

- **什么是索引？**: 索引是帮助MySQL高效获取数据的**排好序的数据结构**。
- **B-Tree结构**: InnoDB使用B+Tree，非叶子节点只存储键值，叶子节点存储数据（聚簇索引）或主键（辅助索引），且叶子节点之间通过双向链表连接，便于范围查询。

### 4.2 聚簇索引与辅助索引（回表）

- **聚簇索引**: 数据行本身按照主键的顺序进行物理存储，**数据即索引，索引即数据**。每张InnoDB表有且仅有一个。

- **辅助索引**: 叶子节点存储的是**索引键的值**和对应行的**主键值**。

- **回表**: 通过辅助索引查询时，先找到主键值，再用主键值去聚簇索引中查找完整数据行的过程。

  ```
  -- 辅助索引查找示意图
  (name='Alice')
        |
  [辅助索引树: 查找'Alice']
        |
  [叶子节点: 得到主键ID=10]
        | (回表)
  [聚簇索引树: 查找ID=10]
        |
  [叶子节点: 得到'Alice'的完整数据行]
  ```

- **覆盖索引**: 如果查询所需的所有列都包含在辅助索引中，则无需回表，性能会大幅提升。

### 4.3 索引设计原则与管理

- **选择性高**的列适合做索引。
- **联合索引**遵循**最左前缀原则**。`idx(a,b,c)`相当于拥有`idx(a)`, `idx(a,b)`, `idx(a,b,c)`三个索引。
- 避免创建过多索引，会影响写入性能并占用磁盘空间。

### 4.4 执行计划分析 (EXPLAIN)

`EXPLAIN`是SQL优化的关键工具。

- **关键字段解读**:
  - **type**: 连接类型，性能从高到低：`system` > `const` > `eq_ref` > `ref` > `range` > `index` > `ALL`。应尽量避免`ALL`（全表扫描）。
  - **key**: 实际使用的索引。
  - **rows**: 预估需要扫描的行数。
  - **Extra**: 额外信息，如 `Using filesort` (需要额外排序), `Using temporary` (使用了临时表), `Using index` (使用了覆盖索引)。

## 第二部分：MySQL高级运维

## 第五章：MySQL日志系统详解

### 5.1 错误日志 (Error Log)

- **作用**: 记录MySQL启动、运行和关闭过程中的严重错误和警告，是问题排查的首要入口。
- **配置**: `log_error=/path/to/mysql.log`

### 5.2 二进制日志 (Binary Log)

- **作用**: 记录所有对数据库进行更改的操作，是数据恢复和主从复制的基础。

- **核心配置**:

  ```
  [mysqld]
  server_id=6
  log_bin=/data/3306/binlog/mysql-bin
  binlog_format=ROW
  sync_binlog=1
  ```

- **Binlog格式**: 生产环境推荐使用 **ROW** 格式以保证数据一致性。

- **恢复操作**: 可使用`mysqlbinlog`工具基于Position点或GTID进行数据恢复。

### 5.3 慢查询日志 (Slow Query Log)

- **作用**: 记录执行时间超过指定阈值的SQL语句，是SQL优化的重要依据。

- **核心配置**:

  ```
  [mysqld]
  slow_query_log=ON
  long_query_time=0.1
  log_queries_not_using_indexes
  ```

- **分析工具**: 强烈推荐使用Percona Toolkit中的`pt-query-digest`。

## 第六章：备份与恢复策略

### 6.1 备份策略与DBA职责

- **备份策略**: 需明确备份时间、周期和方式（全备、增量；逻辑、物理）。
- **DBA职责**: 设计策略、检查备份、定期恢复演练、故障恢复。

### 6.2 逻辑备份：mysqldump

- **原理**: 将数据库对象和数据导出为SQL语句。

- **优点**: 可读性强，压缩比高，跨平台兼容性好。

- **缺点**: 速度慢，不适合大数据量场景。

- **热备命令**:

  ```
  mysqldump -A -R -E --triggers --master-data=2 --single-transaction | gzip > /path/full.sql.gz
  ```

### 6.3 物理备份：Percona XtraBackup

- **原理**: 直接拷贝数据文件，速度极快。

- **优点**: 备份和恢复速度快，支持热备和增量备份。

- **全量备份与恢复**:

  ```
  # 备份
  innobackupex --user=root --password=123 /opt/full
  # 恢复
  innobackupex --apply-log /opt/full
  innobackupex --copy-back /opt/full
  chown -R mysql.mysql /data/3306/data
  systemctl start mysqld
  ```

- **增量备份与恢复**: 增量备份只拷贝自上次备份以来发生变化的数据页，恢复时需将所有增量按顺序合并到全备中。

## 第七章：主从复制

### 7.1 复制原理与线程

- **原理**: 从库（Replica）的**IO线程**从主库（Source）拉取binlog并写入本地的**Relay Log**，**SQL线程**读取Relay Log并重放其中的事件。

  ```
  +----------------+                            +----------------+
  |  主库 (Source) |                            |  从库 (Replica)|
  +----------------+                            +----------------+
  |                |--(1) 主库DUMP线程发送binlog-->|                |
  |    Binlog      |<---------------------------|    IO Thread   |
  |                |                            |                |
  +----------------+                            +-------+--------+
                                                        | (2) 写入
                                                        v
                                                  +-------+--------+
                                                  |                |
                                                  |   Relay Log    |
                                                  |                |
                                                  +-------+--------+
                                                        | (3) 读取并重放
                                                        v
                                                  +-------+--------+
                                                  |                |
                                                  |   SQL Thread   |
                                                  |                |
                                                  +----------------+
  ```

### 7.2 GTID复制模式

- **GTID (Global Transaction ID)**: 全局事务唯一标识，简化了主从切换和故障恢复。

- **开启配置**:

  ```
  [mysqld]
  gtid_mode=ON
  enforce_gtid_consistency=ON
  ```

- **搭建**:

  ```
  -- 从库配置
  CHANGE MASTER TO MASTER_HOST='...', MASTER_USER='...', MASTER_PASSWORD='...', MASTER_AUTO_POSITION=1;
  START SLAVE;
  ```

### 7.3 延迟从库与过滤复制

- **延迟从库**: 人为设置从库延迟，用于快速恢复误操作。

  ```
  CHANGE MASTER TO MASTER_DELAY = 10800; -- 延迟3小时
  ```

- **过滤复制**: 让从库只复制指定的库或表，推荐在从库端配置。

  ```
  replicate_do_db = db1
  replicate_ignore_table = db2.t1
  ```

### 7.4 数据一致性保障

- **半同步复制 (Semi-Sync)**: 事务在主库提交后，必须至少有一个从库确认收到binlog，主库才会返回成功给客户端。
- **MGR (MySQL Group Replication)**: 官方推出的基于Paxos协议的强一致性方案。

## 第三部分：MySQL架构与扩展

## 第八章：高可用架构 MHA

### 8.1 高可用性标准

- **99.99% (4个9)**: 年故障约52.6分钟（MHA级别）。
- **99.999% (5个9)**: 年故障约5.26分钟（PXC/MGR级别）。

### 8.2 MHA 架构与故障切换原理

- **组件**: Manager（管理节点） + Node（数据库节点）。

- **切换原理**:

  1. Manager监控发现主库宕机。
  2. 从所有从库中选举一个最优的新主库。
  3. 将其他从库缺失的差异binlog从新主库补齐。
  4. 将所有从库指向新的主库，实现故障自动转移。

  ```
  +-----------+      (1) 监控      +-----------+
  |  Manager  |<------------------>| Master (X)| --宕机
  +-----------+      (SSH/Repl)    +-----------+
        |                          /           \
        | (2) 选举新主            /             \
        | (3) 补齐差异binlog     /               \
        | (4) 指向新主          v                 v
  +-----------+          +-----------+         +-----------+
  | New Master| <------- |  Slave 1  |         |  Slave 2  |
  +-----------+          +-----------+         +-----------+
  ```

### 8.3 MHA 部署与管理

1. **环境准备**: 至少一主两从的MySQL复制环境，所有节点间SSH互信。
2. **安装软件包**: 所有节点安装`mha4mysql-node`，Manager节点安装`mha4mysql-manager`。
3. **配置MHA**: 创建`app1.cnf`，定义集群节点信息。
4. **检查并启动**: 使用`masterha_check_*`命令检查配置，然后启动`masterha_manager`。

## 第九章：读写分离与分布式中间件

### 9.1 读写分离中间件：Atlas

- **作用**: 奇虎360开源的MySQL代理，可实现读写分离。应用连接Atlas，Atlas将写请求发往主库，读请求分发到从库。

### 9.2 分布式数据库中间件：Mycat

- **作用**: 开源的分布式数据库中间件，支持数据的分库分表，将大型单库MySQL水平扩展为分布式集群。
- **核心概念**:
  - **垂直拆分**: 将不同业务的表拆分到不同的数据库实例上。
  - **水平拆分**: 将单张大表的数据按某种规则（如取模）拆分到多个物理表中。
  - **全局表**: 在所有分片上都有一份完整拷贝的表（如字典表）。
  - **ER分片**: 保证有关联关系的父子表数据落在同一个分片上，避免跨库JOIN。

## 第十章：NoSQL缓存数据库 Redis

### 10.1 Redis 核心特性与应用场景

- **特性**:
  - 性能极高，基于内存操作。
  - 数据类型丰富（String, Hash, List, Set, ZSet）。
  - 支持持久化。
  - 单线程模型，避免了上下文切换和锁竞争。
- **场景**: 缓存、计数器、消息队列、排行榜、社交网络等。

### 10.2 Redis 持久化与主从复制

- **持久化**:
  - **RDB (快照)**: 在指定时间间隔内生成数据集的时间点快照。恢复速度快。
  - **AOF (追加日志)**: 记录所有写操作命令。数据安全性最高。
  - **生产建议**: 同时开启RDB和AOF。
- **主从复制**: 从库向主库发送`SYNC`命令，主库执行`BGSAVE`生成RDB并发送给从库，之后持续发送写命令。