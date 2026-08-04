const TMDB_API_BASE_URL = "https://api.themoviedb.org";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org";
const CACHE_TTL_SECONDS = 600;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Accept-Language",
};
const NULL_BODY_STATUS_CODES = new Set([101, 204, 205, 304]);

function buildCorsResponse(status = 200) {
  return new Response(null, {
    status,
    headers: CORS_HEADERS,
  });
}

function buildJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function withCorsHeaders(response) {
  const headers = new Headers(response.headers);

  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });

  const body = NULL_BODY_STATUS_CODES.has(response.status) ? null : response.body;

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function buildTargetUrl(url) {
  if (url.pathname.startsWith("/t/p/")) {
    return new URL(`${TMDB_IMAGE_BASE_URL}${url.pathname}${url.search}`);
  }

  return new URL(`${TMDB_API_BASE_URL}${url.pathname}${url.search}`);
}

function buildUpstreamRequest(request, targetUrl) {
  const headers = new Headers();
  const passthroughHeaders = [
    "authorization",
    "accept",
    "accept-language",
    "content-type",
  ];

  passthroughHeaders.forEach((headerName) => {
    const value = request.headers.get(headerName);

    if (value) {
      headers.set(headerName, value);
    }
  });

  return new Request(targetUrl.toString(), {
    method: request.method,
    headers,
  });
}

async function fetchAndCache(request, cacheKey, env, ctx) {
  const cache = caches.default;
  const cachedResponse = await cache.match(cacheKey);

  if (cachedResponse) {
    return withCorsHeaders(cachedResponse);
  }

  const upstreamResponse = await fetch(request, {
    cf: {
      cacheTtl: CACHE_TTL_SECONDS,
      cacheEverything: true,
    },
  });

  const responseWithCors = withCorsHeaders(upstreamResponse);

  if (upstreamResponse.status === 200) {
    ctx.waitUntil(cache.put(cacheKey, responseWithCors.clone()));
  }

  return responseWithCors;
}

async function proxyRequest(request, env, ctx) {
  const url = new URL(request.url);
  const targetUrl = buildTargetUrl(url);
  const upstreamRequest = buildUpstreamRequest(request, targetUrl);
  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const response = await fetch(upstreamRequest);
    return withCorsHeaders(response);
  }

  const cacheKey = new Request(url.toString(), { method: "GET" });
  return fetchAndCache(upstreamRequest, cacheKey, env, ctx);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return buildCorsResponse();
    }

  if (request.method !== "GET" && request.method !== "HEAD") {
      return buildJsonResponse(
        {
          error: "Method not allowed",
        },
        405,
      );
    }

    const url = new URL(request.url);

    if (url.pathname === "/") {
      return buildJsonResponse({
        name: "tmdb-proxy",
        status: "ok",
        runtime: "cloudflare-workers",
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === "/favicon.ico") {
      return buildCorsResponse(204);
    }

    try {
      return await proxyRequest(request, env, ctx);
    } catch (error) {
      return buildJsonResponse(
        {
          error: "TMDB proxy request failed",
          details: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
};
