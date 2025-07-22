# 日志收集工具Loki

[toc]

#### 主流日志收集技术栈比对

| 技术栈    | 组件部署                                           | 适用场景                                                     | 资源消耗                                              |
| --------- | -------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| ELK 、EFK | Elasticsearch、Filebeat、Fluentd、Logstach、Kibana | 单机版本可支持T/天的日志增量，有一定的数据处理与清洗功能，可对接大数据。 | 日志存涉及Elasticsearch，该组件对内存资源使用较为庞大 |
| PLG       | Promtail+Loki+Grafana                              | go语言开发，查询速度较快，组件部署简单，不占用太多资源       | 低                                                    |



#### 部署情况

| 主机           | 组件版本        | 下载地址                                                   | 本地路径                                 |
| -------------- | --------------- | ---------------------------------------------------------- | ---------------------------------------- |
| 192.168.22.150 | promtail v2.8.6 | https://github.com/grafana/loki/releases/tag/v.2.8.6       | /data/loki-stack/promtail-linux-arm64    |
| 192.168.22.123 | loki v2.8.6     | https://github.com/grafana/loki/releases/tag/v.2.8.6       | /mnt/wenjian/loki-stack/loki-linux-amd64 |
| 192.168.22.123 | Grafana v10.0.1 | https://grafana.com/grafana/downlod/10.0.1?/platfrom=linux | /mnt/wenjian/loki-stack/grafana-10.0.1   |

#### 启动方式

* Promtail 192.168.22.150主机

```bash
root@lenovo-pc:~# cd /data/loki-stack
# 脚本启动promtail
root@lenovo-pc:/data/loki-stack# sh start.promtail.sh
# promtail脚本内容
root@lenovo-pc:/data/loki-stack# cat start.promtail.sh 
nohup ./promtail-linux-arm64 -config.file=promtail-config.yaml >> promtail.log 2>&1 &
echo "$!" >promtail.pid
# promtail配置文件
root@lenovo-pc:/data/loki-stack# cat promtail-config.yaml 
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml # 记录已读取日誌的進度，確保日誌不丟失或重複

clients:
  - url: http://192.168.22.123:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker # Docker 容器日志收集任务
    docker_sd_configs:
      - host: unix:///var/run/docker.sock # 从 Docker Socket 自动发现容器
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: container # 添加容器名称标签
      - source_labels: ['__meta_docker_container_id']
        target_label: instance # 添加容器 ID 标签
      - source_labels: ['__meta_docker_container_image']
        target_label: image # 添加容器镜像名称标签
      - source_labels: ['__meta_docker_container_state']
        target_label: state # 添加容器状态标签

```

* Loki+Grafana 192.168.22.123主机

```bash
[root@localhost ~]# cd /mnt/wenjian/loki-stack
# sh脚本直接启动
[root@localhost loki-stack]# sh start-loki+grafana.sh 
# 脚本内容
[root@localhost loki-stack]# cat start-loki+grafana.sh 
nohup ./loki-linux-amd64  -config.file=loki-config.yaml >> loki.log 2>&1 &
echo "$!" >loki.pid
sleep 1
cd grafana-10.0.1 && nohup ./bin/grafana-server >> grafana.log 2>&1 &
echo "$!" >grafana.pid
#  loki配置文件的内容
[root@localhost loki-stack]# cat loki-config.yaml 
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  instance_addr: 192.168.22.123
  path_prefix: /mnt/wenjian/loki-stack/loki
  storage:
    filesystem:
      chunks_directory: /mnt/wenjian/loki-stack/loki/chunks
      rules_directory: /mnt/wenjian/loki-stack/loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://localhost:9093
```



#### 日志查询工具使用方式

1. 登录 http://192.168.22.123:13000  账号 dev 密码 dev@123
2. 点击“探索” ![1750754520968](https://linuxergx.github.io/img/1750754520968.png)进行查询日志。
3. 数据源选择Loki ![1750754688541](https://linuxergx.github.io/img/1750754688541.png)，可选择时间范围或快速搜索时间范围。![1750754780550](https://linuxergx.github.io/img/1750754780550.png)

4. 一般选择容器名称进行查询![1750754926850](https://linuxergx.github.io/img/1750754926850.png)，value列可以看到容器名称，如果显示的容器名称少于正常数量，请把时间范围扩大进行搜索。![1750755025533](https://linuxergx.github.io/img/1750755025533.png)

5. 日志支持多多种查询规则，关键字、格式、ip、正则、标签等 ![1750755268772](https://linuxergx.github.io/img/1750755268772.png)

6. 模拟以wyb的关键字进行搜索，结果中有时间与日志量分布情况

![1750755627780](https://linuxergx.github.io/img/1750755627780.png)

![1750755645286](https://linuxergx.github.io/img/1750755645286.png)