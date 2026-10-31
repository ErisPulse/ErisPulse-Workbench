// ═══ i18n ═══
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ru'];
const LANG_NAMES = { 'zh-CN': '简体中文', 'zh-TW': '繁體中文', en: 'English', ja: '日本語', ru: 'Русский' };

function makeT() {
    const D = {
    'zh-CN': {
        tagline: 'ErisPulse 统一身份中心与创作者工作台',
        login: '登录', register: '注册', logout: '退出', email: '邮箱', username: '用户名', password: '密码', code: '验证码',
        tabCode: '验证码登录', tabPass: '密码登录', identifier: '用户名或邮箱',
        pwHintNew: '至少 8 位', sendCode: '发送验证码', registerLogin: '注册并登录',
        welcome: '欢迎', orEmail: '或使用邮箱', fillFirst: (f) => `请填写${f}`,
        codeSent: '验证码已发送', resend: (n) => `${n}s`,
        navGroupMain: '总览', navGroupApp: '应用管理', navGroupSys: '系统',
        nav: { dash: '数据总览', modules: '模块列表', submit: '提交新模块', users: '用户与角色', clients: '接入应用', audit: '操作日志', profile: '账号设置', activity: '生态动态', claims: '认领审核', tokens: '访问令牌', docs: '使用文档' },
        navGroupOpen: '开放接口',
        navTokens: '访问令牌', navActivity: '生态动态', navClaims: '认领审核',
        tkName: '令牌名称', tkSkip2fa: '此令牌免动态码（跳过 2FA）', tkSkip2faHint: '生成需当场验证一次动态码；之后 CLI/CI 调用敏感接口不再要求 totp_code', badgeNo2fa: '免2FA', tkCreate: '生成令牌', tkOnce: '令牌仅显示一次，请立即保存', tkNone: '还没有令牌', tkLast: '最后使用', tkCreated: '创建时间', tkRevoke: '撤销', tkRevokeOk: '已撤销', tkUsage: '开放 API / CLI（epsdk push）/ 外部工具链：请求头 Authorization: Bearer epat_… 即等同你的登录态', tkCopied: '已复制',
        tkModalTitle: '令牌已生成', tkWarn: '完整令牌仅此一次显示，请立即复制保存：',
        ecReleases: '最新发布', ecIssues: '近期 Issue', ecEmpty: '暂无数据',
        clClaim: '认领此模块', clReason: '申请理由（说明你是该模块的开发者）', clSubmit: '提交认领', clPending: '认领审核中', clSubmitted: '认领申请已提交，等待审核', clApprove: '通过', clReject: '驳回', clMy: '我的认领申请', clNone: '暂无申请',
        dashDesc: '模块生态的验证、角色与身份分发中心。',
        stat: { total: '生态模块', verified: '已验证', unverified: '待验证', users: '注册用户', release: '最新发布' },
        next: '接入指引', nextBody: '服务接入：在「接入应用」登记 client，用标准 OAuth 对接\n模块验证：待验证模块一键转正\nCLI（规划中）：epsdk build / epsdk push',
        loading: '加载中',
        search: '搜索模块 / 作者 / 包名…', filterAll: '全部', filterUnverified: '待验证', filterMine: '我的应用',
        newModule: '提交新模块', name: '模块', status: '状态', submitter: '提交者', official: '官方', mine: '我的',
        verified: '已验证', unverified: '待验证', verify: '转正', revoke: '撤销验证', del: '删除', edit: '编辑',
        noResults: '没有匹配的模块', emptyList: '还没有模块',
        selectMode: '选择', batchVerify: '批量转正', batchUnverify: '批量取消验证', batchDelete: '批量删除', selectAll: '全选',
        batchSelected: (n) => `已选 ${n} 项`, batchDone: (n) => `已提交 ${n} 项`, opPending: '处理中', opStale: '待确认', opLabel: { verify: '转正', unverify: '取消验证', delete: '删除', edit: '编辑', submit: '提交' },
        confirmDelete: '确认删除该模块？此操作不可撤销',
        back: '返回列表', basic: '基本信息', catTags: '分类与标签', logoSection: '图标', danger: '危险操作',
        fName: '模块名', fPackage: 'PyPI 包名', fType: '类型', fDesc: '描述（多语言用 | 分隔）', fAuthor: '作者',
        fRepo: '仓库地址', fCategory: '分类', fTags: '标签（逗号分隔）', fI18n: '界面语言', fMinSdk: '最低 SDK 版本',
        fLogo: 'Logo', fLogoHint: '粘贴 https URL，或选择本地图片（自动压缩 ≤100KB，上架脚本会进一步处理）',
        uploadLogo: '选择图片', logoPreview: '当前图标',
        submitModule: '提交模块', saveChanges: '保存修改', cancel: '取消',
        submitOk: '已提交，审核后上架', editOk: '修改已提交', dispatched: '已下发，稍后生效',
        cat: { 1: '工具', 2: '娱乐', 3: '管理', 4: '通知', 5: 'AI', 6: '平台对接', 7: '数据分析' },
        usersDesc: '角色由工作台统一分发：admin / mod / user，所有 OAuth 接入方看到一致的角色。',
        role: '角色', ban: '封禁', unban: '解封', banned: '已封禁', normal: '正常', roleUpdated: '角色已更新',
        clientsDesc: '登记 OAuth 接入方：生态服务用 client 凭证走标准 OAuth 流程接入统一登录。',
        newClient: '登记应用', appName: '应用名称', callback: '回调地址（每行一个 https://…）',
        generate: '生成凭证', registered: '已登记应用', noClients: '还没有接入应用',
        secretOnce: 'client_secret 仅显示一次，请立即保存', created: '已生成', clReset: '重置密钥', clResetConfirm: '重置后旧 client_secret 立即失效，确定？',
        auditDesc: '最近 100 条操作记录。', time: '时间', action: '操作', target: '对象', detail: '详情', noRecords: '暂无记录',
        profileDesc: '账号信息与登录方式。', myProfile: '资料', noEmail: '未绑定邮箱',
oauthNotConf: '该登录方式尚未配置，需管理员在 Worker 中设置对应 OAuth 应用密钥', sec2fa: '两步验证', sec2faHint: '请从认证器应用输入 6 位动态码', sec2faVerify: '验证', sec2faBack: '返回登录',
sec2faOn: '已开启', sec2faOff: '未开启', sec2faEnable: '开启两步验证', sec2faDisable: '关闭两步验证',
sec2faSetupHint: '用认证器应用（Google Authenticator / 1Password / Microsoft Authenticator 等）手动录入密钥，再输入一次动态码确认。密钥丢失将无法登录，请妥善保存。',
sec2faKey: '密钥', sec2faCode: '动态码', sec2faConfirm: '确认开启', copy: '复制', sec2faScan: '用认证器应用扫描二维码，或手动录入下方密钥', sec2faEnabled: '两步验证已开启', sec2faDisabled: '两步验证已关闭',
fTotpHint: '该账户已开启两步验证，操作时需输入认证器动态码',
        identities: '已绑定', noIdentity: '无 OAuth 绑定', displayName: '昵称',
        changePw: '修改密码（可选）', curPw: '当前密码', newPw: '新密码（至少 8 位）',
        save: '保存', saved: '已保存', avatarUpdated: '头像已更新', change: '更换',
        loginMethods: '登录方式', github: 'GitHub', codeberg: 'Codeberg', yunhu: '云湖', emailPw: '邮箱密码',
        submitDesc: '提交新模块 / 适配器到生态商店。', imgTooLarge: '图片压缩后仍超过 100KB，请换更小的图', imgReadFail: '图片读取失败，请重试',
        useOwnerLogo: (o) => `使用 @${o} 的头像作为 Logo`, logoPreviewEmpty: '未设置，将显示首字母方块', descCount: (n) => `${n} 字符（至少 10）`,
        errName: '仅字母 / 数字 / _ / -', errPackage: 'PyPI 包名仅限字母数字与 . _ -', errDesc: '描述至少 10 个字符', errRepo: '仓库需为 github.com 或 codeberg.org 地址',
        submitting: '提交中…', saving: '保存中…', unsaved: '有未提交的修改，离开将丢失。确定离开？', filled: '已自动填充', curLogo: '当前生效图标：',
        confirm: '确定', docsLoading: '加载文档…', docsMissing: '文档不存在', docsDesc: '按板块查阅：接入、令牌、模块、认领与常见问题。',
    },
    'zh-TW': {
        tagline: 'ErisPulse 統一身分中心與創作者工作台',
        login: '登入', register: '註冊', logout: '登出', email: '郵箱', username: '使用者名稱', password: '密碼', code: '驗證碼',
        tabCode: '驗證碼登入', tabPass: '密碼登入', identifier: '使用者名稱或信箱',
        pwHintNew: '至少 8 位', sendCode: '發送驗證碼', registerLogin: '註冊並登入',
        welcome: '歡迎', orEmail: '或使用郵箱', fillFirst: (f) => `請填寫${f}`,
        codeSent: '驗證碼已發送', resend: (n) => `${n}s`,
        navGroupMain: '總覽', navGroupApp: '應用管理', navGroupSys: '系統',
        nav: { dash: '數據總覽', modules: '模組列表', submit: '提交新模組', users: '使用者與角色', clients: '接入應用', audit: '操作日誌', profile: '帳號設定', activity: '生態動態', claims: '認領審核', tokens: '存取權杖', docs: '使用文件' },
        navGroupOpen: '開放接口',
        navTokens: '存取權杖', navActivity: '生態動態', navClaims: '認領審核',
        tkName: '權杖名稱', tkSkip2fa: '此權杖免動態碼（跳過 2FA）', tkSkip2faHint: '生成需當場驗證一次動態碼；之後 CLI/CI 呼叫敏感介面不再要求 totp_code', badgeNo2fa: '免2FA', tkCreate: '生成權杖', tkOnce: '權杖僅顯示一次，請立即保存', tkNone: '還沒有權杖', tkLast: '最後使用', tkCreated: '建立時間', tkRevoke: '撤銷', tkRevokeOk: '已撤銷', tkUsage: '開放 API / CLI（epsdk push）/ 外部工具鏈：請求頭 Authorization: Bearer epat_… 即等同你的登入態', tkCopied: '已複製',
        tkModalTitle: '權杖已生成', tkWarn: '完整權杖僅此一次顯示，請立即複製保存：',
        ecReleases: '最新發布', ecIssues: '近期 Issue', ecEmpty: '暫無資料',
        clClaim: '認領此模組', clReason: '申請理由（說明你是該模組的開發者）', clSubmit: '提交認領', clPending: '認領審核中', clApprove: '通過', clReject: '駁回', clMy: '我的認領申請', clNone: '暫無申請',
        dashDesc: '模組生態的驗證、角色與身分分發中心。',
        stat: { total: '生態模組', verified: '已驗證', unverified: '待驗證', users: '註冊使用者', release: '最新發布' },
        next: '接入指引', nextBody: '服務接入：在「接入應用」登記 client，用標準 OAuth 對接\n模組驗證：待驗證模組一鍵轉正\nCLI（規劃中）：epsdk build / epsdk push',
        loading: '載入中',
        search: '搜尋模組 / 作者 / 包名…', filterAll: '全部', filterUnverified: '待驗證', filterMine: '我的應用',
        newModule: '提交新模組', name: '模組', status: '狀態', submitter: '提交者', official: '官方', mine: '我的',
        verified: '已驗證', unverified: '待驗證', verify: '轉正', revoke: '撤銷驗證', del: '刪除', edit: '編輯',
        noResults: '沒有匹配的模組', emptyList: '還沒有模組',
        selectMode: '選取', batchVerify: '批次轉正', batchUnverify: '批次取消驗證', batchDelete: '批次刪除', selectAll: '全選',
        batchSelected: (n) => `已選 ${n} 項`, batchDone: (n) => `已提交 ${n} 項`, opPending: '處理中', opStale: '待確認', opLabel: { verify: '轉正', unverify: '取消驗證', delete: '刪除', edit: '編輯', submit: '提交' },
        confirmDelete: '確認刪除該模組？此操作不可撤銷',
        back: '返回列表', basic: '基本資訊', catTags: '分類與標籤', logoSection: '圖示', danger: '危險操作',
        fName: '模組名', fPackage: 'PyPI 包名', fType: '類型', fDesc: '描述（多語言用 | 分隔）', fAuthor: '作者',
        fRepo: '倉庫地址', fCategory: '分類', fTags: '標籤（逗號分隔）', fI18n: '界面語言', fMinSdk: '最低 SDK 版本',
        fLogo: 'Logo', fLogoHint: '貼上 https URL，或選擇本地圖片（自動壓縮 ≤100KB）',
        uploadLogo: '選擇圖片', logoPreview: '當前圖示',
        submitModule: '提交模組', saveChanges: '保存修改', cancel: '取消',
        submitOk: '已提交，審核後上架', editOk: '修改已提交', dispatched: '已下發，稍後生效',
        cat: { 1: '工具', 2: '娛樂', 3: '管理', 4: '通知', 5: 'AI', 6: '平台對接', 7: '數據分析' },
        usersDesc: '角色由工作台統一分發：admin / mod / user，所有 OAuth 接入方看到一致的角色。',
        role: '角色', ban: '封禁', unban: '解封', banned: '已封禁', normal: '正常', roleUpdated: '角色已更新',
        clientsDesc: '登記 OAuth 接入方：生態服務用 client 憑證走標準 OAuth 流程接入統一登入。',
        newClient: '登記應用', appName: '應用名稱', callback: '回呼地址（每行一個 https://…）',
        generate: '生成憑證', registered: '已登記應用', noClients: '還沒有接入應用',
        secretOnce: 'client_secret 僅顯示一次，請立即保存', created: '已生成', clReset: '重設密鑰', clResetConfirm: '重設後舊 client_secret 立即失效，確定？',
        auditDesc: '最近 100 條操作記錄。', time: '時間', action: '操作', target: '對象', detail: '詳情', noRecords: '暫無記錄',
        profileDesc: '帳號資訊與登入方式。', myProfile: '資料', noEmail: '未綁定郵箱',
oauthNotConf: '該登入方式尚未設定，需管理員在 Worker 中設定對應 OAuth 應用密鑰', sec2fa: '兩步驗證', sec2faHint: '請從認證器應用輸入 6 位動態碼', sec2faVerify: '驗證', sec2faBack: '返回登入',
sec2faOn: '已開啟', sec2faOff: '未開啟', sec2faEnable: '開啟兩步驗證', sec2faDisable: '關閉兩步驗證',
sec2faSetupHint: '用認證器應用（Google Authenticator / 1Password / Microsoft Authenticator 等）手動錄入密鑰，再輸入一次動態碼確認。密鑰遺失將無法登入，請妥善保存。',
sec2faKey: '密鑰', sec2faCode: '動態碼', sec2faConfirm: '確認開啟', copy: '複製', sec2faScan: '用認證器應用掃描二維碼，或手動錄入下方密鑰', sec2faEnabled: '兩步驗證已開啟', sec2faDisabled: '兩步驗證已關閉',
fTotpHint: '該帳戶已開啟兩步驗證，操作時需輸入認證器動態碼',
        identities: '已綁定', noIdentity: '無 OAuth 綁定', displayName: '暱稱',
        changePw: '修改密碼（可選）', curPw: '當前密碼', newPw: '新密碼（至少 8 位）',
        save: '保存', saved: '已保存', avatarUpdated: '頭像已更新', change: '更換',
        loginMethods: '登入方式', github: 'GitHub', codeberg: 'Codeberg', yunhu: '雲湖', emailPw: '郵箱密碼',
        submitDesc: '提交新模組 / 介面卡到生態商店。', imgTooLarge: '圖片壓縮後仍超過 100KB，請換更小的圖', imgReadFail: '圖片讀取失敗，請重試',
        useOwnerLogo: (o) => `使用 @${o} 的頭像作為 Logo`, logoPreviewEmpty: '未設定，將顯示首字母方塊', descCount: (n) => `${n} 字元（至少 10）`,
        errName: '僅字母 / 數字 / _ / -', errPackage: 'PyPI 套件名僅限字母數字與 . _ -', errDesc: '描述至少 10 個字元', errRepo: '倉庫需為 github.com 或 codeberg.org 地址',
        submitting: '提交中…', saving: '儲存中…', unsaved: '有未提交的修改，離開將遺失。確定離開？', filled: '已自動填充', curLogo: '目前生效圖示：',
        confirm: '確定', docsLoading: '載入文件…', docsMissing: '文件不存在', docsDesc: '依板塊查閱：接入、權杖、模組、認領與常見問題。',
    },
    en: {
        tagline: 'ErisPulse identity center & creator workbench',
        login: 'Log In', register: 'Sign Up', logout: 'Log Out', email: 'Email', username: 'Username', password: 'Password', code: 'Code',
        tabCode: 'Code', tabPass: 'Password', identifier: 'Username or email',
        pwHintNew: 'At least 8 chars', sendCode: 'Send Code', registerLogin: 'Sign Up & Log In',
        welcome: 'Welcome', orEmail: 'or use email', fillFirst: (f) => `Enter your ${f}`,
        codeSent: 'Code sent', resend: (n) => `${n}s`,
        navGroupMain: 'Overview', navGroupApp: 'Apps', navGroupSys: 'System',
        nav: { dash: 'Dashboard', modules: 'Module List', submit: 'Submit Module', users: 'Users & Roles', clients: 'OAuth Clients', audit: 'Audit Log', profile: 'Account', activity: 'Ecosystem', claims: 'Ownership Claims', tokens: 'Access Tokens', docs: 'Documentation' },
        navGroupOpen: 'Open API',
        navTokens: 'Access Tokens', navActivity: 'Ecosystem', navClaims: 'Ownership Claims',
        tkName: 'Token name', tkSkip2fa: 'Skip 2FA for this token', tkSkip2faHint: 'Creating it requires a live code once; afterwards CLI/CI calls to sensitive endpoints need no totp_code', badgeNo2fa: 'no-2FA', tkCreate: 'Generate Token', tkOnce: 'Shown only once — save it now', tkNone: 'No tokens yet', tkLast: 'Last used', tkCreated: 'Created', tkRevoke: 'Revoke', tkRevokeOk: 'Revoked', tkUsage: 'Open API / CLI (epsdk push) / external tools: header Authorization: Bearer epat_… acts as your session', tkCopied: 'Copied',
        tkModalTitle: 'Token created', tkWarn: 'The full token is shown only once — copy it now:',
        ecReleases: 'Releases', ecIssues: 'Recent Issues', ecEmpty: 'No data',
        clClaim: 'Claim this module', clReason: 'Reason (prove you develop this module)', clSubmit: 'Submit Claim', clPending: 'Pending review', clApprove: 'Approve', clReject: 'Reject', clMy: 'My Claims', clNone: 'No claims',
        dashDesc: 'Verification, roles and identity distribution for the module ecosystem.',
        stat: { total: 'Modules', verified: 'Verified', unverified: 'Unverified', users: 'Users', release: 'Latest Release' },
        next: 'Getting Started', nextBody: 'Connect services: register a client under "OAuth Clients"\nVerify modules in one click\nCLI (planned): epsdk build / epsdk push',
        loading: 'Loading',
        search: 'Search modules / authors / packages…', filterAll: 'All', filterUnverified: 'Unverified', filterMine: 'My Apps',
        newModule: 'Submit Module', name: 'Module', status: 'Status', submitter: 'Submitter', official: 'Official', mine: 'Mine',
        verified: 'Verified', unverified: 'Unverified', verify: 'Verify', revoke: 'Revoke', del: 'Delete', edit: 'Edit',
        noResults: 'No matching modules', emptyList: 'No modules yet',
        selectMode: 'Select', batchVerify: 'Verify selected', batchUnverify: 'Unverify selected', batchDelete: 'Delete selected', selectAll: 'Select all',
        batchSelected: (n) => `${n} selected`, batchDone: (n) => `${n} submitted`, opPending: 'processing', opStale: 'awaiting confirm', opLabel: { verify: 'Verify', unverify: 'Unverify', delete: 'Delete', edit: 'Edit', submit: 'Submit' },
        confirmDelete: 'Delete this module? This cannot be undone.',
        back: 'Back to list', basic: 'Basic Info', catTags: 'Category & Tags', logoSection: 'Icon', danger: 'Danger Zone',
        fName: 'Name', fPackage: 'PyPI package', fType: 'Type', fDesc: 'Description (languages split by |)', fAuthor: 'Author',
        fRepo: 'Repository URL', fCategory: 'Category', fTags: 'Tags (comma separated)', fI18n: 'UI languages', fMinSdk: 'Min SDK version',
        fLogo: 'Logo', fLogoHint: 'Paste an https URL or pick a local image (auto-compressed ≤100KB)',
        uploadLogo: 'Pick image', logoPreview: 'Current icon',
        submitModule: 'Submit', saveChanges: 'Save Changes', cancel: 'Cancel',
        submitOk: 'Submitted — listed after review', editOk: 'Changes submitted', dispatched: 'Dispatched — effective shortly',
        cat: { 1: 'Tools', 2: 'Fun', 3: 'Admin', 4: 'Notify', 5: 'AI', 6: 'Platform', 7: 'Analytics' },
        usersDesc: 'Roles (admin / mod / user) are distributed here; every OAuth client sees the same role.',
        role: 'Role', ban: 'Ban', unban: 'Unban', banned: 'Banned', normal: 'OK', roleUpdated: 'Role updated',
        clientsDesc: 'Register OAuth clients so ecosystem services log in via standard OAuth.',
        newClient: 'New Client', appName: 'Application name', callback: 'Redirect URIs (one https://… per line)',
        generate: 'Generate credentials', registered: 'Registered Clients', noClients: 'No clients yet',
        secretOnce: 'client_secret is shown only once — save it now', created: 'Created', clReset: 'Reset secret', clResetConfirm: 'The old client_secret stops working immediately. Continue?',
        auditDesc: 'Latest 100 actions.', time: 'Time', action: 'Action', target: 'Target', detail: 'Detail', noRecords: 'No records',
        profileDesc: 'Account info and sign-in methods.', myProfile: 'Profile', noEmail: 'No email',
        identities: 'Linked', noIdentity: 'No OAuth linked', displayName: 'Display name',
        changePw: 'Change password (optional)', curPw: 'Current password', newPw: 'New password (8+ chars)',
        save: 'Save', saved: 'Saved', avatarUpdated: 'Avatar updated', change: 'Change',
loginMethods: 'Sign-in methods', github: 'GitHub', codeberg: 'Codeberg', yunhu: 'Yunhu', emailPw: 'Email & password',
oauthNotConf: 'This sign-in method is not configured yet; an admin must set the OAuth app credentials on the Worker', sec2fa: '2FA', sec2faHint: 'Enter the 6-digit code from the authenticator app', sec2faVerify: 'Verify', sec2faBack: 'Back to login',
sec2faOn: 'Enabled', sec2faOff: 'Disabled', sec2faEnable: 'Enable 2FA', sec2faDisable: 'Disable 2FA',
sec2faSetupHint: 'Add the secret to your authenticator app (Google Authenticator / 1Password / Microsoft Authenticator), then enter a code to confirm. Losing the secret means losing access — store it safely.',
sec2faKey: 'Secret', sec2faCode: 'Code', sec2faConfirm: 'Confirm', copy: 'Copy', sec2faScan: 'Scan the QR code with your authenticator app, or enter the secret below', sec2faEnabled: '2FA enabled', sec2faDisabled: '2FA disabled',
fTotpHint: 'This account has 2FA enabled; actions require an authenticator code',
        submitDesc: 'Submit a new module / adapter to the store.', imgTooLarge: 'Image still exceeds 100KB after compression — try a smaller one', imgReadFail: 'Failed to read the image, please retry',
        useOwnerLogo: (o) => `Use @${o}'s avatar as logo`, logoPreviewEmpty: 'Not set — a first-letter tile will be shown', descCount: (n) => `${n} chars (min 10)`,
        errName: 'Letters / digits / _ / - only', errPackage: 'PyPI names allow letters, digits and . _ -', errDesc: 'Description needs at least 10 characters', errRepo: 'Repository must be on github.com or codeberg.org',
        submitting: 'Submitting…', saving: 'Saving…', unsaved: 'You have unsaved changes. Leave anyway?', filled: 'Auto-filled', curLogo: 'Current logo:',
confirm: 'OK', docsLoading: 'Loading docs…', docsMissing: 'Doc not found', docsDesc: 'Browse by topic: integration, tokens, modules, claims and FAQ.',
    },
    ja: {
        tagline: 'ErisPulse 統一 ID センター & クリエイターワークベンチ',
        login: 'ログイン', register: '登録', logout: 'ログアウト', email: 'メール', username: 'ユーザー名', password: 'パスワード', code: 'コード',
        tabCode: 'コード', tabPass: 'パスワード', identifier: 'ユーザー名またはメール',
        pwHintNew: '8 文字以上', sendCode: 'コード送信', registerLogin: '登録してログイン',
        welcome: 'ようこそ', orEmail: 'またはメール', fillFirst: (f) => `${f}を入力してください`,
        codeSent: 'コードを送信しました', resend: (n) => `${n}s`,
        navGroupMain: '概要', navGroupApp: 'アプリ管理', navGroupSys: 'システム',
        nav: { dash: 'ダッシュボード', modules: 'モジュール一覧', submit: '新規モジュール', users: 'ユーザーとロール', clients: '接続アプリ', audit: '操作ログ', profile: 'アカウント', activity: 'エコシステム', claims: '認定審査', tokens: 'アクセストークン', docs: 'ドキュメント' },
        navGroupOpen: 'オープン API',
        navTokens: 'アクセストークン', navActivity: 'エコシステム', navClaims: '認定審査',
        tkName: 'トークン名', tkSkip2fa: 'このトークンは 2FA 不要', tkSkip2faHint: '作成時に一度だけコードが必要。以後の CLI/CI からの重要操作は totp_code 不要', badgeNo2fa: '2FA不要', tkCreate: '生成', tkOnce: 'トークンは一度しか表示されません。今すぐ保存', tkNone: 'トークンはまだありません', tkLast: '最終使用', tkCreated: '作成日時', tkRevoke: '失効', tkRevokeOk: '失効しました', tkUsage: 'オープン API / CLI（epsdk push）/ 外部ツール：ヘッダー Authorization: Bearer epat_… でログイン状態と同等', tkCopied: 'コピーしました',
        tkModalTitle: 'トークンを生成しました', tkWarn: '完全なトークンは一度だけ表示されます。今すぐコピーしてください：',
        ecReleases: '最新リリース', ecIssues: '最近の Issue', ecEmpty: 'データなし',
        clClaim: 'このモジュールを認定', clReason: '申請理由（開発者であることを説明）', clSubmit: '申請', clPending: '審査中', clApprove: '承認', clReject: '却下', clMy: '自分の申請', clNone: '申請なし',
        dashDesc: 'モジュールエコシステムの検証・ロール・ID 配布センター。',
        stat: { total: 'モジュール', verified: '認証済み', unverified: '未認証', users: 'ユーザー', release: '最新リリース' },
        next: '始め方', nextBody: 'サービス接続：「接続アプリ」で client を登録\n未認証モジュールをワンクリック承認\nCLI（計画中）：epsdk build / epsdk push',
        loading: '読み込み中',
        search: 'モジュール / 作者 / パッケージ名を検索…', filterAll: 'すべて', filterUnverified: '未認証', filterMine: '自分のアプリ',
        newModule: '新規モジュール', name: 'モジュール', status: '状態', submitter: '投稿者', official: '公式', mine: '自分',
        verified: '認証済み', unverified: '未認証', verify: '承認', revoke: '承認取消', del: '削除', edit: '編集',
        noResults: '一致するモジュールなし', emptyList: 'モジュールはまだありません',
        selectMode: '選択', batchVerify: '一括承認', batchUnverify: '一括承認取消', batchDelete: '一括削除', selectAll: 'すべて選択',
        batchSelected: (n) => `${n} 件選択中`, batchDone: (n) => `${n} 件を送信しました`, opPending: '処理中', opStale: '確認待ち', opLabel: { verify: '承認', unverify: '承認取消', delete: '削除', edit: '編集', submit: '送信' },
        confirmDelete: 'このモジュールを削除しますか？取り消せません。',
        back: '一覧に戻る', basic: '基本情報', catTags: 'カテゴリとタグ', logoSection: 'アイコン', danger: '危険な操作',
        fName: 'モジュール名', fPackage: 'PyPI パッケージ名', fType: 'タイプ', fDesc: '説明（多言語は | で区切る）', fAuthor: '作者',
        fRepo: 'リポジトリ URL', fCategory: 'カテゴリ', fTags: 'タグ（カンマ区切り）', fI18n: 'UI 言語', fMinSdk: '最小 SDK バージョン',
        fLogo: 'Logo', fLogoHint: 'https URL を貼るかローカル画像を選択（≤100KB に自動圧縮）',
        uploadLogo: '画像を選択', logoPreview: '現在のアイコン',
        submitModule: '送信', saveChanges: '変更を保存', cancel: 'キャンセル',
        submitOk: '送信しました。審査後に掲載', editOk: '変更を送信しました', dispatched: '発行しました。まもなく反映',
        cat: { 1: 'ツール', 2: 'エンタメ', 3: '管理', 4: '通知', 5: 'AI', 6: 'プラットフォーム', 7: '分析' },
        usersDesc: 'ロール（admin / mod / user）はここで配布。すべての OAuth 接続先に同じロールが渡ります。',
        role: 'ロール', ban: 'BAN', unban: '解除', banned: 'BAN 済み', normal: '正常', roleUpdated: 'ロールを更新しました',
        clientsDesc: 'OAuth 接続アプリを登録すると、標準 OAuth でログインできます。',
        newClient: '新規アプリ', appName: 'アプリ名', callback: 'リダイレクト URI（1 行 1 件 https://…）',
        generate: '凭证生成', registered: '登録済みアプリ', noClients: '登録はまだありません',
        secretOnce: 'client_secret は一度しか表示されません。今すぐ保存してください', created: '生成しました', clReset: 'シークレット再発行', clResetConfirm: '再発行すると旧 client_secret は即時無効になります。続行しますか？',
        auditDesc: '直近 100 件の操作。', time: '時間', action: '操作', target: '対象', detail: '詳細', noRecords: '記録なし',
        profileDesc: 'アカウント情報とログイン方法。', myProfile: 'プロフィール', noEmail: 'メール未登録',
        identities: '連携済み', noIdentity: 'OAuth 未連携', displayName: '表示名',
        changePw: 'パスワード変更（任意）', curPw: '現在のパスワード', newPw: '新しいパスワード（8 文字以上）',
        save: '保存', saved: '保存しました', avatarUpdated: 'アイコンを更新しました', change: '変更',
        loginMethods: 'ログイン方法', github: 'GitHub', codeberg: 'Codeberg', yunhu: '雲湖', emailPw: 'メールとパスワード',
        oauthNotConf: 'このログイン方法は未設定です。管理者が Worker に OAuth アプリの認証情報を設定する必要があります', sec2fa: '2FA', sec2faHint: '認証アプリの 6 桁コードを入力してください', sec2faVerify: '確認', sec2faBack: 'ログインに戻る',
sec2faOn: '有効', sec2faOff: '無効', sec2faEnable: '2FA を有効化', sec2faDisable: '2FA を無効化',
sec2faSetupHint: '認証アプリ（Google Authenticator / 1Password / Microsoft Authenticator など）にシークレットを手動登録し、コードを入力して確定します。シークレットを失うとログインできません。',
sec2faKey: 'シークレット', sec2faCode: 'コード', sec2faConfirm: '確定', copy: 'コピー', sec2faScan: '認証アプリで QR コードをスキャンするか、下のシークレットを入力してください', sec2faEnabled: '2FA を有効にしました', sec2faDisabled: '2FA を無効にしました',
fTotpHint: 'このアカウントは 2FA が有効です。操作時に認証コードが必要です',
        submitDesc: '新しいモジュール / アダプタをストアへ提出します。', imgTooLarge: '圧縮後も 100KB を超えています。より小さい画像をお試しください', imgReadFail: '画像の読み込みに失敗しました。再試行してください',
        useOwnerLogo: (o) => `@${o} のアバターをロゴに使う`, logoPreviewEmpty: '未設定。先頭文字タイルが表示されます', descCount: (n) => `${n} 文字（最小 10）`,
        errName: '英数字と _ - のみ', errPackage: 'PyPI 名は英数字と . _ - のみ', errDesc: '説明は 10 文字以上', errRepo: 'リポジトリは github.com / codeberg.org のみ',
        submitting: '送信中…', saving: '保存中…', unsaved: '未送信の変更があります。破棄して移動しますか？', filled: '自動入力しました', curLogo: '現在のロゴ：',
        confirm: '確定', docsLoading: 'ドキュメントを読み込み中…', docsMissing: 'ドキュメントが見つかりません', docsDesc: 'トピック別：連携・トークン・モジュール・申請・FAQ。',
    },
    ru: {
        tagline: 'Центр идентификации и рабочая станция ErisPulse',
        login: 'Вход', register: 'Регистрация', logout: 'Выйти', email: 'Почта', username: 'Имя пользователя', password: 'Пароль', code: 'Код',
        tabCode: 'По коду', tabPass: 'По паролю', identifier: 'Имя или email',
        pwHintNew: 'Минимум 8 символов', sendCode: 'Отправить код', registerLogin: 'Зарегистрироваться и войти',
        welcome: 'Добро пожаловать', orEmail: 'или по почте', fillFirst: (f) => `Введите: ${f}`,
        codeSent: 'Код отправлен', resend: (n) => `${n}s`,
        navGroupMain: 'Обзор', navGroupApp: 'Приложения', navGroupSys: 'Система',
        nav: { dash: 'Обзор', modules: 'Список модулей', submit: 'Новый модуль', users: 'Пользователи', clients: 'OAuth-клиенты', audit: 'Журнал', profile: 'Аккаунт', activity: 'Экосистема', claims: 'Заявки на владение', tokens: 'Токены доступа', docs: 'Документация' },
        navGroupOpen: 'Открытый API',
        navTokens: 'Токены доступа', navActivity: 'Экосистема', navClaims: 'Заявки на владение',
        tkName: 'Название токена', tkSkip2fa: 'Токен без 2FA', tkSkip2faHint: 'При создании нужен один код; далее CLI/CI не требуют totp_code', badgeNo2fa: 'без 2FA', tkCreate: 'Создать токен', tkOnce: 'Показывается один раз — сохраните', tkNone: 'Токенов нет', tkLast: 'Последнее использование', tkCreated: 'Создан', tkRevoke: 'Отозвать', tkRevokeOk: 'Отозван', tkUsage: 'Открытый API / CLI (epsdk push) / внешние инструменты: заголовок Authorization: Bearer epat_… равен вашей сессии', tkCopied: 'Скопировано',
        tkModalTitle: 'Токен создан', tkWarn: 'Полный токен показывается один раз — скопируйте сейчас:',
        ecReleases: 'Релизы', ecIssues: 'Недавние issues', ecEmpty: 'Нет данных',
        clClaim: 'Заявить права', clReason: 'Причина (докажите, что вы автор)', clSubmit: 'Подать заявку', clPending: 'На проверке', clApprove: 'Одобрить', clReject: 'Отклонить', clMy: 'Мои заявки', clNone: 'Заявок нет',
        dashDesc: 'Центр верификации, ролей и идентификации экосистемы модулей.',
        stat: { total: 'Модулей', verified: 'Проверено', unverified: 'Не проверено', users: 'Пользователей', release: 'Релиз' },
        next: 'С чего начать', nextBody: 'Подключение сервисов: клиент в разделе «OAuth-клиенты»\nВерификация модулей в один клик\nCLI (в планах): epsdk build / epsdk push',
        loading: 'Загрузка',
        search: 'Поиск по модулям / авторам / пакетам…', filterAll: 'Все', filterUnverified: 'Не проверены', filterMine: 'Мои приложения',
        newModule: 'Новый модуль', name: 'Модуль', status: 'Статус', submitter: 'Автор', official: 'Официальный', mine: 'Мой',
        verified: 'Проверен', unverified: 'Не проверен', verify: 'Подтвердить', revoke: 'Отозвать', del: 'Удалить', edit: 'Изменить',
        noResults: 'Ничего не найдено', emptyList: 'Модулей пока нет',
        selectMode: 'Выбрать', batchVerify: 'Подтвердить выбранные', batchUnverify: 'Снять подтверждение', batchDelete: 'Удалить выбранные', selectAll: 'Выбрать все',
        batchSelected: (n) => `Выбрано: ${n}`, batchDone: (n) => `Отправлено: ${n}`, opPending: 'обработка', opStale: 'ожидает', opLabel: { verify: 'Подтверждение', unverify: 'Снятие', delete: 'Удаление', edit: 'Правка', submit: 'Отправка' },
        confirmDelete: 'Удалить модуль? Действие необратимо.',
        back: 'К списку', basic: 'Основное', catTags: 'Категория и теги', logoSection: 'Иконка', danger: 'Опасная зона',
        fName: 'Название', fPackage: 'Пакет PyPI', fType: 'Тип', fDesc: 'Описание (языки через |)', fAuthor: 'Автор',
        fRepo: 'URL репозитория', fCategory: 'Категория', fTags: 'Теги (через запятую)', fI18n: 'Языки интерфейса', fMinSdk: 'Мин. версия SDK',
        fLogo: 'Logo', fLogoHint: 'Вставьте https URL или выберите файл (автосжатие ≤100KB)',
        uploadLogo: 'Выбрать файл', logoPreview: 'Текущая иконка',
        submitModule: 'Отправить', saveChanges: 'Сохранить', cancel: 'Отмена',
        submitOk: 'Отправлено — появится после проверки', editOk: 'Правка отправлена', dispatched: 'Отправлено, скоро применится',
        cat: { 1: 'Инструменты', 2: 'Развлечения', 3: 'Управление', 4: 'Уведомления', 5: 'AI', 6: 'Платформы', 7: 'Аналитика' },
        usersDesc: 'Роли (admin / mod / user) раздаются здесь — все OAuth-клиенты видят одну и ту же роль.',
        role: 'Роль', ban: 'Бан', unban: 'Разбан', banned: 'Бан', normal: 'ОК', roleUpdated: 'Роль обновлена',
        clientsDesc: 'Регистрируйте OAuth-клиентов — сервисы входят через стандартный OAuth.',
        newClient: 'Новый клиент', appName: 'Название', callback: 'Redirect URI (по одному https://…)',
        generate: 'Создать', registered: 'Клиенты', noClients: 'Пока нет клиентов',
        secretOnce: 'client_secret показывается один раз — сохраните', created: 'Создано', clReset: 'Сменить секрет', clResetConfirm: 'Старый client_secret перестанет работать сразу. Продолжить?',
        auditDesc: 'Последние 100 действий.', time: 'Время', action: 'Действие', target: 'Объект', detail: 'Детали', noRecords: 'Нет записей',
        profileDesc: 'Информация об аккаунте и способы входа.', myProfile: 'Профиль', noEmail: 'Почта не указана',
        identities: 'Привязки', noIdentity: 'OAuth не привязан', displayName: 'Имя',
        changePw: 'Сменить пароль', curPw: 'Текущий пароль', newPw: 'Новый пароль (8+)',
        save: 'Сохранить', saved: 'Сохранено', avatarUpdated: 'Аватар обновлён', change: 'Сменить',
        loginMethods: 'Способы входа', github: 'GitHub', codeberg: 'Codeberg', yunhu: 'Yunhu', emailPw: 'Почта и пароль',
        oauthNotConf: 'Этот способ входа не настроен; администратор должен задать учётные данные OAuth-приложения в Worker', sec2fa: '2FA', sec2faHint: 'Введите 6-значный код из приложения-аутентификатора', sec2faVerify: 'Подтвердить', sec2faBack: 'Вернуться к входу',
sec2faOn: 'Включена', sec2faOff: 'Выключена', sec2faEnable: 'Включить 2FA', sec2faDisable: 'Отключить 2FA',
sec2faSetupHint: 'Добавьте секрет в приложение-аутентификатор (Google Authenticator / 1Password / Microsoft Authenticator) и введите код для подтверждения. Потеря секрета означает потерю доступа — сохраните его.',
sec2faKey: 'Секрет', sec2faCode: 'Код', sec2faConfirm: 'Подтвердить', copy: 'Копировать', sec2faScan: 'Отсканируйте QR-код в приложении-аутентификаторе или введите секрет ниже', sec2faEnabled: '2FA включена', sec2faDisabled: '2FA отключена',
fTotpHint: 'Для этого аккаунта включена 2FA; действия требуют код аутентификатора',
        submitDesc: 'Отправка нового модуля / адаптера в магазин.', imgTooLarge: 'После сжатия изображение всё ещё больше 100КБ — возьмите меньше', imgReadFail: 'Не удалось прочитать изображение, попробуйте снова',
        useOwnerLogo: (o) => `Использовать аватар @${o} как логотип`, logoPreviewEmpty: 'Не задан — будет показана плитка с первой буквой', descCount: (n) => `${n} симв. (мин. 10)`,
        errName: 'Только латиница, цифры, _ и -', errPackage: 'Имена PyPI: латиница, цифры, . _ -', errDesc: 'Описание — минимум 10 символов', errRepo: 'Репозиторий только на github.com / codeberg.org',
        submitting: 'Отправка…', saving: 'Сохранение…', unsaved: 'Есть несохранённые изменения. Уйти?', filled: 'Заполнено автоматически', curLogo: 'Текущий логотип:',
        confirm: 'ОК', docsLoading: 'Загрузка документации…', docsMissing: 'Документ не найден', docsDesc: 'По разделам: интеграция, токены, модули, заявки, вопросы.',
    },
    };
    return D;
}

