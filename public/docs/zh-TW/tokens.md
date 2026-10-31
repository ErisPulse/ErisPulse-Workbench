# 存取權杖與開放 API

存取權杖（PAT）用於 CLI、CI 與外部工具鏈等非瀏覽器場域。

## 產生權杖

「存取權杖」頁 → 填寫名稱 →「生成權杖」。格式 `epat_` + 40 位十六進位，每人最多 10 個。

> 權杖僅產生時顯示一次，關閉彈窗後無法再查看。

**免動態碼權杖（CLI/CI 推薦）**：開啟兩步驗證的帳戶可勾選「此權杖免動態碼」。生成時需當場輸入一次動態碼；之後該權杖呼叫敏感介面（提交 / 管理 / 批次）不再要求 `totp_code`。權杖清單會帶「免2FA」徽章。

## 呼叫約定

```http
Authorization: Bearer epat_…
Content-Type: application/json
```

權杖等同你的登入身分，權限與網頁操作一致。

## 端點

| 端點 | 方法 | 說明 |
| --- | --- | --- |
| `/api/modules` | GET | 模組索引（含歸屬與驗證狀態） |
| `/api/modules/submit` | POST | 提交模組 / 介面卡 |
| `/api/modules/manage` | POST | 編輯 / 轉正 / 刪除（單筆） |
| `/api/modules/batch` | POST | 批次轉正 / 取消驗證 / 刪除 |
| `/api/me` | GET | 帳戶資訊與身分綁定 |
| `/api/userinfo` | GET | 使用者資訊（含 `avatar_url`） |
| `/api/modules/ops` | GET | 操作狀態：`?name=&type=` 查單模組最近操作（所有者/管理員），缺省返回自己的最近操作 |
| `GET /api/health` | — | 健康檢查（公開） |
| `GET /api/meta` | — | API 自描述目錄（公開） |
| `GET /api/modules/stats` | — | 生態統計（公開） |
| `GET /api/modules?q=關鍵詞` | — | 模糊搜尋（名稱/套件名/描述/標籤） |

## 範例

```bash
curl -X POST https://workbench.erisdev.com/api/modules/submit   -H "Authorization: Bearer epat_…"   -H "Content-Type: application/json"   -d '{
    "name": "MyModule",
    "type": "module",
    "package": "ErisPulse-MyModule",
    "description": "模組描述，至少 10 字元",
    "author": "Your Name",
    "repository": "https://github.com/you/MyModule",
    "category": 1,
    "tags": ["工具"],
    "i18n": ["zh", "en"],
    "min_sdk_version": ">=2.7.0"
  }'
```

批次操作：

```json
{
  "action": "verify",
  "items": [{ "name": "MyModule", "type": "module" }],
  "totp_code": "123456"
}
```

帳戶開啟兩步驗證時，提交與管理介面必須附 `totp_code`。

## 428 与宽限

當 2FA 需要但未提供/失效時返回 `428 TOTP_REQUIRED`；網頁端會自動彈碼，API 呼叫方應補 `totp_code` 重試。網頁會話驗證一次後 **10 分鐘寬限**內免重複輸碼（PAT 不適用寬限，除非勾選免動態碼）。
