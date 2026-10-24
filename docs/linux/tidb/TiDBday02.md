### TiDB数据库表结构
#### TiDB与MySQL差异对比
```bash
1.不支持: 存储过程 触发器 自定义函数
2.分区表性能一般
3.视图部分支持
```

![](Pasted%20image%2020221221092805.png)
### 表
#### 表的定义

* 表是集群中的一种逻辑对象,它属于数据库,用于保存从SQL中发送的数据
* 表以行和列的形式组织数据记录,一张表至少有一列.若在表中定义了n个列,那么每一行的数据将用于这n个列中完全一致的字段.


建表语句:   支持的列的数据类型
```bash
CREATE TABLE {table_name} ( {elements} );
• {table_name}: 表名
• {elements}:以逗号分割的表元素列表,比如列定义,主键定义等.
```
```bash
CREATE TABLE `test`.`users` (
`id` bigint primary key,
`student_name` varchar(100),
`birthday` varchar(100),
`phone` int(11),
`score` int(11)
);
#table_id的存储方式information_schema.tables
> select * from information_schema.tables where table_schema='test' and
table_name='users' limit 1\G
*************************** 1. row ***************************
TABLE_CATALOG: def
TABLE_SCHEMA: test
TABLE_NAME: users
TABLE_TYPE: BASE TABLE
ENGINE: InnoDB
VERSION: 10
ROW_FORMAT: Compact
TABLE_ROWS: 0
AVG_ROW_LENGTH: 0
DATA_LENGTH: 0
MAX_DATA_LENGTH: 0
INDEX_LENGTH: 0
DATA_FREE: 0
AUTO_INCREMENT: NULL
CREATE_TIME: 2022-11-14 16:45:33
UPDATE_TIME: NULL
CHECK_TIME: NULL
TABLE_COLLATION: utf8mb4_bin
CHECKSUM: NULL
CREATE_OPTIONS:
TABLE_COMMENT:
TIDB_TABLE_ID: 2240 #TABLE_ID
TIDB_ROW_ID_SHARDING_INFO: NOT_SHARDED(PK_IS_HANDLE)
TIDB_PK_TYPE: CLUSTERED
```
#### TiDB的region存储方式
TiDB中的数据是在RocksDB中以KV键值对的⽅式存储的
数据存储管理的基本单元为Region
- 每⼀个region默认⼤⼩为96MB
- 每⼀个Region按照左闭右开的区间划分数据存储范围，如：[a ~ d),[d ~ g)
- 每⼀个schema会被分配⼀个唯⼀的TableID



**1、⾮聚簇表KV的映射规则**
```bash
Key: tablePrefix{TableID}_recordPrefixSep{_Tidb_RowID}
Value: [col1,col2,col3,col4]  #KV存储中Value存储真实的⾏数据
```
**2、聚簇表的KV映射规则**
```bash
Key: tablePrefix{TableID}_recordPrefixSep{Col1} #col1为cluster index
Value: [col2,col3,col4]
```
**3、示例**

```bash
CREATE TABLE `ratings` (
`id` bigint PRIMARY KEY CLUSTERED,
`name` varchar(20),
`role` varchar(20)
);
```

#### 聚簇表与非聚簇表设计
**聚簇表**

##### 1、定义：

- 表中⾏存储的顺序与主键存储的顺序⼀致即为聚簇表
- 表的主键即为KV映射中Key的⼀部分
- 通过主键访问⾏记录时，可以直接获取⾏记录


##### 2、优劣势：

优势：
-  插⼊数据时会减少⼀次从⽹络写⼊索引数据。
-  等值条件查询仅涉及主键时会减少⼀次从⽹络读取数据。
-   范围条件查询仅涉及主键时会减少多次从⽹络读取数据。
-  等值或范围条件查询仅涉及主键的前缀时会减少多次从⽹络读取数据。
劣势：
-   批量插⼊⼤量取值相邻的主键时，可能会产⽣较⼤的写热点问题。
-   当使⽤⼤于 64 位的数据类型作为主键时，可能导致表数据需要占⽤更多的存储空间。该现象在存在多个⼆级索引时尤为明显。