const T = makeT();
const nav = () => navigator.language || '';
let LANG = localStorage.getItem('wb-lang');
if (!LOCALES.includes(LANG)) {
    const nl = nav().toLowerCase();
    LANG = nl.startsWith('zh') ? (nl.includes('tw') || nl.includes('hk') ? 'zh-TW' : 'zh-CN') : (LOCALES.includes(nav()) ? nav() : 'en');
}
const t = (key) => {
    const path = key.split('.');
    let v = T[LANG];
    for (const p of path) v = v && v[p];
    return typeof v === 'function' ? v : (v !== undefined ? v : key);
};

// ═══ 状态 ═══
const S = {
    token: localStorage.getItem('wb-token') || null,
    me: null,
    identities: [],
    config: { oauth: {}, smtp: false },
    view: 'dash',
    loginTab: 'login',
    loginMode: 'code',
    twofaChallenge: null,
    twofaSetup: null,
    modFilter: 'all',
    modSearch: '',
    modDetail: null,   // 当前打开的模块（详情视图）
};

const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ═══ SVG 图标 ═══
const SVG = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const I = {
    dash: SVG('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
    modules: SVG('<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>'),
    plus: SVG('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    users: SVG('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
    key: SVG('<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>'),
    audit: SVG('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
    profile: SVG('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    package: SVG('<path d="M16.5 9.4L7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
    check: SVG('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
    clock: SVG('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    sun: SVG('<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'),
    globe: SVG('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
    back: SVG('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'),
    search: SVG('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
    inbox: SVG('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>',
    codeberg: SVG('<path d="M12 1.8L2.2 20.4h19.6L12 1.8zm0 4.2l6.5 12.2H5.5L12 6z"/>'),
    trash: SVG('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    ext: SVG('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
};

const staff = () => S.me && (S.me.role === 'admin' || S.me.role === 'mod');
// 用户菜单点外部收起（一次性绑定，menu 存在才生效）
document.addEventListener('click', e => {
    const menu = document.getElementById('user-menu');
    const chip = document.getElementById('user-chip');
    if (menu && menu.classList.contains('open') && chip && !chip.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('open');
    }
});
const LOGO_IMG = (h) => `<img src="logo.png" alt="ErisPulse" style="height:${h}px;width:auto">`;

function toast(msg, err) {
    const el = document.createElement('div');
    el.className = 'toast' + (err ? ' err' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
}

// 2FA 动态码弹窗：账户未开启时直接放行（resolve null）；取消则 resolve false
function askTotp() {
    if (!S.me || !S.me.totp_enabled) return Promise.resolve(null);
    return new Promise(resolve => {
        const wrap = document.createElement('div');
        wrap.className = 'modal-backdrop';
        wrap.innerHTML = `<div class="modal-card">
            <h3>${esc(t('sec2fa'))}</h3>
            <p class="muted" style="font-size:12px;margin:0 0 12px">${esc(t('sec2faHint'))}</p>
            <input id="tp-code" maxlength="6" placeholder="123456" inputmode="numeric" style="text-align:center;letter-spacing:8px;font-size:20px;width:100%">
            <div style="display:flex;gap:8px;margin-top:14px">
                <button class="btn ghost" id="tp-cancel" style="flex:1">${esc(t('cancel'))}</button>
                <button class="btn" id="tp-ok" style="flex:1">${esc(t('sec2faVerify'))}</button>
            </div>
        </div>`;
        document.body.appendChild(wrap);
        const close = v => { wrap.remove(); resolve(v); };
        $('#tp-cancel').onclick = () => close(false);
        $('#tp-ok').onclick = () => {
            const code = $('#tp-code').value.trim();
            if (!/^\d{6}$/.test(code)) return toast(t('fillFirst')(t('code')), 1);
            close(code);
        };
        $('#tp-code').onkeydown = e => { if (e.key === 'Enter') $('#tp-ok').click(); };
        wrap.onkeydown = e => { if (e.key === 'Escape') close(false); };
        setTimeout(() => $('#tp-code').focus(), 50);
    });
}

/**
 * 敏感操作统一入口：先不带码调用（未开 2FA / 免码令牌 / 宽限期内直接通过），
 * 服务端返回 428 TOTP_REQUIRED 时弹码补一次。返回 {cancelled:true} 表示用户放弃。
 */
async function withTotp(call) {
    let data = await call(undefined);
    if (data && data.error === 'TOTP_REQUIRED') {
        const code = await askTotp();
        if (!code) return { cancelled: true };
        data = await call(code);
    }
    return data;
}

/**
 * 自建确认模态窗（替代原生 confirm，Promise<boolean>；Esc/点遮罩=取消，Enter=确认）
 */
function uiConfirm(message) {
    return new Promise(resolve => {
        const wrap = document.createElement('div');
        wrap.className = 'modal-backdrop';
        wrap.innerHTML = `<div class="modal-card ui-confirm">
            <p class="ui-confirm-msg">${esc(message)}</p>
            <div style="display:flex;gap:8px;margin-top:18px">
                <button class="btn ghost" data-a="cancel" style="flex:1">${esc(t('cancel'))}</button>
                <button class="btn danger" data-a="ok" style="flex:1">${esc(t('confirm'))}</button>
            </div>
        </div>`;
        document.body.appendChild(wrap);
        const done = v => { wrap.remove(); resolve(v); };
        wrap.querySelector('[data-a="ok"]').onclick = () => done(true);
        wrap.querySelector('[data-a="cancel"]').onclick = () => done(false);
        wrap.addEventListener('click', e => { if (e.target === wrap) done(false); });
        wrap.onkeydown = e => {
            if (e.key === 'Escape') done(false);
            if (e.key === 'Enter') done(true);
        };
        setTimeout(() => wrap.querySelector('[data-a="ok"]').focus(), 40);
    });
}

// ── 表单基建：按钮防重（disabled + 文案切换）──
async function busy(btn, fn) {
    if (!btn || btn.disabled) return;
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = (typeof t('submitting') === 'function') ? orig : (orig + '…');
    try { return await fn(); }
    finally { btn.disabled = false; btn.textContent = orig; }
}

// ── 表单基建：字段即时校验（.field.err 红边 + 红字提示）──
function setFieldErr(input, msg) {
    const field = input.closest('.field');
    if (!field) return;
    field.classList.toggle('err', !!msg);
    let em = field.querySelector('.err-msg');
    if (msg) {
        if (!em) { em = document.createElement('div'); em.className = 'err-msg'; field.appendChild(em); }
        em.textContent = msg;
    } else if (em) em.remove();
}

// ── 表单基建：dirty 守卫（离开页面前 confirm）──
let formDirty = false;
function markDirty() { formDirty = true; }
function clearDirty() { formDirty = false; }
// 离开确认：表单有未提交修改时拦截（取消返回 false，调用方放弃切换）
async function confirmLeave() {
    if (!formDirty) return true;
    if (!(await uiConfirm(t('unsaved')))) return false;
    clearDirty();
    return true;
}

async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (S.token) headers.Authorization = 'Bearer ' + S.token;
    const resp = await fetch(path, { ...opts, headers });
    const data = await resp.json().catch(() => ({}));
    if (resp.status === 401 && S.token) logout(true);
    return data;
}

function logout(silent) {
    if (!silent && S.token) api('/api/auth/logout', { method: 'POST' });
    S.token = null; S.me = null;
    localStorage.removeItem('wb-token');
    render();
    if (!silent) toast(t('logout'));
}

// 背景图：会话内固定随机
// 背景图懒加载：主界面先渲染，图片解码完成后再注入，不阻塞进入
function applyBackground() {
    let bg = +sessionStorage.getItem('wb-bg') || 0;
    if (!bg) { bg = 1 + Math.floor(Math.random() * 6); sessionStorage.setItem('wb-bg', bg); }
    const url = `bg/bg${bg}.webp`;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => document.body.style.setProperty('--bg-img', `url(${url})`);
    img.src = url;
}

// ── 上游 OAuth：authorize 端点与 scope（跳转时动态请求，OAuth App 无需预配置权限）──
const OAUTH_AUTHORIZE = {
    github: { url: 'https://github.com/login/oauth/authorize', scope: 'read:user user:email' },
    codeberg: { url: 'https://codeberg.org/login/oauth/authorize', scope: 'read:user read:email' },
    yunhu: { url: 'https://oauth2.jwzhd.com/oauth/authorize', scope: 'profile' },
};
const randomHex = (bytes) => [...crypto.getRandomValues(new Uint8Array(bytes))].map(b => b.toString(16).padStart(2, '0')).join('');

function oauthStart(provider) {
    const clientId = S.config.oauthClientIds && S.config.oauthClientIds[provider];
    if (!clientId) return toast(t('oauthNotConf'), 1);
    const auth = OAUTH_AUTHORIZE[provider];
    const u = new URL(auth.url);
    u.searchParams.set('client_id', clientId);
    u.searchParams.set('redirect_uri', location.origin + '/');
    if (auth.scope) u.searchParams.set('scope', auth.scope);
    u.searchParams.set('response_type', 'code');
    // state 同时用于 CSRF 校验与回跳：云湖要求 32-128 字符，统一取 32 位
    const state = randomHex(16);
    sessionStorage.setItem('wb-oauth-state', state);
    sessionStorage.setItem('wb-oauth-provider', provider);
    u.searchParams.set('state', state);
    location.href = u.toString();
}

async function handleOAuthCallback() {
    const u = new URL(location.href);
    const code = u.searchParams.get('code');
    const state = u.searchParams.get('state');
    const provider = sessionStorage.getItem('wb-oauth-provider');
    if (!code || !state || !provider) return false;
    const expected = sessionStorage.getItem('wb-oauth-state');
    sessionStorage.removeItem('wb-oauth-state');
    sessionStorage.removeItem('wb-oauth-provider');
    if (state !== expected) { toast('OAuth state mismatch', 1); return true; }
    try {
        const d = await api('/api/auth/oauth/' + provider + '/login', { method: 'POST', body: JSON.stringify({ code: code }) });
        if (d.error) return toast(d.message || d.error, 1);
        S.token = d.token;
        S.me = d.user;
        localStorage.setItem('wb-token', S.token);
        toast((t('welcome')) + '，' + (d.user.display_name || d.user.username));
        history.replaceState({}, '', location.origin + '/');
        render();
    } catch (e) {
        toast(String(e.message || e), 1);
    }
    return true;
}

// ═══ 渲染 ═══
function render() {
    const app = $('#app');
    S.me ? renderShell(app) : renderLogin(app);
}

function langRowHtml(cls) {
    return `<div class="${cls}">${LOCALES.map(l => `<button data-lang="${l}" class="${l === LANG ? 'active' : ''}">${l === 'zh-CN' ? '简' : l === 'zh-TW' ? '繁' : l === 'en' ? 'EN' : l === 'ja' ? '日' : 'Ру'}</button>`).join('')}</div>`;
}

function renderLogin(app) {
    const cfg = S.config;
    const icons = {
        github: I.github,
        codeberg: '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 512 512"><linearGradient id="cbgl" x1="42506.715" x2="42624.223" y1="7642.54" y2="7408.031" gradientTransform="matrix(1.4006 0 0 -1.4006 -59281.402 10836.918)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#fff;stop-opacity:0"/><stop offset=".495" style="stop-color:#71c2ff"/><stop offset="1" style="stop-color:#39aaff"/></linearGradient><path d="M260.8 129.9c-1.2 0-2.2.8-2.2 1.7v.3l98.6 369.7c47.7-20.5 88-55.1 115.6-99.1l-210-271.8c-.4-.5-1.2-.8-2-.8" style="opacity:.5;fill:url(#cbgl)"/><path d="M255 10.4C114 11 0 125.4 0 266.4c0 48.1 13.5 95.2 39.1 136l213.4-275.9c1.1-1.4 3.5-1.9 5.5-1.1.6.3 1.1.6 1.5 1.1l213.5 276c25.5-40.8 39.1-87.9 39.1-136 0-141.4-114.6-256-256-256-.4-.1-.7-.1-1.1-.1" style="fill:#2185d0"/></svg>',
        yunhu: '<img src="yunhu.png" alt="" style="width:20px;height:20px;border-radius:5px;object-fit:cover">',
    };
    const names = { github: t('github'), codeberg: t('codeberg'), yunhu: t('yunhu') };
    const oauthBtns = ['github', 'codeberg', 'yunhu'].map(p => `<button class="oauth-btn ${cfg.oauth[p] ? '' : 'unconf'}" data-oauth="${p}" title="${esc(names[p])}${cfg.oauth[p] ? '' : ' · ' + esc(t('oauthNotConf'))}">${icons[p]}</button>`).join('');
    const isRegister = S.loginTab === 'register';
    const isPass = S.loginMode === 'pass';

    // ── 2FA 挑战视图 ──
    if (S.twofaChallenge) {
        app.innerHTML = `
        <div class="login-wrap"><div class="login-panel">
            ${langRowHtml('login-lang')}
            <div class="login-logo">${LOGO_IMG(34)}</div>
            <div class="field"><label>${esc(t('sec2fa'))}</label>
                <input id="tf-code" maxlength="6" placeholder="123456" inputmode="numeric" autocomplete="one-time-code" style="text-align:center;letter-spacing:8px;font-size:20px">
            </div>
            <p class="login-hint">${esc(t('sec2faHint'))}</p>
            <button class="btn" id="tf-submit" style="width:100%;margin-top:4px">${esc(t('sec2faVerify'))}</button>
            <button class="btn ghost sm" id="tf-back" style="width:100%;margin-top:8px">${esc(t('sec2faBack'))}</button>
        </div></div>`;
        app.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { LANG = b.dataset.lang; localStorage.setItem('wb-lang', LANG); render(); });
        $('#tf-back').onclick = () => { S.twofaChallenge = null; render(); };
        const submit = async () => {
            const code = $('#tf-code').value.trim();
            if (!/^\d{6}$/.test(code)) return toast(t('fillFirst')(t('code')), 1);
            const data = await api('/api/auth/email/2fa', { method: 'POST', body: JSON.stringify({ challenge: S.twofaChallenge, code }) });
            if (data.error) return toast(data.message || data.error, 1);
            S.twofaChallenge = null;
            acceptSession(data);
        };
        $('#tf-submit').onclick = submit;
        $('#tf-code').onkeydown = e => { if (e.key === 'Enter') submit(); };
        setTimeout(() => $('#tf-code').focus(), 50);
        return;
    }

    app.innerHTML = `
    <div class="login-wrap"><div class="login-panel">
        ${langRowHtml('login-lang')}
        <div class="login-logo">${LOGO_IMG(34)}</div>
        <div class="login-tabs">
            <button class="login-tab ${!isRegister ? 'active' : ''}" data-tab="login">${esc(t('login'))}</button>
            <button class="login-tab ${isRegister ? 'active' : ''}" data-tab="register">${esc(t('register'))}</button>
        </div>
        ${isRegister ? `
        <div class="field"><label>${esc(t('username'))}</label><input id="li-username" placeholder="a-z 0-9 _ -"></div>
        <div class="field"><label>${esc(t('email'))}</label><input id="li-email" type="email" placeholder="you@example.com"></div>
        <div class="field"><label>${esc(t('password'))}</label><input id="li-password" type="password" placeholder="${esc(t('pwHintNew'))}"></div>
        <div class="field"><label>${esc(t('code'))}</label>
            <div style="display:flex;gap:8px"><input id="li-code" maxlength="6" placeholder="123456" style="flex:1">
            <button class="btn ghost sm" id="li-send">${esc(t('sendCode'))}</button></div>
        </div>
        ` : `
        <div class="mode-switch">
            <button class="mode-btn ${!isPass ? 'active' : ''}" data-mode="code">${esc(t('tabCode'))}</button>
            <button class="mode-btn ${isPass ? 'active' : ''}" data-mode="pass">${esc(t('tabPass'))}</button>
        </div>
        ${isPass
            ? `<div class="field"><label>${esc(t('identifier'))}</label><input id="li-ident" placeholder="${esc(t('identifier'))}"></div>
              <div class="field"><label>${esc(t('password'))}</label><input id="li-password" type="password"></div>`
            : `<div class="field"><label>${esc(t('identifier'))}</label><input id="li-ident" placeholder="${esc(t('identifier'))}"></div>
              ${cfg.smtp ? `<div class="field" id="li-code-area"><label>${esc(t('code'))}</label>
                <div style="display:flex;gap:8px"><input id="li-code" maxlength="6" placeholder="123456" style="flex:1">
                <button class="btn ghost sm" id="li-send">${esc(t('sendCode'))}</button></div>
              </div>` : ''}`}`}
        <button class="btn" id="li-submit" style="width:100%;margin-top:4px">${esc(isRegister ? t('registerLogin') : t('login'))}</button>
        ${oauthBtns ? `<div class="sep" style="margin:16px 0 10px">${esc(t('loginMethods'))}</div>
        <div class="oauth-row" style="justify-content:center">
            ${oauthBtns}
        </div>` : ''}
    </div></div>`;

    app.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { LANG = b.dataset.lang; localStorage.setItem('wb-lang', LANG); render(); });
    app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
        S.loginTab = b.dataset.tab === 'register' ? 'register' : 'login';
        render();
    });
    app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { S.loginMode = b.dataset.mode; render(); });
    app.querySelectorAll('[data-oauth]').forEach(b => b.onclick = () => {
        if (!S.config.oauth[b.dataset.oauth]) return toast(t('oauthNotConf'), 1);
        oauthStart(b.dataset.oauth);
    });
    // 登录/注册表单内回车直接提交
    app.querySelectorAll('#li-ident, #li-password, #li-username, #li-email, #li-code').forEach(el => {
        el.onkeydown = e => { if (e.key === 'Enter') $('#li-submit').click(); };
    });

    $('#li-submit').onclick = async () => {
        let data;
        if (isRegister) {
            const username = ($('#li-username') || {}).value || '';
            const email = $('#li-email').value.trim();
            const password = $('#li-password').value;
            const code = $('#li-code').value.trim();
            if (!username) return toast(t('fillFirst')(t('username')), 1);
            if (!email) return toast(t('fillFirst')(t('email')), 1);
            if (!password) return toast(t('fillFirst')(t('password')), 1);
            if (!code) return toast(t('fillFirst')(t('code')), 1);
            data = await api('/api/auth/email/register', { method: 'POST', body: JSON.stringify({ username, email, password, code }) });
        } else {
            const ident = $('#li-ident').value.trim();
            if (!ident) return toast(t('fillFirst')(t('identifier')), 1);
            if (isPass) {
                const password = $('#li-password').value;
                if (!password) return toast(t('fillFirst')(t('password')), 1);
                data = await api('/api/auth/email/login', { method: 'POST', body: JSON.stringify({ identifier: ident, password }) });
            } else {
                const code = $('#li-code') ? $('#li-code').value.trim() : '';
                if (code) {
                    data = await api('/api/auth/email/verify', { method: 'POST', body: JSON.stringify({ identifier: ident, code }) });
                } else if (S.config.smtp) {
                    data = await api('/api/auth/email/login', { method: 'POST', body: JSON.stringify({ identifier: ident }) });
                    if (!data.error) { toast(t('codeSent')); return; }
                } else return toast(t('fillFirst')(t('code')), 1);
            }
        }
        if (data.error) return toast(data.message || data.error, 1);
        if (data.twofa_required) { S.twofaChallenge = data.challenge; render(); return; }
        acceptSession(data);
    };
    const send = $('#li-send');
    if (send) send.onclick = async () => {
        let data;
        if (isRegister) {
            const email = $('#li-email').value.trim();
            if (!email) return toast(t('fillFirst')(t('email')), 1);
            data = await api('/api/auth/email/register/code', { method: 'POST', body: JSON.stringify({ email }) });
        } else {
            const ident = $('#li-ident').value.trim();
            if (!ident) return toast(t('fillFirst')(t('identifier')), 1);
            data = await api('/api/auth/email/login', { method: 'POST', body: JSON.stringify({ identifier: ident }) });
        }
        if (data.error) return toast(data.message || data.error, 1);
        toast(t('codeSent'));
        let left = 30; send.disabled = true;
        const orig = send.textContent;
        const timer = setInterval(() => { if (--left <= 0) { clearInterval(timer); send.disabled = false; send.textContent = orig; } else send.textContent = t('resend')(left); }, 1000);
    };
}

function acceptSession(data) {
    S.token = data.token;
    S.me = data.user;
    localStorage.setItem('wb-token', S.token);
    toast(t('welcome') + '，' + (data.user.display_name || data.user.username));
    boot();
}

function avatarHtml(u, size) {
    if (u && u.has_avatar_blob) return `<img src="/api/avatar/${esc(u.uid)}" style="width:${size}px;height:${size}px" alt="">`;
    const fbHtml = (disp) => `<span class="avatar-fallback" style="width:${size}px;height:${size}px;font-size:${Math.round(size / 2.6)}px;${disp}">${esc(((u && u.display_name) || '?').charAt(0).toUpperCase())}</span>`;
    if (u && u.avatar_url) return `<img src="${esc(u.avatar_url)}" style="width:${size}px;height:${size}px" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` + fbHtml('display:none');
    return fbHtml('');
}

function modLogoHtml(m, size) {
    if (m && m.logo) return `<img src="${esc(m.logo)}" style="width:${size}px;height:${size}px;border-radius:10px;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" alt=""><span class="mod-logo-fallback" style="display:none;width:${size}px;height:${size}px">${esc((m.name || '?').charAt(0))}</span>`;
    return `<span class="mod-logo-fallback" style="width:${size}px;height:${size}px">${esc(((m && m.name) || '?').charAt(0))}</span>`;
}

function renderShell(app) {
    // 开放平台导航：分组（总览 / 应用管理 / 系统）
    const groups = [
        ['navGroupMain', [
            ['dash', 'nav.dash', I.dash, true],
            ['activity', 'nav.activity', I.audit, true],
            ['docs', 'nav.docs', I.audit, true],
        ]],
        ['navGroupApp', [
            ['modules', 'nav.modules', I.modules, true],
            ['submit', 'nav.submit', I.plus, true],
            ['claims', 'nav.claims', I.check, () => staff()],
        ]],
        ['navGroupOpen', [
            ['clients', 'nav.clients', I.key, true],
            ['tokens', 'nav.tokens', I.key, true],
        ]],
        ['navGroupSys', [
            ['users', 'nav.users', I.users, () => staff()],
            ['audit', 'nav.audit', I.audit, () => staff()],
            ['profile', 'nav.profile', I.profile, true],
        ]],
    ].map(([g, items]) => [g, items.filter(v => typeof v[3] === 'function' ? v[3]() : v[3])]).filter(([, items]) => items.length);

    app.innerHTML = `
    <div class="shell">
        <div class="topbar">
            <div class="brand">${LOGO_IMG(24)}</div>
            <div class="sp"></div>
            <button class="theme-btn" id="theme-btn" title="Theme">${I.sun}</button>
            <div class="lang-wrap">
                <button class="lang-btn" id="lang-btn">${I.globe}</button>
                <div class="lang-menu" id="lang-menu">${LOCALES.map(l => `<button data-lang="${l}" class="${l === LANG ? 'active' : ''}">${LANG_NAMES[l]}</button>`).join('')}</div>
            </div>
            <div class="user-wrap">
                <div class="user-chip" id="user-chip">${avatarHtml(S.me, 30)}<span class="name">${esc(S.me.display_name || S.me.username)}</span><span class="role-chip">${S.me.role}</span></div>
                <div class="user-menu" id="user-menu">
                    <div class="um-head">
                        ${avatarHtml(S.me, 40)}
                        <div><b>${esc(S.me.display_name || S.me.username)}</b><br><span class="muted">@${esc(S.me.username)}</span></div>
                    </div>
                    <button data-um="profile">${I.profile} ${esc(t('nav.profile'))}</button>
                    <button data-um="logout" class="danger">${I.trash} ${esc(t('logout'))}</button>
                </div>
            </div>
        </div>
        <div class="main">
            <div class="sidebar">
                ${groups.map(([g, items]) => `
                    <div class="nav-group-title">${esc(t(g))}</div>
                    ${items.map(([id, label, icon]) => `<button class="nav-item ${S.view === id ? 'active' : ''}" data-view="${id}"><span class="nav-ico">${icon}</span><span class="lbl">${esc(t(label))}</span></button>`).join('')}`).join('')}
                <div class="foot">ErisPulse Workbench<br><a href="https://github.com/ErisPulse/ErisPulse-Workbench" target="_blank" rel="noopener">GitHub</a></div>
            </div>
            <div class="content" id="view"></div>
        </div>
    </div>`;

    // renderShell 末尾已调 loadView，这里不再重复调用（避免双重表格竞态）
    app.querySelectorAll('.nav-item').forEach(b => b.onclick = async () => { if (!(await confirmLeave())) return; S.view = b.dataset.view; S.modDetail = null; renderShell(app); });
    $('#user-chip').onclick = (e) => { e.stopPropagation(); $('#user-menu').classList.toggle('open'); };
    document.addEventListener('click', () => { const m = $('#user-menu'); if (m) m.classList.remove('open'); });
    $('#user-menu').querySelector('[data-um="profile"]').onclick = () => { S.view = 'profile'; renderShell(app); };
    $('#user-menu').querySelector('[data-um="logout"]').onclick = () => logout();
    $('#theme-btn').onclick = () => {
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
        localStorage.setItem('wb-theme', dark ? 'light' : 'dark');
    };
    const langBtn = $('#lang-btn'), langMenu = $('#lang-menu');
    langBtn.onclick = (e) => { e.stopPropagation(); langMenu.classList.toggle('open'); };
    document.addEventListener('click', () => langMenu.classList.remove('open'), { once: true });
    langMenu.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { LANG = b.dataset.lang; localStorage.setItem('wb-lang', LANG); render(); });
    loadView();
}

function loadView() {
    const v = $('#view');
    ({ dash: viewDash, modules: viewModules, submit: viewSubmit, users: viewUsers, clients: viewClients, audit: viewAudit, profile: viewProfile, tokens: viewTokens, activity: viewActivity, claims: viewClaims, docs: viewDocs }[S.view] || viewDash)(v);
}

// ═══ 总览 ═══
async function viewDash(v) {
    v.innerHTML = `
        <div class="dash-hero">
            <div class="dash-hero-text">
                <h2>${esc(t('welcome'))}, ${esc(S.me.display_name || S.me.username)}</h2>
            </div>
        </div>
        <div class="entry-grid" id="dash-entries"></div>`;

    const [mods] = await Promise.all([api('/api/modules').catch(() => ({}))]);
    const ms = mods.modules || [];
    const entries = [
        ['modules', 'nav.modules', I.modules, `${ms.length} ${esc(t('stat.total'))}`],
        ['submit', 'nav.submit', I.plus, ''],
        ['activity', 'nav.activity', I.audit, ''],
        ['tokens', 'nav.tokens', I.key, ''],
        ...staff() ? [
            ['claims', 'nav.claims', I.check, ''],
            ['users', 'nav.users', I.users, ''],
            ['clients', 'nav.clients', I.key, ''],
            ['audit', 'nav.audit', I.audit, ''],
        ] : [],
    ];
    v.querySelector('#dash-entries').innerHTML = entries.map(([view, label, icon, badge]) => `
        <button class="entry-card" data-entry="${view}">
            <span class="entry-ico">${icon}</span>
            <span class="entry-title">${esc(t(label))}${badge ? ` <em>${badge}</em>` : ''}</span>
            <span class="entry-arrow">${I.ext}</span>
        </button>`).join('');
    v.querySelectorAll('[data-entry]').forEach(b => b.onclick = () => { S.view = b.dataset.entry; S.modDetail = null; render(); });
}

// ═══ 模块列表（开放平台应用列表形态：搜索 + 筛选 + logo + 行操作）═══
async function viewModules(v) {
    const filter = S.modFilter;
    S.modSel = new Set();
    S.modSelectMode = false;
    v.innerHTML = `<div class="page-title">${esc(t('nav.modules'))}</div><div class="page-desc">${esc(t('dashDesc'))}</div>
        <div class="list-toolbar">
            <div class="search-box">${I.search}<input id="mod-q" value="${esc(S.modSearch || '')}" placeholder="${esc(t('search'))}"></div>
            <div class="filter-pills">
                ${['all', 'unverified', 'mine'].map(f => `<button class="pill ${filter === f ? 'active' : ''}" data-filter="${f}">${esc(t('filter' + f.charAt(0).toUpperCase() + f.slice(1)))}</button>`).join('')}
            </div>
            <span style="flex:1"></span>
            <span class="toolbar-actions">
                <button class="btn sm ghost" id="sel-mode">${I.check.replace('<svg', '<svg style="width:13px;height:13px"')} ${esc(t('selectMode'))}</button>
                <button class="btn sm" id="go-submit">${I.plus.replace('<svg', '<svg style="width:13px;height:13px"')} ${esc(t('newModule'))}</button>
            </span>
        </div>
        <div class="batch-bar" id="batch-bar" hidden>
            <span class="batch-count" id="batch-count"></span>
            <button class="btn sm ok" id="batch-verify">${esc(t('batchVerify'))}</button>
            <button class="btn sm ghost" id="batch-unverify">${esc(t('batchUnverify'))}</button>
            <button class="btn sm danger" id="batch-del">${esc(t('batchDelete'))}</button>
            <button class="btn sm ghost" id="batch-clear">${esc(t('cancel'))}</button>
        </div>
        <div class="card" style="padding:0;overflow:hidden"><table id="mod-table"></table></div>`;

    v.querySelector('#go-submit').onclick = () => { S.view = 'submit'; renderShell(v.closest('#app') ? $('#app') : v); render(); };
    v.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { S.modFilter = b.dataset.filter; loadView(); });
    const qInput = v.querySelector('#mod-q');
    qInput.oninput = () => { S.modSearch = qInput.value; renderModRows(v); };
    qInput.onkeydown = (e) => { if (e.key === 'Enter') renderModRows(v); };
    $('#sel-mode').onclick = () => { S.modSelectMode = !S.modSelectMode; S.modSel.clear(); renderModRows(v); };

    $('#batch-verify').onclick = () => runBatch('verify');
    $('#batch-unverify').onclick = () => runBatch('unverify');
    $('#batch-del').onclick = () => runBatch('delete');
    $('#batch-clear').onclick = () => { S.modSel.clear(); S.modSelectMode = false; renderModRows(v); };

    const data = await api('/api/modules');
    if (data.error) { v.querySelector('#mod-table').innerHTML = `<tbody><tr><td colspan="4"><div class="empty">${esc(data.message || data.error)}</div></td></tr></tbody>`; return; }
    S.modules = data.modules || [];
    renderModRows(v);
}

// 批量操作：一次 2FA + 一次 dispatch；完成后重新拉取（服务端按 pending 投影目标状态）
async function runBatch(action) {
    const items = [...(S.modSel || [])].map(k => {
        const i = k.indexOf('|');
        return { name: k.slice(0, i), type: k.slice(i + 1) };
    });
    if (!items.length) return;
    if (action === 'delete' && !(await uiConfirm(t('confirmDelete')))) return;
    const d = await withTotp(code => api('/api/modules/batch', { method: 'POST', body: JSON.stringify({ action, items, totp_code: code || undefined }) }));
    if (d.cancelled) return;
    if (d.error) return toast(d.message || d.error, 1);
    toast(t('batchDone')(d.count));
    S.modSel.clear();
    loadView();
}

function renderModRows(v) {
    const q = (S.modSearch || '').toLowerCase();
    let ms = S.modules;
    if (S.modFilter === 'unverified') ms = ms.filter(m => !m.verified);
    if (S.modFilter === 'mine') ms = ms.filter(m => m.mine);
    if (q) ms = ms.filter(m => (m.name + ' ' + m.submitted_by + ' ' + m.package).toLowerCase().includes(q));
    if (!S.modSel) S.modSel = new Set();
    const selMode = !!S.modSelectMode;
    const cols = selMode ? 5 : 4;

    v.querySelector('#mod-table').innerHTML = `<thead><tr>
        ${selMode ? `<th style="width:34px;padding-left:14px"><input type="checkbox" id="mod-all" title="${esc(t('selectAll'))}"></th>` : ''}
        <th ${selMode ? '' : 'style="padding-left:20px"'}>${esc(t('name'))}</th><th>${esc(t('status'))}</th><th>${esc(t('submitter'))}</th><th style="padding-right:20px"></th>
    </tr></thead><tbody>${(ms.length ? ms.map(m => {
        const key = m.name + '|' + m.type;
        const sel = S.modSel.has(key), busy = !!m.pending;
        return `<tr class="mod-row ${sel ? 'selected' : ''} ${selMode ? 'with-sel' : ''}" data-open="${esc(m.name)}">
        ${selMode ? `<td class="c-sel"><input type="checkbox" class="mod-sel" data-key="${esc(key)}" ${sel ? 'checked' : ''}></td>` : ''}
        <td class="c-name" ${selMode ? '' : 'style="padding-left:20px"'}><div style="display:flex;align-items:center;gap:12px">
            ${modLogoHtml(m, 38)}
            <div><b>${esc(m.name)}</b> <span class="muted" style="font-size:11px">${m.type === 'adapter' ? 'adapter' : ''}${m.official ? ' · ' + esc(t('official')) : ''}</span>
            <br><span class="muted" style="font-size:11px">${esc((m.description || '').split('|')[0].trim().slice(0, 46))}</span></div>
        </div></td>
        <td class="c-status">${m.verified ? `<span class="badge verified">${esc(t('verified'))}</span>` : `<span class="badge unverified">${esc(t('unverified'))}</span>`}${m.mine ? ` <span class="badge role">${esc(t('mine'))}</span>` : ''}${busy ? ` <span class="badge ${m.pending.status === 'stale' ? 'unverified' : 'role'}">${esc(((t('opLabel') || {})[m.pending.action] || m.pending.action) + ' ' + (m.pending.status === 'stale' ? t('opStale') : t('opPending')))}</span>` : ''}</td>
        <td class="c-sub muted">${esc(m.submitted_by || '—')}</td>
        <td class="c-act" style="padding-right:20px;text-align:right;white-space:nowrap">
            ${staff() && !m.verified && !busy ? `<button class="btn sm ok" data-verify="${esc(m.name)}">${esc(t('verify'))}</button>` : ''}
            ${I.ext.replace('<svg', '<svg style="width:14px;height:14px;opacity:.5;vertical-align:middle"')}
        </td>
    </tr>`;
    }).join('') : `<tr><td colspan="${cols}"><div class="empty">${I.inbox}<span>${esc(q || S.modFilter !== 'all' ? t('noResults') : t('emptyList'))}</span></div></td></tr>`)}</tbody>`;

    const all = v.querySelector('#mod-all');
    const visibleKeys = ms.map(m => m.name + '|' + m.type);
    if (all) {
        all.checked = visibleKeys.length > 0 && visibleKeys.every(k => S.modSel.has(k));
        all.onchange = () => {
            if (all.checked) visibleKeys.forEach(k => S.modSel.add(k));
            else S.modSel.clear();
            renderModRows(v);
        };
    }
    const bar = v.querySelector('#batch-bar');
    if (bar) {
        bar.hidden = !selMode;
        if (selMode) {
            v.querySelector('#batch-count').textContent = t('batchSelected')(S.modSel.size);
            v.querySelector('#batch-verify').hidden = !staff();
            v.querySelector('#batch-unverify').hidden = !staff();
        }
    }

    const find = n => S.modules.find(m => m.name === n);
    v.querySelectorAll('.mod-row').forEach(r => r.onclick = (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        S.modDetail = find(r.dataset.open);
        S.view = 'modules';
        viewModuleDetail($('#view'));
    });
    v.querySelectorAll('.mod-sel').forEach(cb => cb.onclick = (e) => {
        e.stopPropagation();
        if (cb.checked) S.modSel.add(cb.dataset.key); else S.modSel.delete(cb.dataset.key);
        renderModRows(v);
    });
    v.querySelectorAll('[data-verify]').forEach(b => b.onclick = async (e) => {
        e.stopPropagation();
        const m = find(b.dataset.verify);
        const d = await withTotp(code => api('/api/modules/manage', { method: 'POST', body: JSON.stringify({ action: 'verify', name: m.name, type: m.type, verified: true, totp_code: code || undefined }) }));
        if (d.cancelled) return;
        if (d.error) return toast(d.message || d.error, 1);
        toast(t('dispatched'));
        loadView();   // 重新拉取：pending 投影让目标状态在刷新后依然可见
    });
}

// ═══ 模块详情（应用详情形态：头部 + 分区表单，所有者可改全部字段）═══
function viewModuleDetail(v) {
    const m = S.modDetail;
    if (!m) return viewModules(v);
    const cats = t('cat');
    const LANGS8 = ['zh', 'zh-TW', 'en', 'ja', 'ru', 'ko', 'ms', 'pt-br'];
    const canManage = m.mine || staff();
    v.innerHTML = `
        <button class="btn ghost sm" id="mod-back" style="margin-bottom:14px">${I.back.replace('<svg', '<svg style="width:13px;height:13px"')} ${esc(t('back'))}</button>
        <div class="mod-head">
            ${modLogoHtml(m, 64)}
            <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                    <span style="font-size:22px;font-weight:700;letter-spacing:-.02em">${esc(m.name)}</span>
                    <span class="badge ${m.verified ? 'verified' : 'unverified'}">${m.verified ? esc(t('verified')) : esc(t('unverified'))}</span>
                    ${m.official ? `<span class="badge role">${esc(t('official'))}</span>` : ''}
                    ${m.mine ? `<span class="badge role">${esc(t('mine'))}</span>` : ''}
                </div>
                <div class="muted" style="font-size:12px;margin-top:4px">${esc(m.package || '')} · ${m.type} · ${esc(m.submitted_by || '')}</div>
            </div>
            <div style="display:flex;gap:8px">
                ${m.repository ? `<a class="btn ghost sm" href="${esc(m.repository)}" target="_blank" rel="noopener">${I.ext.replace('<svg', '<svg style="width:13px;height:13px"')} GitHub</a>` : ''}
                ${staff() ? `<button class="btn sm ${m.verified ? 'ghost' : 'ok'}" id="md-verify">${m.verified ? esc(t('revoke')) : esc(t('verify'))}</button>` : ''}
                ${canManage ? `<button class="btn sm danger" id="md-del">${I.trash.replace('<svg', '<svg style="width:13px;height:13px"')} ${esc(t('del'))}</button>` : ''}
                ${!canManage ? `<button class="btn sm ghost" id="md-claim">${esc(t('clClaim'))}</button>` : ''}
            </div>
        ${!canManage ? `<div class="card" id="md-claim-box" hidden><h3>${esc(t('clClaim'))}</h3>
            <div class="field"><label>${esc(t('clReason'))}</label><textarea id="md-claim-reason" rows="2"></textarea></div>
            <button class="btn" id="md-claim-submit">${esc(t('clSubmit'))}</button>
        </div>` : ''}
        </div>
        ${canManage ? `
        <div class="card"><h3>${esc(t('basic'))}</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                <div class="field"><label>${esc(t('fPackage'))}</label><input id="md-package" value="${esc(m.package || '')}"></div>
                <div class="field"><label>${esc(t('fAuthor'))}</label><input id="md-author" value="${esc(m.author || '')}"></div>
            </div>
            <div class="field"><label>${esc(t('fDesc'))}</label><textarea id="md-desc" rows="3">${esc(m.description || '')}</textarea></div>
            <div class="field"><label>${esc(t('fRepo'))}</label><input id="md-repo" value="${esc(m.repository || '')}"></div>
        </div>
        <div class="card"><h3>${esc(t('catTags'))}</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                <div class="field"><label>${esc(t('fCategory'))}</label><select id="md-cat">${Object.entries(cats).map(([id, name]) => `<option value="${id}" ${+m.category === +id ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></div>
                <div class="field"><label>${esc(t('fMinSdk'))}</label><input id="md-minsdk" value="${esc(m.min_sdk_version || '')}" placeholder=">=2.7.0"></div>
            </div>
            <div class="field"><label>${esc(t('fTags'))}</label><input id="md-tags" value="${esc((m.tags || []).join(', '))}"></div>
            <div class="field"><label>${esc(t('fI18n'))}</label>
                <div style="display:flex;gap:6px;flex-wrap:wrap">${LANGS8.map(lg => `<button type="button" data-lg="${lg}" class="pill ${(m.i18n || []).includes(lg) ? 'active' : ''}">${lg}</button>`).join('')}</div>
            </div>
        </div>
        <div class="card"><h3>${esc(t('logoSection'))}</h3>
            <div style="display:flex;gap:16px;align-items:flex-start">
                <div style="text-align:center">
                    <div id="md-logo-live">${modLogoHtml(m, 72)}</div>
                    <div class="muted" style="font-size:10px;margin-top:6px">${esc(t('logoPreview'))}</div>
                </div>
                <div style="flex:1">
                    <div class="field"><label>${esc(t('fLogo'))}</label><input id="md-logo" value="${esc((m.logo || '').startsWith('data:') ? '' : m.logo || '')}" placeholder="https://…"></div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <label class="btn ghost sm" style="cursor:pointer">${esc(t('uploadLogo'))}<input type="file" id="md-logo-file" accept="image/*" hidden></label>
                        <input type="hidden" id="md-logo-data" value="${esc((m.logo || '').startsWith('data:') ? m.logo : '')}">
                        <span class="muted" style="font-size:11px">${esc(t('fLogoHint'))}</span>
                    </div>
                    <label class="logo-owner-row" id="md-logo-owner" hidden><input type="checkbox" id="md-logo-gh"><img id="md-logo-gh-img" alt=""><span id="md-logo-gh-text"></span></label>
                </div>
            </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
            <button class="btn" id="md-save" style="min-width:140px">${esc(t('saveChanges'))}</button>
        </div>` : `<div class="card"><div class="empty" style="padding:20px">${esc((m.description || '').split('|')[0])}</div></div>`}`;

    $('#mod-back').onclick = async () => { if (!(await confirmLeave())) return; S.modDetail = null; loadView(); };
    const verifyBtn = $('#md-verify');
    if (verifyBtn) verifyBtn.onclick = async () => {
        const d = await withTotp(code => api('/api/modules/manage', { method: 'POST', body: JSON.stringify({ action: 'verify', name: m.name, type: m.type, verified: !m.verified, totp_code: code || undefined }) }));
        if (d.cancelled) return;
        d.error ? toast(d.message || d.error, 1) : (toast(t('dispatched')), S.modDetail = null, loadView());
    };
    const delBtn = $('#md-del');
    if (delBtn) delBtn.onclick = async () => {
        if (!(await uiConfirm(t('confirmDelete')))) return;
        const d = await withTotp(code => api('/api/modules/manage', { method: 'POST', body: JSON.stringify({ action: 'delete', name: m.name, type: m.type, totp_code: code || undefined }) }));
        if (d.cancelled) return;
        d.error ? toast(d.message || d.error, 1) : (toast(t('dispatched')), S.modDetail = null, loadView());
    };
    const claimBtn = $('#md-claim');
    if (claimBtn) {
        claimBtn.onclick = () => { const box = $('#md-claim-box'); box.hidden = !box.hidden; };
        $('#md-claim-submit').onclick = async () => {
            const d = await api('/api/modules/claim', { method: 'POST', body: JSON.stringify({ name: m.name, type: m.type, reason: $('#md-claim-reason').value }) });
            if (d.error) return toast(d.message || d.error, 1);
            toast(t('clSubmitted'));
            $('#md-claim-box').hidden = true;
        };
    }
    if (!canManage) return;
    v.querySelectorAll('[data-lg]').forEach(b => b.onclick = () => { b.classList.toggle('active'); markDirty(); });

    // logo：URL / 上传 / 作者头像 三选一，预览即时刷新
    let mdOwner = parseRepo(m.repository);
    const mdLogoValue = () => $('#md-logo-gh').checked && mdOwner ? mdOwner.avatar
        : ($('#md-logo-data').value || $('#md-logo').value.trim() || '');
    const mdRefresh = () => {
        $('#md-logo-live').innerHTML = modLogoHtml({ name: m.name, logo: mdLogoValue() }, 72);
        const box = $('#md-logo-owner');
        if (mdOwner) {
            box.hidden = false;
            $('#md-logo-gh-img').src = mdOwner.avatar;
            $('#md-logo-gh-text').textContent = t('useOwnerLogo')(mdOwner.owner);
        } else box.hidden = true;
    };
    // 已有 logo 就是该作者头像时默认勾选
    if (mdOwner && m.logo === mdOwner.avatar) $('#md-logo-gh').checked = true;
    $('#md-logo').addEventListener('input', () => { $('#md-logo-gh').checked = false; mdRefresh(); markDirty(); });
    $('#md-logo-gh').addEventListener('change', () => {
        if ($('#md-logo-gh').checked) { $('#md-logo').value = ''; $('#md-logo-data').value = ''; }
        mdRefresh(); markDirty();
    });
    const fileInput = $('#md-logo-file');
    fileInput.onchange = async () => {
        const f = fileInput.files[0];
        if (!f) return;
        try {
            const dataUrl = await compressImage(f, 100 * 1024);
            $('#md-logo-data').value = dataUrl;
            $('#md-logo').value = '';
            $('#md-logo-gh').checked = false;
            mdRefresh();
        } catch (e) { toast(e.message === 'size' ? t('imgTooLarge') : e.message === 'read' ? t('imgReadFail') : e.message, 1); }
    };
    // 其余字段变更即标记 dirty
    ['md-package', 'md-author', 'md-desc', 'md-repo', 'md-minsdk', 'md-tags', 'md-cat'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', markDirty);
    });

    $('#md-save').onclick = () => busy($('#md-save'), async () => {
        const body = {
            package: $('#md-package').value.trim(),
            author: $('#md-author').value.trim(),
            description: $('#md-desc').value.trim(),
            repository: $('#md-repo').value.trim(),
            category: parseInt($('#md-cat').value, 10),
            min_sdk_version: $('#md-minsdk').value.trim(),
            tags: $('#md-tags').value.split(',').map(x => x.trim()).filter(Boolean),
            i18n: [...v.querySelectorAll('[data-lg].active')].map(b => b.dataset.lg),
            logo: mdLogoValue(),
        };
        const d = await withTotp(code => api('/api/modules/manage', { method: 'POST', body: JSON.stringify({ action: 'edit', name: m.name, type: m.type, edit_data: body, totp_code: code || undefined }) }));
        if (d.cancelled) return;
        if (d.error) return toast(d.message || d.error, 1);
        clearDirty();
        toast(t('editOk'));
        S.modDetail = null; loadView();
    });
    mdRefresh();
}

// ═══ 提交新模块（创建应用形态）═══
// 仓库地址解析：github.com / codeberg.org → {owner, repo, avatar}
function parseRepo(url) {
    const m = String(url || '').trim().match(/^https:\/\/(?:www\.)?(github\.com|codeberg\.org)\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/);
    if (!m) return null;
    const owner = m[2], repo = m[3].replace(/\.git$/, '');
    const avatar = m[1] === 'github.com'
        ? `https://github.com/${owner}.png?size=128`
        : `https://codeberg.org/${owner}.avatar.png`;
    return { owner, repo, avatar, host: m[1] };
}

function viewSubmit(v) {
    const cats = t('cat');
    const LANGS8 = ['zh', 'zh-TW', 'en', 'ja', 'ru', 'ko', 'ms', 'pt-br'];
    v.innerHTML = `<div class="page-title">${esc(t('nav.submit'))}</div><div class="page-desc">${esc(t('submitDesc'))}</div>
        <div class="card" style="max-width:860px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                <div class="field"><label>${esc(t('fName'))} *</label><input id="sb-name" placeholder="MyModule"></div>
                <div class="field"><label>${esc(t('fType'))} *</label><select id="sb-type"><option value="module">module</option><option value="adapter">adapter</option></select></div>
            </div>
            <div class="field"><label>${esc(t('fPackage'))} *</label><input id="sb-package" placeholder="ErisPulse-MyModule"></div>
            <div class="field"><label>${esc(t('fDesc'))} *</label><textarea id="sb-desc" rows="3"></textarea><div class="hint sb-count" hidden></div></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                <div class="field"><label>${esc(t('fAuthor'))} *</label><input id="sb-author" value="${esc(S.me.display_name || S.me.username)}"></div>
                <div class="field"><label>${esc(t('fRepo'))} *</label><input id="sb-repo" placeholder="https://github.com/owner/repo"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                <div class="field"><label>${esc(t('fCategory'))} *</label><select id="sb-cat">${Object.entries(cats).map(([id, name]) => `<option value="${id}">${esc(name)}</option>`).join('')}</select></div>
                <div class="field"><label>${esc(t('fMinSdk'))}</label><input id="sb-minsdk" placeholder=">=2.7.0"></div>
            </div>
            <div class="field"><label>${esc(t('fTags'))}</label><input id="sb-tags" placeholder="tag1, tag2"></div>
            <div class="field"><label>${esc(t('fI18n'))}</label>
                <div style="display:flex;gap:6px;flex-wrap:wrap">${LANGS8.map(lg => `<button type="button" data-lg="${lg}" class="pill ${lg === 'zh' ? 'active' : ''}">${lg}</button>`).join('')}</div>
            </div>
            <div class="field"><label>${esc(t('fLogo'))}</label>
                <div style="display:flex;gap:8px;align-items:center">
                    <input id="sb-logo" placeholder="https://…" style="flex:1">
                    <label class="btn ghost sm" style="cursor:pointer">${esc(t('uploadLogo'))}<input type="file" id="sb-logo-file" accept="image/*" hidden></label>
                </div>
                <label class="logo-owner-row" id="sb-logo-owner" hidden><input type="checkbox" id="sb-logo-gh"><img id="sb-logo-gh-img" alt=""><span id="sb-logo-gh-text"></span></label>
                <span class="hint">${esc(t('fLogoHint'))}</span>
                <input type="hidden" id="sb-logo-data">
                <div class="logo-live-preview" id="sb-logo-preview"></div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px">
                <button class="btn ghost" id="sb-cancel">${esc(t('cancel'))}</button>
                <button class="btn" id="sb-submit" style="min-width:140px">${esc(t('submitModule'))}</button>
            </div>
        </div>`;

    // ── logo 生效值与预览（URL / 上传 / 作者头像 三选一互斥）──
    let ghOwner = null;   // parseRepo 结果缓存
    const logoValue = () => $('#sb-logo-gh').checked && ghOwner ? ghOwner.avatar
        : ($('#sb-logo-data').value || $('#sb-logo').value.trim() || '');
    const refreshPreview = () => {
        const val = logoValue();
        $('#sb-logo-preview').innerHTML = val
            ? `<span class="hint">${esc(t('curLogo'))}</span>${modLogoHtml({ name: $('#sb-name').value || '?', logo: val }, 44)}`
            : `<span class="hint">${esc(t('logoPreviewEmpty'))}</span>`;
    };

    // 仓库输入：解析 owner → 显示头像勾选项（默认勾）+ 仅空值时自动填充 author/package
    const autoFilled = { author: false, package: false };
    const onRepo = () => {
        markDirty();
        const parsed = parseRepo($('#sb-repo').value);
        const row = $('#sb-logo-owner');
        if (parsed) {
            ghOwner = parsed;
            row.hidden = false;
            $('#sb-logo-gh-img').src = parsed.avatar;
            $('#sb-logo-gh-text').textContent = t('useOwnerLogo')(parsed.owner);
            if (!$('#sb-logo-data').value && !$('#sb-logo').value.trim()) $('#sb-logo-gh').checked = true;
            if (!autoFilled.author && !$('#sb-author').value.trim()) { $('#sb-author').value = parsed.owner; autoFilled.author = true; }
            // repo 名已带 ErisPulse- 前缀时直接复用，避免拼出双重前缀
            if (!autoFilled.package && !$('#sb-package').value.trim()) {
                $('#sb-package').value = /^ErisPulse-/i.test(parsed.repo) ? parsed.repo : 'ErisPulse-' + parsed.repo;
                autoFilled.package = true;
            }
        } else {
            ghOwner = null;
            row.hidden = true;
            $('#sb-logo-gh').checked = false;
        }
        setFieldErr($('#sb-repo'), parsed ? '' : ($('#sb-repo').value.trim() ? t('errRepo') : ''));
        refreshPreview();
    };
    $('#sb-repo').addEventListener('input', onRepo);
    $('#sb-repo').addEventListener('blur', onRepo);

    // 其余字段（author/tags/minsdk/type/cat 等）任何变更即 dirty
    ['sb-author', 'sb-tags', 'sb-minsdk', 'sb-type', 'sb-cat', 'sb-logo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', markDirty);
    });

    // 互斥：URL/上传变更时取消头像勾选
    $('#sb-logo').addEventListener('input', () => { $('#sb-logo-gh').checked = false; refreshPreview(); });
    $('#sb-logo-gh').addEventListener('change', () => {
        if ($('#sb-logo-gh').checked) { $('#sb-logo').value = ''; $('#sb-logo-data').value = ''; }
        refreshPreview();
    });

    // ── 即时校验（blur 触发，input 修正即清）──
    const validateMap = [
        ['#sb-name', val => !/^[A-Za-z0-9_-]+$/.test(val) && val ? t('errName') : ''],
        ['#sb-package', val => !/^[A-Za-z0-9_.-]+$/.test(val) && val ? t('errPackage') : ''],
        ['#sb-desc', val => val && val.length < 10 ? t('errDesc') : ''],
    ];
    validateMap.forEach(([sel, fn]) => {
        const el = $(sel);
        el.addEventListener('blur', () => setFieldErr(el, fn(el.value.trim())));
        el.addEventListener('input', () => { if (el.closest('.field').classList.contains('err')) setFieldErr(el, fn(el.value.trim())); markDirty(); });
        el.addEventListener('change', markDirty);
    });
    // 描述字数计数
    const desc = $('#sb-desc');
    const counter = $('.sb-count');
    const updCount = () => { counter.hidden = false; counter.textContent = t('descCount')(desc.value.trim().length); counter.classList.toggle('warn', desc.value.trim().length > 0 && desc.value.trim().length < 10); };
    desc.addEventListener('input', updCount);
    v.querySelectorAll('[data-lg]').forEach(b => b.onclick = () => { b.classList.toggle('active'); markDirty(); });

    $('#sb-cancel').onclick = async () => { if (!(await confirmLeave())) return; S.view = 'modules'; render(); };
    $('#sb-logo-file').onchange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
            const dataUrl = await compressImage(f, 100 * 1024);
            $('#sb-logo-data').value = dataUrl;
            $('#sb-logo').value = '';
            $('#sb-logo-gh').checked = false;
            refreshPreview();
            markDirty();
        } catch (err) { toast(err.message === 'size' ? t('imgTooLarge') : err.message === 'read' ? t('imgReadFail') : err.message, 1); }
    };

    $('#sb-submit').onclick = () => busy($('#sb-submit'), async () => {
        const body = {
            name: $('#sb-name').value.trim(), type: $('#sb-type').value,
            package: $('#sb-package').value.trim(), description: $('#sb-desc').value.trim(),
            author: $('#sb-author').value.trim(), repository: $('#sb-repo').value.trim(),
            category: parseInt($('#sb-cat').value, 10),
            tags: $('#sb-tags').value.split(',').map(x => x.trim()).filter(Boolean),
            i18n: [...v.querySelectorAll('[data-lg].active')].map(b => b.dataset.lg),
            logo: logoValue(),
        };
        // 提交前终检：全部红边提示一遍
        let firstErr = null;
        validateMap.forEach(([sel, fn]) => {
            const el = $(sel);
            const msg = el.value.trim() ? fn(el.value.trim()) : t('fillFirst')(el.closest('.field').querySelector('label').textContent.replace(' *', ''));
            if (msg) { setFieldErr(el, msg); firstErr = firstErr || el; }
        });
        if (!body.repository) { setFieldErr($('#sb-repo'), t('fillFirst')(t('fRepo'))); firstErr = firstErr || $('#sb-repo'); }
        else if (!parseRepo(body.repository)) { setFieldErr($('#sb-repo'), t('errRepo')); firstErr = firstErr || $('#sb-repo'); }
        if (firstErr) { firstErr.focus(); return; }

        const ms = $('#sb-minsdk').value.trim();
        if (ms) body.min_sdk_version = ms;
        const d = await withTotp(code => {
            const payload = code ? { ...body, totp_code: code } : body;
            return api('/api/modules/submit', { method: 'POST', body: JSON.stringify(payload) });
        });
        if (d.cancelled) return;
        if (d.error) return toast(d.message || d.error, 1);
        clearDirty();
        toast(t('submitOk'));
        S.view = 'modules'; render();
    });
    refreshPreview();
}

