# 会员邮件自动回复（Email Routing）

收信走 Cloudflare Email Routing（免费、无限）。Worker 收到邮件后会：

1. 识别申请类型并自动创建 VIP / API 账号  
2. 按固定模板尝试回信给申请人  
3. 把原信转发到已验证的管理员邮箱（免费）  
4. 把记录写入 D1 `member_applications`，后台「会员申请」页可查看/复制回信

## 费用说明

| 能力 | Workers Free | 说明 |
| --- | --- | --- |
| 收信（Email Routing） | 免费 | 推荐 |
| 转发到已验证目标邮箱 | 免费 | 例如 `yuyananuu@gmail.com` |
| `message.reply()` 回任意申请人 | 可能受限 | 若失败，看后台日志并改用 Resend |
| Resend 备选发信 | 免费额度 | 配置 `RESEND_API_KEY` |

结论：收信 + 自动开户 + 管理员抄送可在免费方案跑通；若 Cloudflare 无法回任意邮箱，配置 Resend 即可继续自动回信。

## Cloudflare 控制台配置

1. 打开 **Email** → **Email Routing**，为 `mini-tools.uk` 启用路由。  
2. 验证目标地址：`yuyananuu@gmail.com`（或你在环境变量里设置的转发地址）。  
3. 添加自定义地址并路由到**当前图床 Worker**（同一部署了 `email()` 处理器的 Worker）：

| 地址 | 用途 |
| --- | --- |
| `vip@mini-tools.uk` | 长期存储 / VIP |
| `storage@mini-tools.uk` | 长期存储 / VIP（备用） |
| `api@mini-tools.uk` | API 申请 |

4. 重新部署包含本仓库 `worker-api/image-hosting-worker.js` 的 Worker。

## 可选环境变量

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `MEMBER_VIP_INBOX` | `vip@mini-tools.uk` | VIP 收件识别 |
| `MEMBER_STORAGE_INBOX` | `storage@mini-tools.uk` | VIP 收件识别 |
| `MEMBER_API_INBOX` | `api@mini-tools.uk` | API 收件识别 |
| `MEMBER_EMAIL_FORWARD_TO` | `yuyananuu@gmail.com` | 管理员抄送（需已验证） |
| `MEMBER_REPLY_FROM` | 收件地址 / `noreply@...` | Resend 发件人 |
| `RESEND_API_KEY` | 空 | Cloudflare 回信失败时的备选 |

## 回信模板

### 长期存储

```text
只要不上传关于黄色、带政治的图就可以。
上传时选择永久存储，VIP码填：{随机VIP码}
```

### API

```text
用户ID：{uuid}
API KEY: {mtu_live_...}
API文档：https://mini-tools.uk/image-api

普通用户api每日只能上传每天100张限时图片，可选限时1、7、30天
图片永久保存API另收费，手动目前永久不收费只能从网页上传
```

## 行为规则

- 同一邮箱、同一类型 **24 小时内**重复申请会限流，并提示勿重复提交。  
- 已有 VIP：复用原 VIP 码再回一次。  
- 已有 API：不重复下发 Key，提示联系管理员重置。  
- 新 API 默认套餐：`temporary_100`（100 张/天限时图），`complimentary`。  
- 主题含 `api` / `VIP` / `永久` / `长期` 等时，也可在非专用地址上辅助识别。

## 后台

打开 `image_admin.html` → **会员申请**：

- 查看申请日志、回信状态、错误信息  
- 一键复制模板或某次真实回信正文（自动回信失败时可人工粘贴发送）
