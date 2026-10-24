---
format: md
sidebar_position: 2
title: ais_bench 性能测试工具使用参考
---

## ais_bench性能测试工具使用参考  



###  1、安装ais_bench工具 

```bash
git clone https://gitee.com/aisbench/benchmark.git
cd benchmark/
pip3 install -e ./
```

###  2、修改测试脚本 

```bash
vi ais_bench/benchmark/configs/models/vllm_api/vllm_api_stream_chat.py
```

#### 测试脚本配置参考 

```bash
from ais_bench.benchmark.models import VLLMCustomAPIChatStream

models = [
    dict(
        attr="service",
        type=VLLMCustomAPIChatStream,
        abbr='vllm-api-stream-chat',
        path="/home/models/Qwen3-14B",   #模型权重路径   
        model="Qwen",                    #模型名称，调用mindie服务对应配置文件modelName参数
        request_rate = 0,
        retry = 2,
        host_ip = "127.0.0.1",           
        host_port = 1025,
        max_out_len = 1024,
        batch_size= 40,
        trust_remote_code=False,
        generation_kwargs = dict(
            #纯性能测试建议删除脚本默认配置，仅保留temperature，ignore_eos需设置为True
            temperature=0,         
            ignore_eos = True             
        )
    )
]
```

#### 数据集生成配置，以synthetic为例 

```bash
vi ais_bench/datasets/synthetic/synthetic_config.py
```

####  配置参考：RequestCount根据batch_size进行设置，建议设置batch_size*4 



```bash
synthetic_config = {
    "Type":"string",   # [tokenid/string]，生成的随机数据集类型，支持固定长度的随机tokenid，和随机长度的string，两种类型的数据集
    "RequestCount":  160, # 生成的请求条数，一般设置为4倍并发
    "TrustRemoteCode": False, #是否信任远端代码，tokenid模式下需要加载tokenizer生成tokenid，默认为Fasle
    "StringConfig" : {  # string类型的随机数据集的配置相关项，请参考以上注释处："StringConfig中的随机生成方法参数说明"
        "Input" : {     # 每条请求的输入长度
            "Method": "uniform",
            "Params": {"MinValue": 4096, "MaxValue": 4096}
        },
        "Output" : {    # 每条请求的输出长度
            "Method": "uniform",
            "Params": {"MinValue": 1024, "MaxValue": 1024}
        }
    },
    "TokenIdConfig" : { # tokenid类型的随机数据集的配置相关项
        "RequestSize": 4096 # 每条请求的长度，即每条请求中token id的个数，应与模型侧配置文件中的 input_seq_len 一致
    }
}
```

### 3、测试命令 

```bash
ais_bench --models vllm_api_stream_chat --datasets synthetic_gen  --debug --summarizer default_perf --mode perf
```



#### K8s集群内部压测前环境监测脚本

