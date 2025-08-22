# MySQL 高级 SQL 与数据库管理

## 1. SQL 常用数据类型

### 1.1. 整型 (Integer Types)

选择合适的整型可以有效节省存储空间。`UNSIGNED` 关键字可以用来指定非负整数，使存储范围翻倍。

```
  类型       | 存储空间 | 范围 (有符号)          | 范围 (无符号)
-------------|----------|------------------------|--------------------
  TINYINT    | 1字节    | -128 到 127            | 0 到 255
  SMALLINT   | 2字节    | -32,768 到 32,767      | 0 到 65,535
  MEDIUMINT  | 3字节    | -8,388,608 到 8,388,607| 0 到 16,777,215
  INT        | 4字节    | -21亿 到 21亿          | 0 到 42亿
  BIGINT     | 8字节    | ...                    | ...
```

- **应用场景**：
  - `TINYINT`: 存储年龄、状态码等小范围数值。
  - `INT`: 最常用的类型，用于ID、计数等。

### 1.2. 字符型 (String Types)

选择 `CHAR` 还是 `VARCHAR` 是一个常见的性能与空间权衡问题。

- **`CHAR(N)`**: **定长字符串**。
  - **特点**：无论实际存储的字符有多少，它都会占用 `N` 个字符的固定空间。如果存入的字符数小于 `N`，剩余空间会用**空格补齐**。
  - **优点**：处理速度快，因为存储位置固定，检索效率极高（通常比 `VARCHAR` 快3倍左右）。
  - **缺点**：浪费存储空间。
  - **适用场景**：存储长度固定的数据，如MD5哈希值（32位）、性别（'M'/'F'）、邮政编码等。
- **`VARCHAR(N)`**: **可变长度字符串**。
  - **特点**：实际占用的空间是**内容的长度 + 1或2个字节**（用于记录长度）。`N` 代表的是最大长度。
  - **优点**：节省存储空间。
  - **缺点**：处理速度相对较慢，因为每次操作都需要先读取长度信息。
  - **适用场景**：存储长度不固定的数据，如用户名、文章标题、地址等。

### 1.3. 日期与时间类型 (Date and Time Types)

| 类型        | 存储空间 | 格式                  | 范围                                                   |
| ----------- | -------- | --------------------- | ------------------------------------------------------ |
| `DATE`      | 3字节    | 'YYYY-MM-DD'          | '1000-01-01' 到 '9999-12-31'                           |
| `TIME`      | 3字节    | 'HH:MM:SS'            | '-838:59:59' 到 '838:59:59'                            |
| `DATETIME`  | 8字节    | 'YYYY-MM-DD HH:MM:SS' | '1000-01-01 00:00:00' 到 '9999-12-31 23:59:59'         |
| `TIMESTAMP` | 4字节    | 'YYYY-MM-DD HH:MM:SS' | '1970-01-01 00:00:01' UTC 到 '2038-01-19 03:14:07' UTC |
| `YEAR`      | 1字节    | YYYY                  | 1901 到 2155                                           |

- **`DATETIME` vs `TIMESTAMP`**:
  - `TIMESTAMP` 占用空间更小，且与时区相关。它会自动将插入的时间从当前时区转换为UTC时区进行存储，查询时再转回当前时区。
  - `DATETIME` 与时区无关，存储的是字面值。

## 2. 多表连接查询 (JOIN)

当需要的数据分散在多个表中时，就需要使用 `JOIN` 将它们关联起来进行查询。

### 2.1. 多表连接练习环境准备

为了更好地理解和练习，我们先创建一个包含学生、课程、成绩和教师的数据库环境。

