# Tomcat 运维实战笔记 (图解详尽版)



### 第一部分：Tomcat 基础入门

## 1. 核心概念

- **JDK (Java Development Kit)**: Java 开发工具包，包含了 JRE，还提供了编译器、调试器等开发工具。**部署 Tomcat 必须安装 JDK**。
- **JRE (Java Runtime Environment)**: Java 运行环境，包含了 JVM 和 Java 核心类库，是运行 Java 程序所必需的。
- **JVM (Java Virtual Machine)**: Java 虚拟机，Java 程序运行的平台，实现了“一次编译，到处运行”的跨平台特性。
- **Tomcat**: 一个开源的轻量级 Web 应用服务器，主要用于解析和执行 Java Servlet 和 JSP 页面。

## 2. 环境部署与目录结构

部署 Tomcat 前，需先安装并配置好 JDK 环境。

#### Tomcat 核心目录结构

<pre>
/app/tomcat/
├── bin/         # 存放启动、关闭等可执行脚本 (startup.sh, shutdown.sh, catalina.sh)
├── conf/        # 核心配置文件目录 (server.xml, web.xml, tomcat-users.xml)
├── lib/         # 存放 Tomcat 运行所需的 JAR 包
├── logs/        # 日志文件目录 (catalina.out, access_log)
├── temp/        # 临时文件目录
├── webapps/     # Web 应用部署目录 (存放 WAR 包或解压后的项目)
└── work/        # JSP 文件编译后生成的 .java 和 .class 文件存放目录
</pre>

## 3. Tomcat 的三种工作模式

Tomcat 的工作模式（连接器协议）决定了它如何处理网络请求，直接影响其性能。

| 模式    | 全称                    | 特点                                         | 适用场景                                          |
| ------- | ----------------------- | -------------------------------------------- | ------------------------------------------------- |
| **BIO** | Blocking I/O            | 同步阻塞 I/O，一个线程处理一个请求。         | Tomcat 7 及更早版本的默认模式，并发能力差。       |
| **NIO** | New I/O                 | 同步非阻塞 I/O，可以用少量线程处理大量连接。 | **Tomcat 8 及以后版本的默认模式**，性能较高。     |
| **APR** | Apache Portable Runtime | 从操作系统层面解决异步 I/O 问题，性能最高。  | 适用于高并发应用，需额外安装 `tomcat-native` 库。 |

### 第二部分：Tomcat 核心配置

## 4. 主配置文件 `server.xml` 详解

这是 Tomcat 最核心的配置文件，位于 `conf/` 目录下。

- **`<Server>`**: 顶层组件，代表整个 Catalina Servlet 容器。
  - `port="8005"`: **关闭端口**，用于接收 `SHUTDOWN` 命令。可通过 telnet 连接此端口并发送 `SHUTDOWN` 字符串来关闭 Tomcat。
- **`<Service>`**: 服务组件，包含一个或多个 `<Connector>` 和一个 `<Engine>`。
- **`<Connector>`**: 连接器，负责接收客户端请求并转发给 `<Engine>` 处理。
  - `port="8080"`: **HTTP 访问端口**。
  - `protocol="HTTP/1.1"`: 默认使用 NIO 模式。
  - `connectionTimeout="20000"`: 连接超时时间（毫秒）。
  - `port="8009"`: AJP 协议端口，用于与 Apache 等其他 Web 服务器集成。**若只用 Nginx+Tomcat，建议注释掉此端口以提高性能**。
- **`<Engine>`**: 引擎，处理来自连接器的请求。
- **`<Host>`**: 虚拟主机，定义一个网站。
  - `name="localhost"`: 虚拟主机名（域名）。
  - `appBase="webapps"`: 该虚拟主机下 Web 应用的存放目录。
  - `unpackWARs="true"`: 是否自动解压 WAR 包。
  - `autoDeploy="true"`: 是否自动部署新应用。