// ═══ 用户 / 接入应用 / 审计 / 资料 ═══
async function viewUsers(v) {
    v.innerHTML = `<div class="page-title">${esc(t('nav.users'))}</div><div class="page-desc">${esc(t('usersDesc'))}</div>
        <div class="card" style="padding:0;overflow:hidden"><table id="u-table"><thead><tr><th style="padding-left:20px">${esc(t('name'))}</th><th>${esc(t('email'))}</th><th>${esc(t('role'))}</th><th>${esc(t('status'))}</th><th style="padding-right:20px"></th></tr></thead></table></div>`;
    const data = await api('/api/admin/users');
    if (data.error) return v.innerHTML += `<div class="empty">${esc(data.message || data.error)}</div>`;
    v.querySelector('#u-table').innerHTML += `<tbody>${(data.users || []).map(u => `<tr>
        <td style="padding-left:20px"><div style="display:flex;align-items:center;gap:10px">${avatarHtml(u, 30)}<div><b>${esc(u.display_name || u.username)}</b><br><span class="muted" style="font-size:11px">@${esc(u.username)}</span></div></div></td>
        <td class="muted">${esc(u.email || '—')}</td>
        <td><span class="badge role">${u.role}</span></td>
        <td>${u.status === 'banned' ? `<span class="badge banned">${esc(t('banned'))}</span>` : `<span class="muted">${esc(t('normal'))}</span>`}</td>
        <td style="padding-right:20px;text-align:right;white-space:nowrap">
            <select data-role="${esc(u.uid)}" class="mini-select">${['user', 'mod', 'admin'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
            <button class="btn sm danger" data-ban="${esc(u.uid)}" data-to="${u.status === 'banned' ? 0 : 1}">${u.status === 'banned' ? esc(t('unban')) : esc(t('ban'))}</button>
        </td>
    </tr>`).join('')}</tbody>`;
    v.querySelectorAll('[data-role]').forEach(sel => sel.onchange = async () => {
        const d = await api('/api/admin/users/' + sel.dataset.role + '/role', { method: 'POST', body: JSON.stringify({ role: sel.value }) });
        d.error ? toast(d.message || d.error, 1) : toast(t('roleUpdated'));
    });
    v.querySelectorAll('[data-ban]').forEach(b => b.onclick = async () => {
        const d = await api('/api/admin/users/' + b.dataset.ban + '/ban', { method: 'POST', body: JSON.stringify({ banned: b.dataset.to === '1' }) });
        d.error ? toast(d.message || d.error, 1) : (toast(t('saved')), loadView());
    });
}

async function viewClients(v) {
    v.innerHTML = `<div class="page-title">${esc(t('nav.clients'))}</div><div class="page-desc">${esc(t('clientsDesc'))}</div>
        <div class="card" style="max-width:640px"><h3>${esc(t('newClient'))}</h3>
            <div class="field"><label>${esc(t('appName'))}</label><input id="cl-name"></div>
            <div class="field"><label>${esc(t('callback'))}</label><input id="cl-uris" placeholder="https://your-app.example.com/callback"></div>
            <button class="btn" id="cl-create">${esc(t('generate'))}</button>
            <span class="hint" id="cl-result" hidden></span>
        </div>
        <div class="card"><h3>${esc(t('registered'))}</h3><table id="cl-table"><thead><tr><th>${esc(t('appName'))}</th><th>client_id</th><th>${esc(t('callback'))}</th><th></th></tr></thead></table></div>`;
    const data = await api('/api/clients');
    v.querySelector('#cl-table').innerHTML += `<tbody>${((data.clients || []).map(c => `<tr>
        <td><b>${esc(c.name)}</b></td><td class="mono">${esc(c.client_id)}</td>
        <td class="muted" style="font-size:11px">${esc(JSON.parse(c.redirect_uris).join(' · '))}</td>
        <td style="white-space:nowrap"><button class="btn ghost sm" data-secret="${esc(c.client_id)}">${esc(t('clReset'))}</button>
        <button class="btn ghost sm danger" data-del="${esc(c.client_id)}">${esc(t('del'))}</button></td></tr>`).join('') || `<tr><td colspan="4"><div class="empty">${I.inbox}<span>${esc(t('noClients'))}</span></div></td></tr>`)}</tbody>`;
    $('#cl-create').onclick = () => busy($('#cl-create'), async () => {
        const uris = $('#cl-uris').value.split(/\n|,/).map(x => x.trim()).filter(Boolean);
        const d = await api('/api/clients', { method: 'POST', body: JSON.stringify({ name: $('#cl-name').value, redirect_uris: uris }) });
        if (d.error) return toast(d.message || d.error, 1);
        const out = $('#cl-result');
        out.hidden = false;
        out.textContent = 'client_id: ' + d.client_id + '\nclient_secret: ' + d.client_secret + '\n' + t('secretOnce');
        toast(t('created'));
        loadView();
    });
    v.querySelectorAll('[data-secret]').forEach(b => b.onclick = async () => {
        if (!(await uiConfirm(t('clResetConfirm')))) return;
        const d = await api('/api/clients/' + b.dataset.secret + '/secret', { method: 'POST' });
        if (d.error) return toast(d.message || d.error, 1);
        alert('client_secret: ' + d.client_secret + '\n' + t('secretOnce'));
    });
    v.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        if (!(await uiConfirm(t('confirmDelete')))) return;
        const d = await api('/api/clients/' + b.dataset.del + '/delete', { method: 'POST' });
        if (d.error) return toast(d.message || d.error, 1);
        toast(t('saved')); loadView();
    });
}