```bash
#!/bin/bash

# 1. 定义日志文件（带时间戳，避免重复）
LOG_FILE="cann_version_check_$(date +%Y%m%d_%H%M%S).log"

# 2. 检查containerd是否可用
if ! command -v crictl &> /dev/null; then
    echo "错误：未找到crictl命令，请确保crictl已安装并配置环境变量"
    exit 1
fi

# 3. 获取运行中的容器ID（保留原命令的awk+grep逻辑）
CONTAINER_IDS=$(crictl ps | awk '{print $1}' | grep -v CONTAINER)

# 4. 检查是否有运行中的容器
if [ -z "$CONTAINER_IDS" ]; then
    echo "提示：当前没有正在运行的containerd容器" | tee -a "$LOG_FILE"
    exit 0
fi

# 5. 遍历容器执行命令并记录结果
echo "=== CANN版本检查开始（$(date)） ===" | tee -a "$LOG_FILE"
echo "运行中的容器数量：$(echo "$CONTAINER_IDS" | wc -l)" | tee -a "$LOG_FILE"
echo "日志文件路径：$(pwd)/$LOG_FILE" | tee -a "$LOG_FILE"
echo "----------------------------------------" | tee -a "$LOG_FILE"

for container_id in $CONTAINER_IDS; do
    # 获取容器名称（提升结果可读性）
    container_name=$(crictl inspect --format '{{.Name}}' "$container_id" 2>/dev/null | sed 's/^\///')
    [ -z "$container_name" ] && container_name="未命名容器"

    echo -e "\n【容器信息】" | tee -a "$LOG_FILE"
    echo "ID: $container_id" | tee -a "$LOG_FILE"
    echo "名称: $container_name" | tee -a "$LOG_FILE"
    echo "----------------------------------------" | tee -a "$LOG_FILE"

    # 执行原命令（去掉-it，避免交互模式报错；重定向错误输出）
    echo "CANN版本文件内容：" | tee -a "$LOG_FILE"
    crictl exec "$container_id" cat /usr/local/Ascend/ascend-toolkit/latest/aarch64-linux/ascend_toolkit_install.info 2>>"$LOG_FILE" | tee -a "$LOG_FILE"
    
    # 检查命令执行结果
    if [ $? -ne 0 ]; then
        echo "提示：该容器中未找到CANN版本文件或无访问权限" | tee -a "$LOG_FILE"
    fi
    echo "----------------------------------------" | tee -a "$LOG_FILE"
done

echo -e "\n=== 检查完成（$(date)） ===" | tee -a "$LOG_FILE"
echo "所有结果已保存到日志文件：$(pwd)/$LOG_FILE" | tee -a "$LOG_FILE
```

####  **containerd** 环境压测前环境监测脚本
```bash
#!/bin/bash

# 1. 定义日志文件（带时间戳，避免重复）
LOG_FILE="cann_version_check_$(date +%Y%m%d_%H%M%S).log"

# 2. 检查containerd是否可用
if ! command -v nerdctl &> /dev/null; then
    echo "错误：未找到nerdctl命令，请确保nerdctl已安装并配置环境变量"
    exit 1
fi

# 3. 获取运行中的容器ID（保留原命令的awk+grep逻辑）
CONTAINER_IDS=$(nerdctl ps | awk '{print $1}' | grep -v CONTAINER)

# 4. 检查是否有运行中的容器
if [ -z "$CONTAINER_IDS" ]; then
    echo "提示：当前没有正在运行的containerd容器" | tee -a "$LOG_FILE"
    exit 0
fi

# 5. 遍历容器执行命令并记录结果
echo "=== CANN版本检查开始（$(date)） ===" | tee -a "$LOG_FILE"
echo "运行中的容器数量：$(echo "$CONTAINER_IDS" | wc -l)" | tee -a "$LOG_FILE"
echo "日志文件路径：$(pwd)/$LOG_FILE" | tee -a "$LOG_FILE"
echo "----------------------------------------" | tee -a "$LOG_FILE"

for container_id in $CONTAINER_IDS; do
    # 获取容器名称（提升结果可读性）
    container_name=$(nerdctl inspect --format '{{.Name}}' "$container_id" 2>/dev/null | sed 's/^\///')
    [ -z "$container_name" ] && container_name="未命名容器"

    echo -e "\n【容器信息】" | tee -a "$LOG_FILE"
    echo "ID: $container_id" | tee -a "$LOG_FILE"
    echo "名称: $container_name" | tee -a "$LOG_FILE"
    echo "----------------------------------------" | tee -a "$LOG_FILE"

    # 执行原命令（去掉-it，避免交互模式报错；重定向错误输出）
    echo "CANN版本文件内容：" | tee -a "$LOG_FILE"
    nerdctl exec "$container_id" cat /usr/local/Ascend/ascend-toolkit/latest/aarch64-linux/ascend_toolkit_install.info 2>>"$LOG_FILE" | tee -a "$LOG_FILE"
    
    # 检查命令执行结果
    if [ $? -ne 0 ]; then
        echo "提示：该容器中未找到CANN版本文件或无访问权限" | tee -a "$LOG_FILE"
    fi
    echo "----------------------------------------" | tee -a "$LOG_FILE"
done

echo -e "\n=== 检查完成（$(date)） ===" | tee -a "$LOG_FILE"
echo "所有结果已保存到日志文件：$(pwd)/$LOG_FILE" | tee -a "$LOG_FILE
```
