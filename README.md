## tmdb-proxy

这是一个部署到 Cloudflare Workers 的 TMDB 代理服务。

它会代理：

1. `api.themoviedb.org`
2. `image.tmdb.org`

根路径 `/` 会返回一段 JSON 健康检查信息。

## 行为说明

1. 代理普通 TMDB API 请求，例如 `/3/configuration`
2. 代理图片请求，例如 `/t/p/w500/xxx.jpg`
3. 透传 `Authorization` 请求头
4. 自动附加 CORS 响应头
5. 对未带 `Authorization` 的 `GET` 请求启用 10 分钟 Cloudflare 边缘缓存

## 部署到 Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/BenZinaDaze/tmdbproxy)

点击上面的按钮后，Cloudflare 会基于当前仓库自动创建并部署这个 Worker。

## 使用方法

部署完成后，你绑定的域名就是 TMDB 代理域名。

示例：

```text
https://your-domain.example/3/configuration
https://your-domain.example/t/p/w500/abc.jpg
```

请求 TMDB API 时，继续在客户端传：

```text
Authorization: Bearer <your_tmdb_token>
```