async function viewAudit(v) {
    v.innerHTML = `<div class="page-title">${esc(t('nav.audit'))}</div><div class="page-desc">${esc(t('auditDesc'))}</div>
        <div class="card" style="padding:0;overflow:hidden"><table id="a-table"><thead><tr><th style="padding-left:20px">${esc(t('time'))}</th><th>${esc(t('action'))}</th><th>${esc(t('target'))}</th><th style="padding-right:20px">${esc(t('detail'))}</th></tr></thead></table></div>`;
    const data = await api('/api/admin/audit');
    v.querySelector('#a-table').innerHTML += `<tbody>${((data.log || []).map(l => `<tr>
        <td class="muted" style="padding-left:20px;font-size:11px">${esc(String(l.created_at || '').slice(0, 19).replace('T', ' '))}</td>
        <td><span class="mono">${esc(l.action)}</span></td>
        <td class="mono muted">${esc(l.target || '')}</td>
        <td class="muted" style="padding-right:20px">${esc(l.detail || '')}</td></tr>`).join('') || `<tr><td colspan="4"><div class="empty">${I.audit}<span>${esc(t('noRecords'))}</span></div></td></tr>`)}</tbody>`;
}

async function viewProfile(v) {
    const u = S.me;
    v.innerHTML = `<div class="page-title">${esc(t('nav.profile'))}</div><div class="page-desc">${esc(t('profileDesc'))}</div>
        <div class="card" style="max-width:640px"><h3>${esc(t('myProfile'))}</h3>
            <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">
                <label class="avatar-up">${avatarHtml(u, 64)}<input type="file" id="pf-avatar" accept="image/*" hidden><span class="mask">${esc(t('change'))}</span></label>
                <div><b style="font-size:15px">${esc(u.display_name)}</b> <span class="muted">@${esc(u.username)}</span><br>
                <span class="muted" style="font-size:12px">${u.email ? (u.email_verified ? '✓ ' : '… ') + esc(u.email) : esc(t('noEmail'))}</span></div>
            </div>
            <div class="field"><label>${esc(t('loginMethods'))}</label>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <span class="pill active">${esc(t('emailPw'))}</span>
                    ${S.identities.map(p => `<span class="pill active">${esc(t(p) || p)}</span>`).join('')}
                </div>
            </div>
            <div class="field"><label>${esc(t('displayName'))}</label><input id="pf-name" value="${esc(u.display_name)}"></div>
            <div class="field"><label>${esc(t('changePw'))}</label><input id="pf-old" type="password" placeholder="${esc(t('curPw'))}"><input id="pf-new" type="password" placeholder="${esc(t('newPw'))}" style="margin-top:8px"></div>
            <button class="btn" id="pf-save">${esc(t('save'))}</button>
        </div>
        <div class="card" style="max-width:640px;margin-top:16px"><h3>${esc(t('sec2fa'))}
            <span class="pill ${u.totp_enabled ? 'active' : ''}" style="margin-left:8px">${esc(u.totp_enabled ? t('sec2faOn') : t('sec2faOff'))}</span></h3>
            <p class="muted" style="font-size:12px">${esc(t('sec2faSetupHint'))}</p>
            <div id="tf-setup-box"></div>
            ${u.totp_enabled
                ? `<div class="field"><label>${esc(t('sec2faCode'))}</label><input id="tf-off-code" maxlength="6" placeholder="123456" inputmode="numeric"></div>
                   <button class="btn danger" id="tf-disable">${esc(t('sec2faDisable'))}</button>`
                : `<button class="btn" id="tf-setup">${esc(t('sec2faEnable'))}</button>`}
        </div>`;
    $('#pf-avatar').onchange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
            const dataUrl = await compressImage(f, 100 * 1024);
            const d = await api('/api/me/avatar', { method: 'POST', body: JSON.stringify({ data_url: dataUrl }) });
            d.error ? toast(d.message || d.error, 1) : (toast(t('avatarUpdated')), await refreshMe(), loadView());
        } catch (err) { toast(err.message, 1); }
    };
    $('#pf-save').onclick = async () => {
        const body = { display_name: $('#pf-name').value };
        if ($('#pf-new').value) { body.old_password = $('#pf-old').value; body.password = $('#pf-new').value; }
        const d = await api('/api/me', { method: 'PATCH', body: JSON.stringify(body) });
        d.error ? toast(d.message || d.error, 1) : (toast(t('saved')), await refreshMe(), loadView());
    };
    const setupBtn = $('#tf-setup');
    if (setupBtn) setupBtn.onclick = async () => {
        const d = await api('/api/me/totp/setup', { method: 'POST' });
        if (d.error) return toast(d.message || d.error, 1);
        $('#tf-setup-box').innerHTML = `
            <div class="tf-qr" id="tf-qr"></div>
            <p class="tf-qr-hint">${esc(t('sec2faScan'))}</p>
            <div class="field"><label>${esc(t('sec2faKey'))}</label>
                <div style="display:flex;gap:8px"><input id="tf-secret" value="${esc(d.secret)}" readonly style="flex:1;font-family:ui-monospace,SFMono-Regular,monospace;letter-spacing:1px">
                <button class="btn ghost sm" id="tf-copy">${esc(t('copy'))}</button></div>
            </div>
            <div class="field"><label>${esc(t('sec2faCode'))}</label><input id="tf-on-code" maxlength="6" placeholder="123456" inputmode="numeric"></div>
            <button class="btn" id="tf-enable">${esc(t('sec2faConfirm'))}</button>`;
        try {
            const qr = qrcode(0, 'M');
            qr.addData(d.otpauth);
            qr.make();
            $('#tf-qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
        } catch (e) {
            $('#tf-qr').innerHTML = `<code style="font-size:11px;word-break:break-all">${esc(d.otpauth)}</code>`;
        }
        $('#tf-copy').onclick = () => { $('#tf-secret').select(); document.execCommand('copy'); toast(t('tkCopied')); };
        $('#tf-enable').onclick = async () => {
            const code = $('#tf-on-code').value.trim();
            if (!/^\d{6}$/.test(code)) return toast(t('fillFirst')(t('code')), 1);
            const r = await api('/api/me/totp/enable', { method: 'POST', body: JSON.stringify({ code }) });
            if (r.error) return toast(r.message || r.error, 1);
            toast(t('sec2faEnabled')); await refreshMe(); loadView();
        };
    };
    const disBtn = $('#tf-disable');
    if (disBtn) disBtn.onclick = async () => {
        const code = $('#tf-off-code').value.trim();
        if (!/^\d{6}$/.test(code)) return toast(t('fillFirst')(t('code')), 1);
        const d = await api('/api/me/totp/disable', { method: 'POST', body: JSON.stringify({ code }) });
        if (d.error) return toast(d.message || d.error, 1);
        toast(t('sec2faDisabled')); await refreshMe(); loadView();
    };
}

