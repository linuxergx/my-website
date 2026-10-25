/**
 * CKA 考试题目数据源
 * 关键字已手动使用 <code> 标签处理，支持点击复制
 */
const examQuestions = {
    1: {
        title: "HPA 自动扩缩容",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 你必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            在 <code>autoscale namespace</code> 中创建一个名为 <code>apache-server</code> 的新 <code>HorizontalPodAutoscaler(HPA)</code>。此 HPA 必须定位到 <code>autoscale namespace</code> 中名为 <code>apache-server</code> 的现有 <code>Deployment</code>。<br><br>
            将 HPA 设置为每个 Pod 的 CPU 使用率旨在 <code>50%</code>。将其配置为至少有 <code>1</code> 个 Pod，且不超过 <code>4</code> 个 Pod。此外，将缩小稳定窗口设置为 <code>30 秒</code>。
        `
    },
    2: {
        title: "Ingress",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            如下创建新的 Ingress 资源：<br>
            名称： <code>echo</code><br>
            Namespace： <code>sound-repeater</code><br>
            使用 <code>Service 端口 8080</code> 在 <code>http://example.org/echo</code> 上公开 <code>echoserver-service</code> Service。
        `
    },
    3: {
        title: "sidecar",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Context:</b> 您需要将一个传统应用程序集成到 Kubernetes 的日志架构(例如 <code>kubectl logs</code>)中。实现这个要求的通常方法是添加一个流式传输并置容器。</p>
            <p><b>Task:</b></p>
            更新现有的 <code>synergy-leverager Deployment</code>，将使用 <code>busybox:stable</code> 镜像，且名为 <code>sidecar</code> 的并置容器，添加到现有的 Pod。<br><br>
            新的并置容器必须运行以下命令：<br>
            <code>/bin/sh -c "tail -n+1 -f /var/log/synergy-leverager.log"</code><br><br>
            使用挂载在 <code>/var/log</code> 的 Volume，使日志文件 <code>synergy-leverager.log</code> 可供并置容器使用。<br>
            除了添加所需的卷挂载之外，请勿修改现有容器的规范。
        `
    },
    4: {
        title: "StorageClass",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            首先，为名为 <code>rancher.io/local-path</code> 的现有制备器，创建一个名为 <code>ran-local-path</code> 的新 <code>StorageClass</code>。<br>
            将卷绑定模式设置为 <code>WaitForFirstConsumer</code>。<br><br>
            <div class="warning-box">注意：没有设置卷绑定模式，或者将其设置为 WaitForFirstConsumer 之外的其他任何模式，都将导致分数降低。</div><br>
            接下来，将 <code>ran-local-path StorageClass</code> 配置为默认的 <code>StorageClass</code>。<br>
            请勿修改任何现有的 Deployment 和 PersistentVolumeClaim，否则将导致分数降低。
        `
    },
    5: {
        title: "Service",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            重新配置 <code>spline-reticulator namespace</code> 中现有的 <code>front-end Deployment</code>，以公开现有容器 nginx 的端口 <code>80/tcp</code>。<br>
            创建一个名为 <code>front-end-svc</code> 的新 <code>Service</code> ，以公开容器端口 <code>80/tcp</code>。<br>
            配置新的 <code>Service</code> ，以通过 <code>NodePort</code> 公开各个 Pod。
        `
    },
    6: {
        title: "Pod 优先级 PriorityClass",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            请执行以下任务：<br>
            1. 为用户工作负载创建一个名为 <code>high-priority</code> 的新 <code>PriorityClass</code> ，其值比用户定义的现有最高优先级类值小一。<br>
            2. 修改在 <code>priority namespace</code> 中运行的现有 <code>busybox-logger Deployment</code> ，以使用 <code>high-priority</code> 优先级类。<br>
            3. 确保 <code>busybox-logger Deployment</code> 在设置了新优先级类后成功部署。<br><br>
            <div class="warning-box">注意：请勿修改在 priority namespace 中运行的其他 Deployment，否则可能导致分数降低。</div>
        `
    },
    7: {
        title: "Argo CD",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            通过执行以下任务在集群中安装 Argo CD：<br>
            1. 添加名为 <code>argo</code> 的官方 Argo CD Helm 存储库。<br>
            2. 为 <code>argocd namespace</code> 生成 Argo CD Helm 图表版本 <code>7.7.3</code> 的模板，并将其保存到 <code>~/argo-helm.yaml</code>。<br>
            3. 将图表配置为<b>不安装 CRDs</b>。使用 Helm 安装 Argo CD ，并设置发布名称为 <code>argocd</code> ，使用与模板中相同的配置和版本（7.7.3），将其安装在 <code>argocd namespace</code> 中。<br><br>
            <div class="warning-box">注意：您不需要配置对 Argo CD UI 的访问权限。</div>
        `
    },
    8: {
        title: "PVC 数据恢复",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            mariadb namespace 中的 MariaDB Deployment 被误删除。请恢复该 Deployment 并确保数据持久性。<br>
            1. 在 <code>mariadb namespace</code> 中创建名为 <code>mariadb</code> 的 <code>PVC</code>：访问模式为 <code>ReadWriteOnce</code>，存储为 <code>250Mi</code>。<br>
            2. 集群中现有一个 <code>PersistentVolume</code>，你必须使用现有的 <code>PV</code>。<br>
            3. 编辑位于 <code>~/mariadb-deployment.yaml</code> 的文件，以使用上一步中创建的 <code>PVC</code>。将更新的 Deployment 文件应用到集群。<br>
            4. 确保 MariaDB Deployment 正在运行且稳定。
        `
    },
    9: {
        title: "Gateway API 迁移",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            将现有 Web 应用程序从 Ingress 迁移到 <code>Gateway API</code>。您必须维护 HTTPS 访问权限。<br>
            <div class="warning-box">注意：集群中安装了一个名为 nginx 的 GatewayClass。</div><br>
            1. 创建名为 <code>web-gateway</code> 的 <code>Gateway</code> ，主机名为 <code>gateway.web.k8s.local</code> ，保持现有名为 <code>web</code> 的 Ingress 资源的现有 TLS 和侦听器配置。<br>
            2. 创建名为 <code>web-route</code> 的 <code>HTTPRoute</code> ，主机名为 <code>gateway.web.k8s.local</code> ，并保持现有路由规则。<br>
            3. 最后，删除名为 <code>web</code> 的现有 Ingress 资源。
        `
    },
    10: {
        title: "NetworkPolicy 安全策略",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            从提供的 YAML 样本中查看并应用适当的 <code>NetworkPolicy</code>。确保不过于宽松，同时允许 <code>frontend</code> 和 <code>backend</code> namespaces 中的 Pod 通信。<br>
            1. 分析 <code>frontend</code> 和 <code>backend</code> Deployment，确定具体要求。<br>
            2. 检查位于 <code>~/netpol</code> 文件夹中的示例。<br><br>
            <div class="warning-box">注意：请勿删除或修改提供的示例。仅应用其中一个。请勿删除现有的默认拒绝策略。</div>
        `
    },
    11: {
        title: "定制资源定义 CRD",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            1. 使用 <code>kubectl</code> ，将 cert-manager 所有定制资源定义（<code>CRD</code>）的列表，保存到 <code>~/resources.yaml</code>。<br>
            <div class="warning-box">注意：您必须使用 kubectl 的默认输出格式。请勿设置输出格式。</div><br>
            2. 使用 <code>kubectl</code> ，提取定制资源 <code>Certificate</code> 的 <code>subject</code> 规范字段的文档，并将其保存到 <code>~/subject.yaml</code>。
        `
    },
    12: {
        title: "ConfigMap 不可变配置",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            1. 名为 <code>nginx-static</code> 的 NGINX Deployment 正在 <code>nginx-static</code> namespace 中运行。它通过名为 <code>nginx-config</code> 的 <code>ConfigMap</code> 进行配置。<br>
            2. 更新 <code>nginx-config</code> ConfigMap 以仅允许 <code>TLSv1.2 TLSv1.3</code> 连接。<br>
            <div class="warning-box">注意：您可以根据需要重新创建、重新启动或扩展资源。</div><br>
            测试命令：<code>curl -k --tls-max 1.2 https://web.k8snginx.local</code><br>
            最后请将 <code>nginx-config ConfigMap</code> 设置为<b>不可变</b>。
        `
    },
    13: {
        title: "Calico CNI 安装",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            安装并设置满足要求的 CNI：<br>
            选项：Flannel 0.26.1 或 <code>Calico 3.27.0</code>。<br>
            选择的 CNI 必须：<br>
            1. 让 Pod 相互通信。<br>
            2. <b>支持 Network Policy 实施</b>。<br>
            3. 从清单文件安装（<b>请勿使用 Helm</b>）。
        `
    },
    14: {
        title: "Resources 资源配额",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            在 <code>relative-fawn namespace</code> 中调整 WordPress Deployment 的资源请求：<br>
            1. 将节点资源平均分配给这 3 个 Pod。<br>
            2. 为每个 Pod 分配公平的 CPU 和内存份额，添加足够的开销以保持节点稳定。<br>
            3. 确保对<b>容器和初始化容器</b>使用完全相同的请求。无需更改限制。<br>
            4. 更新后确认 WordPress 保持 3 个副本且所有 Pod 就绪。
        `
    },
    15: {
        title: "ETCD 修复",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            修复损坏的单节点集群：<br>
            1. 确定损坏的组件。注意：已停用的集群使用<b>外部 etcd 服务器</b>。<br>
            2. 修复所有损坏的配置。<br>
            <div class="warning-box">注意：确保重新启动所有必要的服务和组件，以使更改生效。</div><br>
            3. 确保集群运行正常，每个节点和所有 Pod 都处于 Ready 状态。<br>
            <div class="warning-box">注意：模拟环境做此题前需执行 /root/etcd-set.sh 将其置为考试状态。</div>
        `
    },
    16: {
        title: "CRI-Dockerd 配置",
        context: "<code>ssh cka000000</code>",
        content: `
            <div class="warning-box">⚠️ 您必须连接到正确的主机。不这样做可能导致零分。</div>
            <p><b>Task:</b></p>
            1. 安装 <code>cri-dockerd</code>：使用 dpkg 安装 <code>~/cri-dockerd_0.3.6.3-0.ubuntu-jammy_amd64.deb</code>。<br>
            2. 启用并启动 cri-docker 服务。<br>
            3. 配置系统参数并确保重启后持久：<br>
               - <code>net.bridge.bridge-nf-call-iptables = 1</code><br>
               - <code>net.ipv6.conf.all.forwarding = 1</code><br>
               - <code>net.ipv4.ip_forward = 1</code><br>
               - <code>net.netfilter.nf_conntrack_max = 131072</code>
        `
    }
};

// 兼容老版本的引用方式
if (typeof module !== 'undefined') {
    module.exports = examQuestions;
}