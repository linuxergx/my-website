#### 设计目标
![](Pasted%20image%2020221228225237.png)
#### 为什么要分表
* 基于MySQL来讲单表超过==2千万行== 性能会下降  
* 阿里巴巴《Java 开发手册》提出单表行数超过 500 万行或者单表容量超过 2GB，才推荐进行[分库分表](https://so.csdn.net/so/search?q=%E5%88%86%E5%BA%93%E5%88%86%E8%A1%A8&spm=1001.2101.3001.7020)。对此，有阿里的黄金铁律支撑，所以，很多人设计大数据存储时，多会以此为标准，进行分表操作。
*  事实上，这个数值和实际记录的条数无关，而与 MySQL 的==配置==以及==机器的硬件==有关。因为，MySQL 为了提高性能，会将表的索引装载到内存中。==InnoDB buffer size ==足够的情况下，其能完成全加载进内存，查询不会有问题。但是，当单表数据库到达某个量级的上限时，导致内存无法存储其索引，使得之后的 SQL 查询会产生磁盘 IO，从而导致性能下降。当然，这个还有具体的表结构的设计有关，最终导致的问题都是内存限制。

* 达到特定行数的时候Btree高度会增加 每增加一层高度 索引扫描就会多一次IO 对应的响应的时间会增加  

#### 传统分库分表
1. 以单维度划分 用户的订单角度划分 商家的品类划分
2. 存在数据倾斜问题
3. 分表是预分法  需要提前设计 预留空间 成本颇高   存在resharding 再次分配就需要按照 原表数量的倍数划分 
4. ![](Pasted%20image%2020221228230443.png)
5. 实时性:
6. ![](Pasted%20image%2020221228230555.png)
#### 使用者考虑的切实问题
![](Pasted%20image%2020221228231738.png)

### TiDB Server
#### TiDB Server架构

![](Pasted%20image%2020221231194409.png)
#### 各个模块功能
1. ![](Pasted%20image%2020221231194512.png)SQL语句的解析和编译 进行物理与逻辑优化 Protocol Layer 用户登录认证赋权 协议层
2. ![](Pasted%20image%2020221231194555.png)执行计划最终交给执行器去执行  Transaction执行事务相关的计划 范围查询 表连接 嵌套查询 distSQL负责 单行查询 单列查询 主键索引  走kv模块
3. ![](Pasted%20image%2020221231194732.png)与pd进行交互获取TSO时间戳
4. ![](Pasted%20image%2020221231194745.png)与TiKV进行交互 
5. ![](Pasted%20image%2020221231194805.png)负责OnLine DDL
6. ![](Pasted%20image%2020221231194845.png)用于缓存读取的数据与元数据 登录的认证信息
7. ![](Pasted%20image%2020221231194905.png)热点小表缓存  数据量不大 改动不大但查询频率高的
##### 启动顺序
![](Pasted%20image%2020230110223402.png)
#### 词法分析与语法分析
![](Pasted%20image%2020221231195629.png)
#### 抽象语法树
![](Pasted%20image%2020221231195530.png)
语句优化 谓词下推 
物理优化 数据分部大小  算子 决定走什么索引 
类似于一个导游图
#### 在线DDL语句
同一时刻只能一个worker做操作
![](Pasted%20image%2020221231210648.png)
1. start job 接受DDL语句
	1. 此任务会被放到TiKV的任务队列里
	2. TiDB server 的Owner角色的worker负责从队列中取第一个job执行
	3. 执行完成之后将此job放入历史队列中
	4. Owner角色的TiDB server schema load模块负责同步TiKV的表元数据  

#### GC
1. TiDB server集群中会有一个被选为GC leader 由他来控制整个集群的GC机制
2. 每次 GC 时,10分钟一次叫做 _GC life time_ 首先,_TiDB_ 会计算一个称为 _safe_ _point_ 的时间戳,接下来 _TiDB_ 会在保证 _safe_ _point_ 之后的快照全部拥有正确数据的前提下,删除更早的过期数据
3. 每十分钟触发一次 会保留最近的数据
#### TiDB server 缓存
* TiDB的缓存组成
	* SQL结果
	* 线程缓存
	* 元数据 统计信息
* TiDB server 缓存管理
	* tidb_mem_quota_query # 控制每条查询能够使用多大的存储
	* oom-action # 当你的SQL超过上面设置的阈值之后 是如何返回结果 (返回error 写入日志.... )

哈希jion (在TiDB server 缓存中执行的)表连接 子查询

#### 热点小表缓存
* 多小才能叫小表? 
	* 64M以下*
![](Pasted%20image%2020221231215711.png)
直接使用alter table users cache;即可存入*cache table*中 
##### 缓存租约
_tidb_table_cache_lease=5_  单位是秒 这5秒之内用户可以直接从TiDB server中读取这张表 过时不候
如果要写入数据的话 只能等租约到期

过期之后的写 是写到了TiKV中


#### TiKV
![](Pasted%20image%2020230101174230.png)
Comprocessor 协处理器 进行==算子下推优化== 将一部分==过滤聚合==计算交给TiKV完成 可以并行执行
1. 两个RocksDB 本身
	 1. 存取KV
		 1. 每个region以及副本构成 raft group 
	 2. 存取raft log
##### rocksdb 中的列簇 

![](Pasted%20image%2020230101181041.png)
延迟小 完善的持久化机制 ssd固态盘 
对多核心系统友好

##### 内存写操作
涉及到存储引擎LSM Tree
1. lsm tree 会将所有的插入 删除操作存储在内存中
2. 达到一定数量之后再批量写入磁盘中 写入时会和之前的数据做合并
3. 直接插入 不是在原来的位置上做修改 和B+树不同 避免了随机写入 是顺序写入
4. LSMtree 写入横跨了 内存与磁盘  MEmTable
	1. (1,tom) 在写入磁盘之前先生成WAL日志 防止磁盘掉电 写入失败 (原子性和持久性的技术) 配置的参数 sync_log=true 直接往磁盘写 不经过内存缓存
	2. 当 _write_buffer_size_ 达到一定大小之后就会触发合并 rocksdb重新开辟一块空间将数据存储到固定内存区域 _immutable MenTable_  有一条就往磁盘中刷 (优势是防止写磁盘阻塞) 默认5条开始限制速度 _write still_
5. 
![](Pasted%20image%2020230101181203.png)
[深入浅出分析LSM树（日志结构合并树）](深入浅出分析LSM树（日志结构合并树）.md)
##### RocksDB 磁盘写入机制

![](Pasted%20image%2020230101183410.png)
落盘之后
 Level 0 就是 _immutable Memtable_ 的复刻 文件达到4个之后就会将数据传递给下一层 这层进行压缩   _compaction_  操作  SST table文件  是已经按key排序的 如果要找的话 就使用二分查找法
  以此类推 sst文件数量级逐级递增 
**任何操作都是有 LSM tree 新增进行操作的**
#### RocksDB的查询操作(比B+树慢)
![](Pasted%20image%2020230101183733.png)
1. block cache 最近最常缓存  
2. 未命中的话就在memtable
3. 未命中就去DISK中查找 
布隆过滤器 1978年发明 判断集合中的元素是否存在 
有误识别率  判断不在 
kv 的存储引擎设计参考了 rocksdb和[level db](https://blog.csdn.net/inthat/article/details/113751448?utm_medium=distribute.pc_relevant.none-task-blog-2~default~baidujs_baidulandingword~default-0-113751448-blog-124828824.pc_relevant_aa&spm=1001.2101.3001.4242.1&utm_relevant_index=3)的特点 
##### 列簇 Colum Family
1. 将kv按照不同的属性分配给不同的cf
写入的时候指定去哪个列簇  如果不指定 那将去默认的default列簇
#### 两阶段提交 分布式事务锁
![](Pasted%20image%2020230102004752.png)
1. 要修改的数据首先进入到default的cf中 同时会加上一个TSO时间戳 pk 主锁  @xxx 会指向锁的位置
2. Lock的CF 会标出写锁 
3. 写入时会获得一个TSO 写入之后也会获得开始时间与写入时间
4. 锁清理: 向Lock CF标出D 删除所信息 
	1. 在查询的时候是在 write的CF查询数据最近一次写入时间和提交时间 根据信息到default CF中查找数据 
	2. 如果数据在Write CF 没有找到 说明处于W 状态 
防止分布式事务原子性被破坏


#### Raft log
![](Pasted%20image%2020230102155315.png)
region 号+ 数字序号
1. propose 客户端 收到请求将请求写入到raft写入日志
2. append  将raft日志写入到rocksdb (持久化) 如果其他节点没有返回消息 日志就不会被应用成功 
3.  replicate raft leader节点将日志同步到follower节点 
4. commitade 大部分节点≥50%写入之后  返回写入成功标志 
5. apply 真正写入到rocksdb 数据可以从tikv中读取
![](Pasted%20image%2020230102172507.png)
#### Raft Leader 选举机制 
term --> 将时间划分为选举时间内的最小单位
region 选举计时器  _election time out_  10s  集群刚被创建没有leader raft group 发起选举的时长   对应的配置叫做 ==_raft-election-timeout-ticks_== 多少个ticks时间之后发起


Heatbeat interval  对应的TiKV参数 ==_raft-heatbeat-ticks_==   假设该值等与10 那用10 / raft-base-tick-interval 即可


#### TiKV数据写入
读的线性一致性


#### PD 
![](Pasted%20image%2020230103182718.png)
* 集成了ETCD 支持了自动故障转移 同时也通过ETCD的raft保证了数据的强一致性 
##### 功能
1. 元数据存储  [名词释义](TiDB原厂课程.md#名词释义)
2. 全局时钟  TSO 
3. 分配全局ID和事务ID
4. 收集集群信息进行调度 
5. 通过lebel 支持高可用
6. 提供TiDB Bashboad

##### 名词释义
* _store_ : TiKV实例
* _region_ : 维护集群中连续的数据 96-144m之间 每份数据会在不同的TiKV stroe 存储一个或多个副本 
	* region的每个副本叫 ==_Peer_==   一个 _region_  的多个 Peer 通过 raft协议进行数据同步  
* muilt raft 多个raft group 组构成的  

##### PD 路由功能
执行计划发给Executor执行器 去查询TiKV Client 中的Region Cache  ==元数据缓存==与更新机制 
1. 减少网络开销
2. 减轻PD压力
* 如果本地有元数据 
	* 则按照本地元数据指定的region中查询  
		* 如果通过 _Region Cache_ 存的的本地元数据查询不到,(==这一过程叫 _back_off_  数量越多越影响读取== ) (region分裂 重新选举)
		* 就向PD节点询问新的元数据指向的region
	* 如果没有就向PD去询问 
##### TSO分配 : TSO概念
TSO = physical time logical time  这是一个int 64的整数
physical time unix时间 精确到毫秒
logical time 逻辑时间 1ms 分成262144个TSO
1秒内可以产生 2亿6千万条数据 

##### TSO分配过程

![](Pasted%20image%2020230103193126.png)
* SQL与事务会请求TSO 统称TSO请求者
* PDClient是 tso请求者与pd的代理模块  有延迟  是串行操作 肯定慢如何解决 ?
* tsFuture 内存中的对象 标记了什么时刻请求了TSO 当PDclient 请求TSO的 PD通过网络返回TSO的时候 tsFuture成为 tsFuture.wait状态 并解析编译生成执行计划 
* 分配到TSO之后由PD Client将数据分配给TSO请求者.
PD client成为异步  可以进行批处理 可以在某一个时间段内处理一批请求


##### TSO分配 时间窗口
![](Pasted%20image%2020230103203258.png)
###### 减轻磁盘IO
PD每申请一次都要写一次磁盘 频繁写盘必定会在业务高峰期对单点造成压力 

一次分配3s的TSO 都扔到缓存里 磁盘位置未录为N+3s 
用完之后继续分配3sTSO

###### 高可用如何保持
 如果 PD leader 发生了选主之后 从PD 成为Leader 新的PD Leader 并不知道 给到的TiDB Server的TSO在哪一秒 于是新的PD Leader 将从上一个PD Leader基础上重新增加3s
 * 可以保证增长性 但无法保持连续性 
##### 调度 总流程    ResourceManager
信息收集--_operator_--> 生成调度--->执行调度
1. 信息收集
	 1. store Hearbeat
	 2. region Heartbeat


1. 生成调度
	1. balance 
		1. Leader  (是否均衡分部在所有TiKV上)
		2. Region (存储压力 不要过多集赞Region)
	3. Hot Region  (是否 某个Leader 读写频繁 将数据打散分散在各个节点)
	4. 集群拓扑
	5. 缩容
	6. 故障恢复
	7. Region merge (对于已经Delete 或者Drop掉的数据 Region相对较空  减少维护成本)



 1. 执行调度 
	 1. 分裂
	 2. 合并
	 3. 执行调度

##### Label 与高可用
![](Pasted%20image%2020230103210034.png)
本质让TiKV知道哪一个Region在哪一个机柜哪一个数据中心
要在PD与TIKV上进行配置

#### SQL执行计划
##### DML 语句读流程
 1. Protocol Layer 协议层接受用户请求 去PD节点获取一个唯一的TSO时间戳
 2. Parse 将SQL解析成抽象语法树 将语法树发送给complie模块
 3. Compile会区分出语句读典查和非典查 将任务下发给执行器
 4. Execute 就会从TiKV中读取数据（RocksDB） 数据读取回来之后交由ProtocolLayer模块返回给用户
 5. DML读取流程结束
##### DML写流程
![[62722602-BCB2-4060-B3FD-ABC0918221AF.png]]
1. Protocol Layer协议层接收写请求 鉴权 语法故障分析 获取TSO开始时间
2. Parse解析
3. Compile编译
4. Execute执行  去RocksDB中把需要修改的数据先读出来
5. 读出来之后会将数据放入 ==_MemBuffer_==中缓存起来 在缓存中进行修改
6. 当用户开始提交 commit之后触发两阶段提交 Transaction
	1. prewrite 预写 开始加锁信息  通过 Scheduler 调度到Leader 节点 再通过 Raftstore 路由到follwer节点
	2. 当真正apply的时候数据写入了RocksDB KV数据库中 
7. 写入之后清锁信息
	1. 读取事务的TSO结束时间
	2. 通过协议层返回用户 告诉用户写入完成
##### DDL流程概要
![](Pasted%20image%2020230104204032.png)

* 对表的定义修改
* 加索引
1. TiKV中队列类型
	1. 除了加索引的操作 都是job queue
	2. add index queue 加索引操作
	3. history queue 历史消息队列 执行过的DDL放这里
TiDB server中owner觉得负责执行DDL 语句
##### SQL的Parse(解析)与Complie(编译)
![](Pasted%20image%2020230104204216.png)

1. LES与语法分析YACC词法分析LEx与语法分析YACC  转换成AST 抽象语法树
2. AST被传输到Complie模块
3. preprocess 预处理阶段 检测SQL合法性
4. 逻辑优化  逻辑代数等价交换规则 由==外连接转化成内连接==
5. 物理优化 ==表的行数 列的行数 选择最优的算子 ==
6. 编译最后的产物就是 ==物理执行计划==
7. 拿着执行计划去TiKV中执行
##### 读取的执行流程
![](Pasted%20image%2020230104204951.png)
 1.  直接从缓存中读取infomation schema  
 2. 获取要要读取的表的Region 去读取PD
 3. snap shot 特定的时间点的数据结构 快照  
 4. root task tidb server节点的所有任务的集合 
 5. cop task 单个region上的子任务 
##### 写入的执行
![](Pasted%20image%2020230104205614.png)
与DML相似
![](Pasted%20image%2020230104205803.png)
写冲突管理lanch 防止同时写入同一个数据
##### DDL
![](Pasted%20image%2020230104210010.png)
TiDB server 中 worker模块的owner角色才具有执行的权限 同一时刻只能有一个worker来干活
owner worker去定期查询 TiKV的队列
owner worker  角色有PD控制 


#### HTAP
![](Pasted%20image%2020230104223019.png)
![](Pasted%20image%2020230104223107.png)
MPP架构只能在TiFlash完成
##### MPP特点
![](Pasted%20image%2020230104223347.png)


![](Pasted%20image%2020230104223521.png)并行执行 节点越多越快 
表连接发生在Tiflash
聚合发生在TiFlash

#### TiFlash
![](Pasted%20image%2020230104224311.png)
* TiKV将数据传给TiFlash用的是Raft Lrarner
* 大量扫表的操作会给到Tikv
* TiFlash 写异步 读一致
* 引擎智能选择 CBO 可以针对SQL混合使用 
* 计算加速 TiFlash ==承担一部分过滤与合并同类项==作用

##### 异步复制
![](Pasted%20image%2020230104224914.png)
1. 通过确认raft log的index来找到某一时刻的数据 没有就等

#### TiDBv6 新特性

##### 章节内容
![](Pasted%20image%2020230104230640.png)
1. Placement Rules in SQL
	1. 跨地域部署的集群 无法本地访问
		1. 通过pd和Tidb server 设置labels
		2. 创建数据放置策略![](Pasted%20image%2020230104231547.png)
		3. 让新建的表去匹配放置策略![](Pasted%20image%2020230104231817.png)
		4. 优势: ![](Pasted%20image%2020230104231923.png)
	2. 无法根据业务隔离资源
	3. 难以按照业务等级配置资源和副本数

##### 小表缓存

![](Pasted%20image%2020230104232645.png)

##### 悲观锁
![](Pasted%20image%2020230104233212.png)
写之前告诉别人某数据被修改中 减少回滚可能
内存悲观锁: 只写到缓存中 不复制到其他region  (写磁盘与复制省掉了 只在内存中读写)

###### 很容易出现所丢失  
* 出现回滚 

###### 配置方式
1. ![](Pasted%20image%2020230104233724.png)
2. 还可以修改配置重启TiKV实例

#### TiDB cloud
![](Pasted%20image%2020230105000945.png)