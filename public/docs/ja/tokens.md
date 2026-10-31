# トークンとオープン API

アクセストークン（PAT）は CLI・CI・外部ツール向けです。

## 発行

「アクセストークン」→ 名前を入力 →「生成」。形式は `epat_` + 40 桁の 16 進、1 人最大 10 個。

> 発行時に 1 度だけ表示されます。

**2FA 不要トークン（CLI/CI 推奨）**：2FA 有効なアカウントは「このトークンは 2FA 不要」をチェックできます。作成時に一度だけコードが必要で、以後の重要操作（登録・管理・一括）は `totp_code` 不要です。一覧には「2FA不要」バッジが付きます。

## 呼び出し

```http
Authorization: Bearer epat_…
Content-Type: application/json
```

権限はログイン中のあなたと同一です。

## エンドポイント

| エンドポイント | メソッド | 用途 |
| --- | --- | --- |
| `/api/modules` | GET | モジュール一覧（所有権・認証状態） |
| `/api/modules/submit` | POST | モジュール / アダプタ登録 |
| `/api/modules/manage` | POST | 編集 / 承認 / 削除（単件） |
| `/api/modules/batch` | POST | 一括承認 / 解除 / 削除 |
| `/api/me` | GET | アカウント情報と連携 ID |
| `/api/userinfo` | GET | ユーザー情報（`avatar_url` 含む） |
| `/api/modules/ops` | GET | 操作状況：`?name=&type=` でモジュール単位の最近の操作（所有者/管理者）、省略時は自分の最近の操作 |
| `GET /api/health` | — | ヘルスチェック（公開） |
| `GET /api/meta` | — | API 自己記述ディレクトリ（公開） |
| `GET /api/modules/stats` | — | エコシステム統計（公開） |
| `GET /api/modules?q=キーワード` | — | あいまい検索（名前/パッケージ/説明/タグ） |

## 例

```bash
curl -X POST https://workbench.erisdev.com/api/modules/submit   -H "Authorization: Bearer epat_…"   -H "Content-Type: application/json"   -d '{
    "name": "MyModule",
    "type": "module",
    "package": "ErisPulse-MyModule",
    "description": "説明（10 文字以上）",
    "author": "Your Name",
    "repository": "https://github.com/you/MyModule",
    "category": 1,
    "tags": ["ツール"],
    "i18n": ["zh", "en"],
    "min_sdk_version": ">=2.7.0"
  }'
```

一括：

```json
{
  "action": "verify",
  "items": [{ "name": "MyModule", "type": "module" }],
  "totp_code": "123456"
}
```

2FA 有効時は `totp_code` が必須です。

## 428 と猶予期間

2FA が必要なのに `totp_code` がない/期限切れの場合は `428 TOTP_REQUIRED` を返します。Web は自動でダイアログを出し、API は `totp_code` を付けて再試行してください。Web セッションは検証後 **10 分間の猶予**で再入力不要です（PAT は対象外、免コード設定を除く）。