```
-- 创建数据库和表结构
DROP DATABASE IF EXISTS school;
CREATE DATABASE school CHARSET utf8mb4;
USE school;

CREATE TABLE student(
    sno INT NOT NULL PRIMARY KEY AUTO_INCREMENT COMMENT '学号',
    sname VARCHAR(20) NOT NULL COMMENT '姓名',
    sage TINYINT UNSIGNED NOT NULL COMMENT '年龄',
    ssex ENUM('f','m') NOT NULL DEFAULT 'm' COMMENT '性别'
) ENGINE=INNODB CHARSET=utf8;

CREATE TABLE course(
    cno INT NOT NULL PRIMARY KEY COMMENT '课程编号',
    cname VARCHAR(20) NOT NULL COMMENT '课程名字',
    tno INT NOT NULL COMMENT '教师编号'
) ENGINE=INNODB CHARSET utf8;

CREATE TABLE sc (
    sno INT NOT NULL COMMENT '学号',
    cno INT NOT NULL COMMENT '课程编号',
    score INT NOT NULL DEFAULT 0 COMMENT '成绩'
) ENGINE=INNODB CHARSET=utf8;

CREATE TABLE teacher(
    tno INT NOT NULL PRIMARY KEY COMMENT '教师编号',
    tname VARCHAR(20) NOT NULL COMMENT '教师名字'
) ENGINE=INNODB CHARSET utf8;

-- 插入示例数据
INSERT INTO student(sno,sname,sage,ssex) VALUES
(1,'zhang3',18,'m'), (2,'zhang4',18,'m'), (3,'li4',18,'m'), (4,'wang5',19,'f'),
(5,'zh4',18,'m'), (6,'zhao4',18,'m'), (7,'ma6',19,'f'), (8,'oldboy',20,'m'),
(9,'oldgirl',20,'f'), (10,'oldp',25,'m');

INSERT INTO teacher(tno,tname) VALUES
(1,'oldguo'), (2,'oldwang');

INSERT INTO course(cno,cname,tno) VALUES
(1,'mysql',1), (2,'linux',1), (3,'python',2);

INSERT INTO sc(sno,cno,score) VALUES
(1,1,80), (1,2,90), (1,3,99), (2,1,70), (2,2,60), (2,3,80),
(3,1,80), (3,2,80), (3,3,80), (4,1,50), (4,2,30), (4,3,20),
(5,1,70), (5,2,90), (6,1,90), (6,3,90), (7,2,88), (7,3,99);
```

### 2.2. 连接类型与 ASCII 图解

- **内连接 (INNER JOIN)**: 只返回两个表中能通过连接条件匹配上的行。

  ```
    Table A          Table B
  +-------+        +-------+
  |   1   |        |   A   |
  |   2   |        |   B   |
  |   3   |        |   C   |
  +-------+        +-------+
      | INNER JOIN |
      +------------+
      | 1 | A      |
      | 2 | B      |
      +------------+
  ```

- **左连接 (LEFT JOIN)**: 返回左表的所有行，以及右表中能匹配上的行。如果右表没有匹配项，则右表的列显示为 `NULL`。

  ```
    Table A          Table B
  +-------+        +-------+
  |   1   |        |   A   |
  |   2   |        |   B   |
  |   3   |        |   C   |
  +-------+        +-------+
      |  LEFT JOIN |
      +------------+
      | 1 | A      |
      | 2 | B      |
      | 3 | NULL   |
      +------------+
  ```

- **右连接 (RIGHT JOIN)**: 与左连接相反，返回右表的所有行。

### 2.3. 多表连接查询实战例子

**例子1：统计每位老师所讲的课程数量**

```
SELECT
    t.tname,
    COUNT(c.cno) AS course_count
FROM teacher t
JOIN course c ON t.tno = c.tno
GROUP BY t.tname;
```

**例子2：查询`oldguo`老师所教课程的平均分**

```
SELECT
    t.tname,
    c.cname,
    AVG(sc.score) AS average_score
FROM teacher t
JOIN course c ON t.tno = c.tno
JOIN sc ON c.cno = sc.cno
WHERE t.tname = 'oldguo'
GROUP BY t.tname, c.cname;
```

**例子3：查询`oldguo`老师所教课程的不及格学生姓名及分数**

```
SELECT
    s.sname,
    c.cname,
    sc.score
FROM student s
JOIN sc ON s.sno = sc.sno
JOIN course c ON sc.cno = c.cno
JOIN teacher t ON c.tno = t.tno
WHERE t.tname = 'oldguo' AND sc.score < 60;
```

