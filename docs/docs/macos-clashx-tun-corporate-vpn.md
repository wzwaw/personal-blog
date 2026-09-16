# 一次 macOS 双隧道故障排查：ClashX TUN 与公司 VPN 如何共存

前端开发中有一类问题很容易被误判成“接口挂了”：浏览器打不开公司后台，但关闭代理后立刻恢复；域名解析看起来正常，Clash 规则也明确命中了 `DIRECT`，请求却仍然超时。

这次问题的环境是：

- macOS
- ClashX Meta，必须开启 TUN 模式
- 公司内网必须通过另一条 VPN 访问
- 普通互联网流量仍需经过 Clash

最终根因不是一条写错的规则，而是同时开启了 **Clash TUN** 和 **macOS 系统代理**。两种入口叠加后，浏览器请求进入 Clash 的路径发生了变化，Clash 的直连出口走向物理网卡，而不是公司 VPN。

> 本文中的域名、DNS 地址和网段均已替换为示例值，不对应真实公司环境。

## 问题现场

最初观察到的现象是：

1. 公司 VPN 单独开启时，内网后台可以访问。
2. 开启 ClashX 后，内网后台无法访问。
3. 在 macOS 网络设置中添加“忽略代理的域名”可以临时恢复，但过一段时间配置会消失。
4. 在 Clash 规则顶部添加 `DOMAIN-SUFFIX,...,DIRECT`，问题仍然存在。
5. Clash 日志显示规则确实命中了 `DIRECT`，但 TCP 连接超时。

第一条线索其实是“忽略代理配置会消失”。这通常意味着系统网络配置并不是唯一事实来源，Clash、VPN、PAC 或 MDM 正在持续重写它。只修改 macOS 图形界面里的代理例外，不会成为稳定方案。

## 第一轮判断：让域名走 DIRECT

最直观的处理是给公司域名增加直连规则：

```yaml
rules:
  - DOMAIN-SUFFIX,corp.example,DIRECT
  # 其他规则
```

规则要放在更宽泛的 `RULE-SET`、`GEOIP` 或 `MATCH` 规则之前，因为 Clash 从上到下使用第一条匹配规则。

但这里有一个关键误区：

> `DIRECT` 只表示“不经过 Clash 的远端代理节点”，并不表示“这个连接一定绕过 Clash 内核”，也不保证它一定通过公司 VPN 发出。

在系统代理模式下，请求已经先到达了 `127.0.0.1:7890`。即使规则命中 `DIRECT`，仍然是 Clash 代表浏览器重新建立一个对外连接。

## 第二轮判断：是不是 DNS 或 Fake-IP

TUN 模式经常使用 Fake-IP。域名解析后，应用可能先拿到 `198.18.0.0/16` 中的合成地址，再由 Clash 根据映射还原真实域名。

对于内网域名，这可能带来两个问题：

- 公司域名需要公司 DNS 才能解析。
- 操作系统看到的是 Fake-IP，无法根据真实公司网段选择 VPN 路由。

因此，常见配置会把整个公司域名后缀排除出 Fake-IP：

```yaml
dns:
  enhanced-mode: fake-ip
  fake-ip-filter:
    - 'corp.example'
    - '*.corp.example'
```

如果公司使用 Split DNS，还需要把该域名交给公司 DNS：

```yaml
dns:
  nameserver-policy:
    '+.corp.example':
      - 10.0.0.53
```

但 DNS 正确并不代表链路一定正确。这次排查中，域名已经成功解析到正确 IP，HTTPS 证书也没有问题，浏览器仍然打不开页面，说明故障点已经从“名字解析”推进到了“连接出口”。

## 第三轮判断：用证据拆分 DNS、路由和连接

### 确认系统代理

```bash
scutil --proxy
```

当输出中出现类似内容时，说明 macOS 系统代理仍然开启：

```text
HTTPEnable  : 1
HTTPSEnable : 1
SOCKSEnable : 1
HTTPProxy   : 127.0.0.1
HTTPPort    : 7890
```

此时浏览器不是直接连接目标服务器，而是先连接本机 Clash。

### 确认 DNS

```bash
scutil --dns
dscacheutil -q host -a name admin.corp.example
```

需要确认：

- 域名能够解析。
- 返回的不是意外的公网地址。
- 需要真实 IP 参与系统路由时，返回值不是 `198.18.*` Fake-IP。