- **`<Valve>`**: 阀门，用于记录访问日志。
  - `className="org.apache.catalina.valves.AccessLogValve"`: 访问日志阀门。
  - `directory="logs"`: 日志存放目录。
  - `prefix="localhost_access_log"`: 日志文件名前缀。
  - `pattern="..."`: 定义日志格式。

## 5. 虚拟主机配置

在 `<Engine>` 标签内添加 `<Host>` 块来配置虚拟主机。

```
<Host name="game.oldxu.com" appBase="/code/game"
      unpackWARs="true" autoDeploy="true">
    <!-- 日志配置等 -->
</Host>
```

## 6. 部署 Java 应用 (WAR 包)

以 JPress 博客系统为例，部署前通常需要先准备好数据库。

1. **准备数据库**:

   ```
   -- 登录 MariaDB/MySQL
   mysql
   
   -- 创建数据库
   CREATE DATABASE jpress CHARSET utf8;
   
   -- 创建用户并授权
   GRANT ALL ON jpress.* TO jpress@'localhost' IDENTIFIED BY '123456';
   GRANT ALL ON jpress.* TO jpress@'172.16.%.%' IDENTIFIED BY '123456';
   FLUSH PRIVILEGES;
   ```

2. **部署 WAR 包**:

   - 将 `jpress.war` 文件放入 `webapps/` 目录下。
   - Tomcat 启动后会自动解压成 `jpress/` 目录。
   - 首次访问应用时，根据页面提示完成数据库配置。配置文件通常位于 `jpress/WEB-INF/classes/db.properties`。

## 7. 配置 Tomcat 多实例

在一台服务器上运行多个独立的 Tomcat 服务，互不干扰。

1. **复制 Tomcat 目录**:

   ```
   cp -r /app/tomcat /app/tomcat_8081
   cp -r /app/tomcat /app/tomcat_8082
   ```

2. **修改端口**: 修改每个实例的 `conf/server.xml` 文件，确保 **Server port**, **Connector port (HTTP)**, 和 **Connector port (AJP)** 都不相同。

   - **示例**:
     - `tomcat_8081`: 8006 (shutdown), 8081 (http), 8010 (ajp)
     - `tomcat_8082`: 8007 (shutdown), 8082 (http), 8011 (ajp)

   ```
   # 快速修改 tomcat_8081 的端口
   sed -i.bak 's/8005/8006/' /app/tomcat_8081/conf/server.xml
   sed -i.bak 's/8080/8081/' /app/tomcat_8081/conf/server.xml
   sed -i.bak 's/8009/8010/' /app/tomcat_8081/conf/server.xml
   ```

3. **分别启动并验证**:

   ```
   /app/tomcat_8081/bin/startup.sh
   /app/tomcat_8082/bin/startup.sh
   ss -lntup | grep java
   ```

### 第三部分：Tomcat 高级应用与优化

## 8. 安全优化策略

1. **降权启动 (监牢模式)**:

   - 创建一个专门的普通用户（如 `tomcat`）来运行 Tomcat 服务，而不是使用 `root`。

   - **步骤**:

     ```
     useradd tomcat
     chown -R tomcat.tomcat /app/tomcat
     su - tomcat -c "/app/tomcat/bin/startup.sh"
     ```

   - **注意**: 普通用户无法使用 1-1024 的特权端口。如果需要使用 80 端口，需要使用 `root` 启动或通过 Nginx 代理。

2. **管理端口保护**:

   - 修改 `server.xml` 中 `<Server>` 标签的 `port` 和 `shutdown` 字符串，防止被恶意关闭。

     ```
     <Server port="8527" shutdown="A_VERY_SECRET_STRING">
     ```

3. **禁用 AJP 端口**:

   - 如果未使用 Apache + Tomcat 架构，应在 `server.xml` 中注释掉 AJP `<Connector>`。