// ═══ 访问令牌 ═══
// ═══ 文档（内置五语，每次访问刷新；无对应语言回退 en）═══
// 文档渲染（marked + 基础消毒）
async function renderMarkdown(md) {
    if (typeof marked === 'undefined') {
        await new Promise((res, rej) => {
            const sc = document.createElement('script');
            sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js';
            sc.onload = res; sc.onerror = rej;
            document.head.appendChild(sc);
        });
    }
    let html = '';
    try { html = marked.parse(md); } catch (err) { html = '<pre>' + esc(md) + '</pre>'; }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, iframe, object, embed, form').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
        [...el.attributes].forEach(attr => {
            const n = attr.name.toLowerCase(), val = attr.value.toLowerCase().trim();
            if (n.startsWith('on') || ((n === 'href' || n === 'src') && (val.startsWith('javascript:') || val.startsWith('data:text')))) el.removeAttribute(attr.name);
        });
    });
    return doc.body.innerHTML;
}

// 文档：左侧板块导航 + 右侧内容，每个功能一篇
async function viewDocs(v) {
    const lang = LOCALES.includes(LANG) ? LANG : 'en';
    v.innerHTML = `<div class="page-title">${esc(t('nav.docs'))}</div><div class="page-desc">${esc(t('docsDesc'))}</div>
        <div class="docs-layout">
            <nav class="docs-nav" id="docs-nav"></nav>
            <article class="md-body docs-body" id="docs-body"><div class="empty">${esc(t('docsLoading'))}</div></article>
        </div>`;
    const nav = $('#docs-nav');
    const body = $('#docs-body');

    let index = [];
    try {
        const resp = await fetch('docs/index.json', { cache: 'no-cache' });
        if (resp.ok) index = await resp.json();
    } catch (e) { /* 目录加载失败下面兜底 */ }
    if (!Array.isArray(index) || !index.length) {
        body.innerHTML = `<div class="empty">${esc(t('docsMissing'))}</div>`;
        return;
    }

    nav.innerHTML = index.map((d, i) => `<button class="docs-link ${i === 0 ? 'active' : ''}" data-slug="${esc(d.slug)}">${esc((d.title && (d.title[lang] || d.title.en)) || d.slug)}</button>`).join('');

    const loadDoc = async (slug) => {
        body.innerHTML = `<div class="empty">${esc(t('docsLoading'))}</div>`;
        let md = null;
        for (const lp of [lang, 'en']) {
            try {
                const resp = await fetch('docs/' + lp + '/' + slug + '.md', { cache: 'no-cache' });
                if (resp.ok) { md = await resp.text(); break; }
            } catch (e) { /* 尝试下一个语言 */ }
        }
        if (md == null) { body.innerHTML = `<div class="empty">${esc(t('docsMissing'))}</div>`; return; }
        body.innerHTML = await renderMarkdown(md);
        document.querySelector('.content')?.scrollTo?.({ top: 0 });
        window.scrollTo({ top: 0 });
    };

    nav.querySelectorAll('.docs-link').forEach(b => b.onclick = () => {
        nav.querySelectorAll('.docs-link').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        loadDoc(b.dataset.slug);
    });
    await loadDoc(index[0].slug);
}