**例子4：查询每门课程的平均成绩，并按平均分降序排序**

```
SELECT
    c.cname,
    AVG(sc.score) AS avg_score
FROM course c
LEFT JOIN sc ON c.cno = sc.cno
GROUP BY c.cname
ORDER BY avg_score DESC;
```

## 3. SQL 高级查询：窗口函数 (Window Functions)

窗口函数是一种特殊的函数，它对与当前行相关的**一组**（一个窗口）数据进行计算，而不是像普通聚合函数那样对整个分组进行计算。这使得我们可以在一行中同时展示**个体信息**和**聚合信息**。

### 3.1. 窗口函数基本语法

```
SELECT
    ...,
    <窗口函数>() OVER (
        [PARTITION BY <分组列>]
        [ORDER BY <排序列>]
        [ROWS BETWEEN <窗口范围>]
    ) AS alias
FROM ...;
```

- **`OVER()`**: 定义窗口的关键字。
- **`PARTITION BY`**: **分区/分组**。它将数据分成多个逻辑分区，窗口函数在每个分区内独立计算。
- **`ORDER BY`**: **排序**。它定义了分区内数据的排序方式，这对于排名和累计计算至关重要。

### 3.2. 常用窗口函数

- **排名函数**:
  - `ROW_NUMBER()`: 为分区内的每一行分配一个从1开始的连续排名。
  - `RANK()`: 排名函数，如果值相同，则排名相同，但会跳过后续排名（如：1, 2, 2, 4）。
  - `DENSE_RANK()`: 排名函数，值相同则排名相同，且排名是连续的（如：1, 2, 2, 3）。
- **聚合函数**:
  - `SUM()`, `AVG()`, `COUNT()`, `MAX()`, `MIN()` 都可以用作窗口函数。

### 3.3. 窗口函数实战

**场景：查询每个班级内部，按成绩从高到低的学生排名。**

```
+-----------+---------+-------+
|  班级     |  学生   |  分数 |
+-----------+---------+-------+
|  一班     |  张三   |  95   |  <-- 窗口1 (一班)
|  一班     |  李四   |  88   |
+-----------+---------+-------+
|  二班     |  王五   |  92   |  <-- 窗口2 (二班)
|  二班     |  赵六   |  98   |
+-----------+---------+-------+
```

**查询语句**:

```
SELECT
    sname,
    cname,
    score,
    ROW_NUMBER() OVER (PARTITION BY c.cname ORDER BY sc.score DESC) AS ranking
FROM sc
JOIN student s ON sc.sno = s.sno
JOIN course c ON sc.cno = c.cno;
```

- `PARTITION BY c.cname`: 按课程名（如'mysql', 'linux'）将数据分成不同的窗口。
- `ORDER BY sc.score DESC`: 在每个课程窗口内，按分数降序排列。
- `ROW_NUMBER()`: 为排序后的每一行分配排名。

**场景：查询每个学生的分数，以及该学生所在课程的平均分。**

```
SELECT
    s.sname,
    c.cname,
    sc.score,
    AVG(sc.score) OVER (PARTITION BY c.cname) AS course_avg_score
FROM sc
JOIN student s ON sc.sno = s.sno
JOIN course c ON sc.cno = c.cno;
```

这个查询可以在每一行都显示出该课程的整体平均分，而不需要额外的子查询或连接。

## 4. SQL 查询执行顺序

理解 SQL 查询子句的逻辑执行顺序对于编写复杂查询和进行性能优化至关重要。

```
(1) FROM <表名>
(2) ON <连接条件>
(3) JOIN <连接表>
(4) WHERE <过滤条件>
(5) GROUP BY <分组>
(6) HAVING <分组后过滤>
(7) SELECT <选择列>
(8) DISTINCT
(9) ORDER BY <排序>
(10) LIMIT <行数限制>
```

