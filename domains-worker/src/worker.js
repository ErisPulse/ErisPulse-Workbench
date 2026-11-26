// plugin-domains 独立 Worker 入口：只服务托管域名的站点流量（逻辑复用 ../src/domains.js）
// 无 ASSETS 绑定——工作台的静态资源缓存与本 Worker 完全隔离。
import { handleDomainRequest } from '../../src/domains.js';

export default {
    async fetch(request, env, ctx) {
        return handleDomainRequest(request, env, ctx);
    },
};