async function viewTokens(v) {
    v.innerHTML = `<div class="page-title">${esc(t('navTokens'))}</div>
        <div class="card" style="max-width:640px">
            <div style="display:flex;gap:10px">
                <div class="field" style="flex:1;margin-bottom:0"><input id="tk-name" placeholder="${esc(t('tkName'))}"></div>
                <button class="btn" id="tk-create">${esc(t('tkCreate'))}</button>
            </div>
            ${S.me && S.me.totp_enabled ? `<label class="tk-skip2fa"><input type="checkbox" id="tk-skip2fa"><span>${esc(t('tkSkip2fa'))}<small>${esc(t('tkSkip2faHint'))}</small></span></label>` : ''}
        </div>
        <div class="card"><table id="tk-table"><thead><tr><th>${esc(t('tkName'))}</th><th>token</th><th>${esc(t('tkLast'))}</th><th>${esc(t('tkCreated'))}</th><th></th></tr></thead></table></div>`;
    $('#tk-create').onclick = () => busy($('#tk-create'), async () => {
        const skip2fa = !!($('#tk-skip2fa') && $('#tk-skip2fa').checked);
        let d = await api('/api/tokens', { method: 'POST', body: JSON.stringify({ name: $('#tk-name').value, skip_2fa: skip2fa }) });
        if (d.error === 'TOTP_REQUIRED') {
            // 免码令牌必须当场实体码：弹码补一次
            const code = await askTotp();
            if (!code) return;
            d = await api('/api/tokens', { method: 'POST', body: JSON.stringify({ name: $('#tk-name').value, skip_2fa: skip2fa, totp_code: code }) });
        }
        if (d.error) return toast(d.message || d.error, 1);
        // 令牌模态窗：仅此一次显示，关闭即不可再见
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:var(--modal);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px';
        ov.innerHTML = `<div style="background:var(--bg-t-solid);border:1px solid var(--bd);border-radius:16px;box-shadow:var(--shadow-hover);width:min(520px,100%);padding:24px 26px">
            <h3 style="font-size:15px;font-weight:700;margin-bottom:8px">${esc(t('tkModalTitle'))}</h3>
            <p style="font-size:12.5px;color:var(--tx-s);margin-bottom:10px">${esc(t('tkWarn'))}</p>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
                <input readonly value="${esc(d.token)}" style="flex:1;padding:9px 12px;border-radius:10px;border:1px solid var(--bd);background:var(--bg-s);color:var(--tx-p);font-family:ui-monospace,Menlo,monospace;font-size:12px" onclick="this.select()">
                <button class="btn sm" id="tk-copy">Copy</button>
            </div>
            <button class="btn" style="width:100%" id="tk-close">${esc(t('cancel'))}</button>
        </div>`;
        document.body.appendChild(ov);
        ov.querySelector('#tk-copy').onclick = () => { navigator.clipboard.writeText(d.token); toast(t('tkCopied')); };
        ov.querySelector('#tk-close').onclick = () => { ov.remove(); loadView(); };
    });
    const data = await api('/api/tokens');
    v.querySelector('#tk-table').innerHTML += `<tbody>${((data.tokens || []).map(k => `<tr>
        <td><b>${esc(k.name)}</b>${k.skip_2fa ? ` <span class="badge role">${esc(t('badgeNo2fa'))}</span>` : ''}</td>
        <td class="mono muted">${esc(k.prefix)}</td>
        <td class="muted">${esc((k.last_used_at || '').slice(0, 10)) || '—'}</td>
        <td class="muted">${esc((k.created_at || '').slice(0, 10))}</td>
        <td><button class="btn sm danger" data-tk="${k.id}">${esc(t('tkRevoke'))}</button></td>
    </tr>`).join('') || `<tr><td colspan="5"><div class="empty">${I.inbox}<span>${esc(t('tkNone'))}</span></div></td></tr>`)}</tbody>`;
    v.querySelectorAll('[data-tk]').forEach(b => b.onclick = async () => {
        const d = await api('/api/tokens/' + b.dataset.tk + '/revoke', { method: 'POST' });
        d.error ? toast(d.message || d.error, 1) : (toast(t('tkRevokeOk')), loadView());
    });
}