未显式指定聚簇关键字的语句，默认⾏为受系统变量`@@global.tidb_enable_clustered_index` 影响。该变
量有三个取值：

- OFF 表示所有主键默认使⽤⾮聚簇索引。
⾮聚簇表设计
判断是否为聚簇索引表
- ON 表示所有主键默认使⽤聚簇索引。
- INT_ONLY，默认值，⾏为受`alter-primary-key`参数控制（true:主键⾮聚簇，false:单整主键默认聚簇）
#### 分区表


##### 1. 类型

1. Range 分区
2. List 分区
3. ist columns 分区
4. Hash 分区


##### 2. 作⽤：
1. ange分区，list分区和List COLUMNS 分区可以⽤于解决业务员中⼤量删除带来的性能问题hash分区则可以⽤于⼤量希尔场景下的数据打散
2. 分务表的每个唯⼀键，必须包含分区表达式中⽤到的所有列。
##### 3. Range 分区

1. range分区范围取值,⽐如⽉份时间管理。
2. 可以基于 timestamp 列的值分区，并使⽤ unix_timestamp() 函数


```bash
-- 示例：
CREATE TABLE employees (
id INT NOT NULL,
fname VARCHAR(30),
lname VARCHAR(30),
hired DATE NOT NULL DEFAULT '1970-01-01',
separated DATE DEFAULT '9999-12-31',
job_code INT,
store_id INT NOT NULL)
PARTITION BY RANGE (store_id) (
PARTITION p0 VALUES LESS THAN (6),
PARTITION p1 VALUES LESS THAN (11),
PARTITION p2 VALUES LESS THAN (16),
PARTITION p3 VALUES LESS THAN (21),
PARTITION p4 VALUES LESS THAN MAXVALUE
);
	
```

设置范围分配到某个区域中  `LESS THAN MAXVALUE` 大于21的数字被分配到这里

适合频繁查询分区的场景



##### 4、List 分区

1. 将 session 变量 tidb_enable_list_partition 的值设置为 ON
2. 可通过 PARTITION ... VALUES IN (...) ⼦句对值进⾏定义
    示例：
```bash
CREATE TABLE employees (
id INT NOT NULL,
hired DATE NOT NULL DEFAULT '1970-01-01',
store_id INT)
PARTITION BY LIST (store_id) (
PARTITION pNorth VALUES IN (1, 2, 3, 4, 5),
PARTITION pEast VALUES IN (6, 7, 8, 9, 10),
PARTITION pWest VALUES IN (11, 12, 13, 14, 15),
PARTITION pCentral VALUES IN (16, 17, 18, 19, 20)
);
```
##### 5、list columns 分区
1. 是 List 分区的⼀种变体
2. 可以将多个列⽤作分区键
3. 可以将整数类型以外的数据类型的列⽤作分区列
4. 可以使⽤字符串类型、DATE 和 DATETIME 类型的列
    示例：
```bash
CREATE TABLE employees_1 (
id INT NOT NULL,
fname VARCHAR(30),
lname VARCHAR(30),
hired DATE NOT NULL DEFAULT '1970-01-01',
separated DATE DEFAULT '9999-12-31',
job_code INT,
store_id INT,
city VARCHAR(15))
PARTITION BY LIST COLUMNS(city) (
PARTITION pRegion_1 VALUES IN('LosAngeles', 'Seattle', 'Houston'),
PARTITION pRegion_2 VALUES IN('Chicago', 'Columbus', 'Boston'),
PARTITION pRegion_3 VALUES IN('NewYork', 'LongIsland', 'Baltimore'),
PARTITION pRegion_4 VALUES IN('Atlanta', 'Raleigh', 'Cincinnati')
);
```
##### 6、Hash分区
-  保证数据均匀地分散到⼀定数量的分区⾥⾯
- 打散数据,避免热点
示例：

```bash
CREATE TABLE employees (
id INT NOT NULL,
fname VARCHAR(30),
lname VARCHAR(30),
hired DATE NOT NULL DEFAULT '1970-01-01',
separated DATE DEFAULT '9999-12-31',
```