4. **禁用管理端**:

   - 生产环境中，应删除 `webapps/` 目录下的 `docs`, `examples`, `host-manager`, `manager` 等默认应用。

5. **禁止目录列表**:

   - 修改 `conf/web.xml`，将 `listings` 参数的值改为 `false`，防止列出目录内容。

     ```
     <init-param>
         <param-name>listings</param-name>
         <param-value>false</param-value>
     </init-param>
     ```

## 9. 性能优化：JVM 与连接器

#### JVM 内存优化

在 `bin/catalina.sh` 脚本的开头添加 `JAVA_OPTS` 参数来调整 JVM 内存。

```
# 设置 JVM 初始内存(-Xms)为物理内存的 1/64，最大内存(-Xmx)为 1/4
JAVA_OPTS="-Xms512m -Xmx1024m"
```

#### 连接器 (Connector) 优化

在 `server.xml` 的 `<Connector>` 标签中调整线程相关参数。

- **`maxThreads`**: 最大并发线程数。推荐值在 200-500 之间，取决于业务类型（计算密集型设小，IO 密集型设大）。
- **`acceptCount`**: 当所有可用线程都在使用时，可以放入请求队列的最大长度。通常与 `maxThreads` 设为一致。
- **`minSpareThreads`**: 最小空闲线程数，Tomcat 启动时创建的线程数。
- **`connectionTimeout`**: 连接超时时间（毫秒）。

```
<Connector port="8080" protocol="HTTP/1.1"
           maxThreads="500"
           acceptCount="500"
           minSpareThreads="25"
           connectionTimeout="20000" />
```

## 10. 远程监控 (JMX) 配置

通过 JMX (Java Management Extensions) 可以使用 `jconsole`, `VisualVM` 等工具远程监控 Tomcat 的性能。

在 `bin/catalina.sh` 中添加 `CATALINA_OPTS` 参数。

```
CATALINA_OPTS="$CATALINA_OPTS \
-Dcom.sun.management.jmxremote \
-Dcom.sun.management.jmxremote.port=12345 \
-Dcom.sun.management.jmxremote.authenticate=false \
-Dcom.sun.management.jmxremote.ssl=false \
-Djava.rmi.server.hostname=YOUR_SERVER_IP"
```

### 第四部分：Tomcat 运维与排错

## 11. 日志管理与分析

- **`catalina.out`**: Tomcat 的主要日志文件，记录了标准输出和错误信息。需要配置日志切割工具（如 `logrotate`）进行管理。
- **`localhost_access_log.txt`**: 访问日志，记录了每个请求的详细信息。

## 12. 常见故障排查流程 (CPU 占用过高)

当发现 Java 进程 CPU 占用率持续过高时，可以按以下流程定位问题线程。

<pre>
+---------------------------------+
| 1. 找出有问题的 Java 进程 PID   |
|    # top 或 ps aux | grep java  |
+---------------------------------+
|
v
+---------------------------------+
| 2. 找出该进程中最耗 CPU 的线程 TID|
|    # top -Hp [Java_PID]         |
+---------------------------------+
|
v
+---------------------------------+
| 3. 将线程 TID 转换为十六进制    |
|    # printf "%x\n" [Thread_TID] |
+---------------------------------+
|
v
+---------------------------------+
| 4. 导出线程堆栈信息             |
|    # jstack [Java_PID] > stack.log |
+---------------------------------+
|
v
+---------------------------------+
| 5. 在堆栈中查找对应的十六进制TID |
|    # grep -i [Hex_TID] stack.log |
+---------------------------------+
|
v
+---------------------------------+
| 6. 分析线程堆栈，交给开发人员    |
+---------------------------------+
</pre>

**常用排错工具**:

- **`jps`**: 显示当前运行的 Java 进程。
- **`jstack`**: 打印 Java 进程的线程堆栈信息。
- **`jmap`**: 查看 JVM 堆内存使用情况。