// ═══ 生态动态 ═══
async function viewActivity(v) {
    v.innerHTML = `<div class="page-title">${esc(t('navActivity'))}</div><div class="page-desc">ErisPulse / ErisPulse-ModuleRepo</div>
        <div class="card"><h3>${esc(t('ecReleases'))}</h3><div id="ec-rel"><div class="empty">${esc(t('loading'))}</div></div></div>
        <div class="card"><h3>${esc(t('ecIssues'))}</h3><div id="ec-iss"><div class="empty">${esc(t('loading'))}</div></div></div>`;
    const d = await api('/api/ecosystem');
    const rel = d.releases || [], iss = d.issues || [];
    v.querySelector('#ec-rel').innerHTML = rel.length ? `<table><tbody>${rel.map(r => `<tr>
        <td><a href="${esc(r.url)}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none"><b>${esc(r.tag)}</b> <span class="muted" style="font-size:12px">${esc(String(r.name || '').slice(0, 40))}</span></a></td>
        <td class="muted" style="text-align:right;font-size:11px">${esc(r.date)}</td>
    </tr>`).join('')}</tbody></table>` : `<div class="empty">${esc(t('ecEmpty'))}</div>`;
    v.querySelector('#ec-iss').innerHTML = iss.length ? `<table><tbody>${iss.map(i => `<tr>
        <td><a href="${esc(i.url)}" target="_blank" rel="noopener" style="color:var(--tx-p);text-decoration:none">#${i.number} ${esc(String(i.title).slice(0, 50))}</a></td>
        <td class="muted" style="text-align:right;font-size:11px">${esc(i.updated)}</td>
    </tr>`).join('')}</tbody></table>` : `<div class="empty">${esc(t('ecEmpty'))}</div>`;
}