### 确认系统会选择哪个接口

```bash
route -n get 198.51.100.10
```

重点查看 `interface`：

```text
interface: utun4
```

这表示操作系统认为该地址应通过某条 VPN 虚拟网卡发送。`route` 命令只展示本机决定的下一跳或出口接口，不会展示到服务器之间的完整互联网路径。

### 对比直连和显式代理

```bash
curl -vkI https://admin.corp.example/
curl -vkI -x http://127.0.0.1:7890 https://admin.corp.example/
```

这一步给出了决定性证据：

- 直接访问能够完成 TLS 握手并返回 HTTP 200。
- 经过 `127.0.0.1:7890` 时超时。
- Clash 日志显示域名规则命中了 `DIRECT`，真实 IP 也正确，但建立 TCP 连接超时。
- Clash 的 TUN 日志显示默认物理接口是 `en0`。

这说明 DNS、服务器和公司 VPN 本身都正常，问题只存在于“浏览器先进入系统代理，再由 Clash 发起 DIRECT 连接”这条路径。

## 真正的根因

同时开启系统代理和 TUN 后，浏览器请求走的是：

```text
浏览器
  → macOS 系统代理
  → 127.0.0.1:7890
  → Clash 匹配 DOMAIN-SUFFIX
  → DIRECT
  → Clash 使用默认物理接口 en0 建立新连接
  → 没有进入公司 VPN
  → 超时
```

这里即使配置了 TUN 的网段排除，也不一定能解决问题。原因是浏览器连接的目标首先是本机 `127.0.0.1`，真正访问公司 IP 的连接由 Clash 进程重新创建。它不是原始浏览器数据包继续按照系统 VPN 路由前进。

关闭系统代理、只保留 TUN 后，路径变成：

```text
浏览器
  → 解析得到真实公司 IP
  → macOS 查询路由表
  → 公司网段被排除出 Clash TUN
  → 公司 VPN utunN
  → VPN 加密封装
  → en0
  → 公司 VPN 网关
  → 内网服务器
```

最终稳定组合是：

```text
公司 VPN：开启
ClashX TUN：开启
ClashX“设置为系统代理”：关闭
```

## 最终配置思路

下面是经过脱敏的结构示例：

```yaml
dns:
  enable: true
  enhanced-mode: fake-ip
  fake-ip-filter:
    - 'corp.example'
    - '*.corp.example'
  nameserver-policy:
    '+.corp.example':
      - 10.0.0.53

tun:
  enable: true
  auto-route: true
  auto-detect-interface: true
  route-exclude-address:
    - 10.0.0.53/32
    - 198.51.100.0/24

rules:
  - DOMAIN-SUFFIX,corp.example,DIRECT
  - IP-CIDR,10.0.0.53/32,DIRECT,no-resolve
  - IP-CIDR,198.51.100.0/24,DIRECT,no-resolve
  # 原有规则
```

几个配置项各自解决不同问题：

- `fake-ip-filter`：让公司域名获得真实 IP，以便系统路由识别公司网段。
- `nameserver-policy`：只在公司域名需要专用 DNS 时配置。
- `route-exclude-address`：让公司 DNS 和公司网段绕过 Clash TUN，交回 macOS 路由表。
- `DOMAIN-SUFFIX`：即使请求进入 Clash，也不使用远端代理节点。
- `IP-CIDR`：作为 IP 规则层面的补充。

不要盲目把所有内网都写成 `10.0.0.0/8`。企业网络也可能使用非 RFC 1918 地址，应以 VPN 建立后的实际路由表为准。

如果配置来自订阅，还要注意订阅更新可能覆盖本地修改。长期配置应该放在 ClashX 的 Mixin、覆写配置或独立本地配置中，而不是反复修改即将被刷新的订阅文件。

## DNS、hosts、路由与 MAC 分别发生在哪里

这次排查还串起了一条完整的网络请求链路：

```text
应用解析 URL
  → hosts / DNS 把域名转换为 IP
  → 应用调用 connect(IP, port)
  → TCP 生成 SYN
  → 网络层封装 IP 数据包
  → 路由表选择出口接口和下一跳
  → VPN 或 Clash TUN 处理
  → 物理接口发出
  → TCP 握手完成
  → TLS 握手
  → HTTP 请求与响应
```

### hosts 属于名称解析

