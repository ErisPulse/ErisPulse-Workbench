# 访问令牌与开放 API

访问令牌（PAT）用于 CLI、CI 与外部工具链等非浏览器场景。

## 生成令牌

「访问令牌」页 → 填写名称 →「生成令牌」。格式 `epat_` + 40 位十六进制，每人最多 10 个。

> 令牌仅生成时显示一次，关闭弹窗后无法再查看。

**免动态码令牌（CLI/CI 推荐）**：开启两步验证的账户可勾选「此令牌免动态码」。生成时需当场输入一次动态码；之后该令牌调用敏感接口（提交 / 管理 / 批量）不再要求 `totp_code`。令牌列表会带「免2FA」徽章。

## 调用约定

```http
Authorization: Bearer epat_…
Content-Type: application/json
```

令牌等同你的登录身份，权限与网页操作一致。

## 端点

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/api/modules` | GET | 模块索引（含归属与验证状态） |
| `/api/modules/submit` | POST | 提交模块 / 适配器 |
| `/api/modules/manage` | POST | 编辑 / 转正 / 删除（单条） |
| `/api/modules/batch` | POST | 批量转正 / 取消验证 / 删除 |
| `/api/me` | GET | 账户信息与身份绑定 |
| `/api/userinfo` | GET | 用户信息（含 `avatar_url`） |
| `/api/modules/ops` | GET | 操作状态：`?name=&type=` 查单模块最近操作（所有者/管理员），缺省返回自己的最近操作 |
| `GET /api/health` | — | 健康检查（公开） |
| `GET /api/meta` | — | API 自描述目录（公开） |
| `GET /api/modules/stats` | — | 生态统计（公开） |
| `GET /api/modules?q=关键词` | — | 模糊搜索（名称/包名/描述/标签） |

## 示例

```bash
curl -X POST https://workbench.erisdev.com/api/modules/submit   -H "Authorization: Bearer epat_…"   -H "Content-Type: application/json"   -d '{
    "name": "MyModule",
    "type": "module",
    "package": "ErisPulse-MyModule",
    "description": "模块描述，至少 10 字符",
    "author": "Your Name",
    "repository": "https://github.com/you/MyModule",
    "category": 1,
    "tags": ["工具"],
    "i18n": ["zh", "en"],
    "min_sdk_version": ">=2.7.0"
  }'
```

批量操作：

```json
{
  "action": "verify",
  "items": [{ "name": "MyModule", "type": "module" }],
  "totp_code": "123456"
}
```

账户开启两步验证时，提交与管理接口必须附 `totp_code`。

## 428 与宽限

当 2FA 需要但未提供/失效时返回 `428 TOTP_REQUIRED`；网页端会自动弹码，API 调用方应补 `totp_code` 重试。网页会话验证一次后 **10 分钟宽限**内免重复输码（PAT 不适用宽限，除非勾选免动态码）。