// ═══ 认领审核（staff）═══
async function viewClaims(v) {
    v.innerHTML = `<div class="page-title">${esc(t('navClaims'))}</div><div class="page-desc">${esc(t('clApprove'))} → ${esc(t('clSubmit'))} submitter</div>
        <div class="card"><table id="cl-table"><thead><tr><th>${esc(t('fName'))}</th><th>${esc(t('submitter'))}</th><th>${esc(t('clReason'))}</th><th></th></tr></thead></table></div>`;
    const data = await api('/api/admin/claims');
    v.querySelector('#cl-table').innerHTML += `<tbody>${((data.claims || []).map(c => `<tr>
        <td><b>${esc(c.module_name)}</b> <span class="muted" style="font-size:11px">${esc(c.module_type)}</span></td>
        <td><b>@${esc(c.username)}</b></td>
        <td class="muted" style="font-size:12px;max-width:280px">${esc(c.reason || '—')}</td>
        <td style="white-space:nowrap">
            <button class="btn sm ok" data-cl="${c.id}" data-act="approve">${esc(t('clApprove'))}</button>
            <button class="btn sm danger" data-cl="${c.id}" data-act="reject">${esc(t('clReject'))}</button>
        </td>
    </tr>`).join('') || `<tr><td colspan="4"><div class="empty">${I.check}<span>${esc(t('clNone'))}</span></div></td></tr>`)}</tbody>`;
    v.querySelectorAll('[data-cl]').forEach(b => b.onclick = async () => {
        const d = await api('/api/admin/claims/' + b.dataset.cl + '/' + b.dataset.act, { method: 'POST' });
        d.error ? toast(d.message || d.error, 1) : (toast(t('dispatched')), loadView());
    });
}

// ═══ 图片压缩（≤maxBytes，多级尺寸/质量回退）═══
function compressImage(file, maxBytes) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => {
            const img = new Image();
            img.onload = () => {
                let side = Math.min(512, Math.max(img.width, img.height));
                let dataUrl = '';
                for (let q = 0.85; q >= 0.4; q -= 0.15) {
                    const sc = Math.min(1, side / Math.max(img.width, img.height));
                    const c = document.createElement('canvas');
                    c.width = Math.max(1, Math.round(img.width * sc));
                    c.height = Math.max(1, Math.round(img.height * sc));
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    dataUrl = c.toDataURL('image/webp', q);
                    if (dataUrl.length * 0.75 <= (maxBytes || 1048576)) return res(dataUrl);
                    side = Math.round(side * 0.8);
                }
                rej(new Error('size'));
            };
            img.onerror = () => rej(new Error('read'));
            img.src = r.result;
        };
        r.readAsDataURL(file);
    });
}

async function refreshMe() {
    if (!S.token) return;
    const d = await api('/api/me');
    if (!d.error) { S.me = d.user; S.identities = (d.identities || []).map(r => r.provider); }
}

// ═══ 启动 ═══
async function boot() {
    const theme = localStorage.getItem('wb-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    S.config = await api('/api/config').catch(() => S.config);
    if (await handleOAuthCallback().catch(() => false)) return;   // 上游 OAuth 回跳：登录完成或已提示错误
    if (S.token) {
        await refreshMe();
        if (!S.me) { S.token = null; localStorage.removeItem('wb-token'); }
    }
    render();
    applyBackground();   // loader 不显示背景图，进入界面后再加载
    if (S.me && location.hash.startsWith('#login?next=')) {
        const next = decodeURIComponent(location.hash.split('next=')[1] || '');
        if (next.startsWith('/')) { location.href = next; return; }
    }
}
boot();