`/etc/hosts` 将域名静态映射到 IP，通常在向 DNS 发起查询前参与本机名称解析：

```text
198.51.100.10 admin.corp.example
```

它不负责获取 MAC 地址。

### MAC 地址在路由之后处理

得到目标 IP 并选定路由后，如果下一跳位于以太网或 Wi-Fi 链路上，IPv4 使用 ARP、IPv6 使用邻居发现获取下一跳设备的链路层地址。

远程服务器通常不在本地二层网络中，因此本机获取的往往是路由器或网关的 MAC，而不是远程服务器的 MAC。

### en0 和 utunN

- `en0`：当前主要物理网络接口，通常对应 Wi-Fi 或有线网卡。
- `utunN`：macOS 创建的用户态隧道接口，常被 VPN 和 TUN 软件使用。
- `utun4`、`utun5` 之类的编号是动态分配的，重连后可能变化。

因此，配置应根据域名和目标网段分流，不能依赖固定的 `utun4`。

### VPN 和 Clash 位于哪一层

在这个场景中：

- Clash 系统代理工作在应用层，浏览器显式连接本地 HTTP/SOCKS 代理。
- Clash TUN 在网络层接收 IP 数据包，同时结合域名和连接元数据执行规则。
- 公司 VPN 主要工作在网络层，把原始 IP 数据包加密封装进另一层传输。
- `en0` 是最终承载 VPN 或代理连接数据的物理接口。

虚拟网卡与物理网卡并不是简单的二选一。公司内网流量通常先进入 VPN 的 `utunN`，加密后的外层数据仍然要经过 `en0` 发出去。

## 可复用的排查顺序

以后再遇到“浏览器打不开，但看起来规则没问题”，可以按下面顺序处理。

### 1. 建立基准

先只开启访问目标所必需的公司 VPN，确认目标网站本身可用。

### 2. 验证名称解析

```bash
dscacheutil -q host -a name admin.corp.example
```

固定 IP 能访问、域名不能访问，优先检查 DNS、hosts、DoH 和 Fake-IP。

### 3. 验证路由

```bash
route -n get 198.51.100.10
```

确认目标 IP 是否进入预期 VPN 接口。

### 4. 验证传输和 TLS

```bash
curl -vkI https://admin.corp.example/
curl -vkI --resolve admin.corp.example:443:198.51.100.10 \
  https://admin.corp.example/
```

这样可以区分 DNS、TCP、TLS 和 HTTP 层的问题。

### 5. 检查是否同时开启了两种代理入口

```bash
scutil --proxy
```

如果已经使用 TUN，除非确实了解双入口的行为，否则不要同时开启系统代理。

### 6. 相信日志，不要只相信规则文件

“配置里写了 `DIRECT`”不等于请求真的沿预期接口出去。应同时检查：

- 实际命中的规则
- 解析到的真实 IP
- Clash 的默认出口接口
- 系统路由选择
- TCP 连接是成功、拒绝还是超时

如果日志已经显示 `DIRECT` 但仍然超时，继续反复调整域名规则通常没有意义，应该转向出口接口和路由排查。

## 对前端工程师的启发

浏览器控制台里的 `ERR_CONNECTION_TIMED_OUT` 只说明最终连接没有建立，不能直接推出是接口服务、证书或前端代码的问题。

前端联调至少涉及四个相互独立的层次：

1. 应用层：浏览器代理、开发服务器代理、HTTP 请求配置。
2. 名称解析：hosts、系统 DNS、DoH、Clash DNS、Fake-IP。
3. 网络路由：物理网卡、TUN、公司 VPN、目标网段。
4. 传输与安全：TCP、QUIC、TLS、证书和服务端监听。

最有效的排查方法不是一次修改很多配置，而是设计对照实验：

- 域名与固定 IP 对比。
- 直连与显式代理对比。
- TUN 开关对比。
- 浏览器与 `curl` 对比。

每次只改变一个变量，再用日志、DNS 结果、路由表和握手结果缩小范围。这次问题之所以最终定位成功，关键并不是增加了更多规则，而是发现了一个明确的矛盾：

> 同一台机器、同一个域名、同一个 VPN，直接请求返回 HTTP 200；经过本地系统代理后却在正确解析 IP 的情况下超时。

这个矛盾把问题从模糊的“Clash 和 VPN 冲突”，收敛成了具体的“系统代理改变了连接发起者和出口接口”。