**注意**：这个顺序是**逻辑执行顺序**，而不是你编写 SQL 的顺序。例如，`WHERE` 子句在 `SELECT` 之前执行，所以你不能在 `WHERE` 中使用 `SELECT` 子句中定义的别名。

## 5. 数据库主从复制 (Master-Slave Replication)

主从复制是实现数据库**读写分离**、**高可用**和**数据备份**的核心技术。

### 5.1. 复制原理

```
+--------------+                                +---------------+
| Master DB    |                                | Slave DB      |
| (主库)       |                                | (从库)        |
+--------------+                                +---------------+
       | 1. 写入操作 (INSERT, UPDATE, DELETE)
       |
       v
+--------------+
| Binary Log   | -- 2. Binlog Dump Thread ----> +---------------+
| (二进制日志) |                                | Relay Log     |
+--------------+                                | (中继日志)    |
                                                 +---------------+
                                                        | 3. SQL Thread
                                                        v
                                                 (在从库上重放SQL)
```

1. **主库记录变更**: 主库上所有的**数据修改操作**都会被记录到二进制日志 (`Binary Log`) 中。
2. **从库请求日志**: 从库上的 **I/O 线程**连接到主库，请求从指定位置开始的 `Binary Log` 内容，并将其写入到本地的**中继日志 (`Relay Log`)** 中。
3. **从库重放操作**: 从库上的 **SQL 线程**读取 `Relay Log` 中的事件，并在从库上**重放**（执行）这些 SQL 操作，从而使从库的数据与主库保持一致。

### 5.2. 主从复制配置实战

**前提**:

- 主库和从库的 MySQL 版本应尽量一致。
- 主从服务器时间应保持同步。

**步骤1：在主库 (Master) 上的操作**

1. **修改配置文件 `my.cnf`**:

   ```
   [mysqld]
   server-id = 1             # 服务器唯一ID
   log_bin = mysql-bin       # 开启并指定binlog文件名
   log_bin_index = mysql-bin.index
   ```

2. **重启 MySQL 服务**。

3. **创建复制专用用户**:

   ```
   -- 创建一个名为 'repl' 的用户，密码为 '123'，允许从 10.0.0.% 网段连接
   GRANT REPLICATION SLAVE ON *.* TO 'repl'@'10.0.0.%' IDENTIFIED BY '123';
   FLUSH PRIVILEGES;
   ```

4. **锁定数据库并记录当前 `binlog` 位置**:

   ```
   FLUSH TABLES WITH READ LOCK;
   SHOW MASTER STATUS;
   ```

   记下 `File` (如 `mysql-bin.000014`) 和 `Position` (如 `608`) 的值。**保持这个会话不要退出**。

5. **备份主库数据** (在另一个终端执行):

   ```
   mysqldump -uroot -p --all-databases --master-data=2 --single-transaction -R --triggers > /tmp/full.sql
   ```

6. **解锁主库**:

   ```
   UNLOCK TABLES;
   ```

7. **将备份文件传输到从库**。

**步骤2：在从库 (Slave) 上的操作**

1. **修改配置文件 `my.cnf`**:

   ```
   [mysqld]
   server-id = 2             # 必须与主库不同
   relay-log = slave-relay-bin
   relay_log_index = slave-relay-log.index
   ```

2. **重启 MySQL 服务**。

3. **导入主库数据**:

   ```
   mysql -uroot -p < /tmp/full.sql
   ```

4. **配置从库连接主库**:

   ```
   CHANGE MASTER TO
       MASTER_HOST = '主库IP地址',
       MASTER_PORT = 3306,
       MASTER_USER = 'repl',
       MASTER_PASSWORD = '123',
       MASTER_LOG_FILE = '刚才记下的File名',
       MASTER_LOG_POS = 刚才记下的Position值;
   ```

5. **启动复制进程**:

   ```
   START SLAVE;
   ```

6. **检查复制状态**:

   ```
   SHOW SLAVE STATUS\G
   ```

   如果看到 `Slave_IO_Running: Yes` 和 `Slave_SQL_Running: Yes`，并且 `Seconds_Behind_Master` 为0或很小，则表示主从复制配置成功。