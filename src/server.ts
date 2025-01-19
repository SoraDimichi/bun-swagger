import "reflect-metadata";
import { readFileSync } from "fs";
import { join } from "path";
import { RegisterRoutes } from "./routes/routes";

type RequestHandler = (req: any, res: any, next: any) => any;

const routesStore: {
  method: string;
  pathPattern: string;
  handler: RequestHandler;
}[] = [];

const mockRouter: any = {
  get: (pathPattern: string, handler: RequestHandler) =>
    routesStore.push({ method: "GET", pathPattern, handler }),
  post: (pathPattern: string, handler: RequestHandler) =>
    routesStore.push({ method: "POST", pathPattern, handler }),
  put: (pathPattern: string, handler: RequestHandler) =>
    routesStore.push({ method: "PUT", pathPattern, handler }),
  delete: (pathPattern: string, handler: RequestHandler) =>
    routesStore.push({ method: "DELETE", pathPattern, handler }),
  options: (pathPattern: string, handler: RequestHandler) =>
    routesStore.push({ method: "OPTIONS", pathPattern, handler }),
};

RegisterRoutes(mockRouter);

const matchRoute = (tsoaPattern: string, requestPath: string) => {
  const splittedPattern = tsoaPattern
    .split("/")
    .filter((segment) => segment !== "");
  const splittedRequest = requestPath
    .split("/")
    .filter((segment) => segment !== "");

  if (splittedPattern.length !== splittedRequest.length) {
    return { matched: false, params: {} };
  }

  let matched = true;
  const params: Record<string, string> = {};

  splittedPattern.forEach((patternSegment, i) => {
    if (patternSegment.startsWith(":")) {
      // It's a path param, store the param
      params[patternSegment.slice(1)] = splittedRequest[i];
    } else if (patternSegment !== splittedRequest[i]) {
      matched = false;
    }
  });

  return { matched, params };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

const swaggerSpecPath = join(__dirname, "swagger.json");
const swaggerSpec = JSON.parse(readFileSync(swaggerSpecPath, "utf-8"));

const handleRequest = async (req: Request) => {
  const url = new URL(req.url);
  const method = req.method;
  const path = url.pathname;

  if (method === "OPTIONS") {
    return Promise.resolve(new Response(null, { headers: corsHeaders }));
  }

  if (method === "GET" && path === "/swagger.json") {
    return Promise.resolve(
      new Response(JSON.stringify(swaggerSpec), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    );
  }

  if (method === "GET" && path === "/docs") {
    const swaggerUiHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Swagger UI</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
        <script>
          const ui = SwaggerUIBundle({
            url: '/swagger.json',
            dom_id: '#swagger-ui',
          });
        </script>
      </body>
      </html>
    `;
    return Promise.resolve(
      new Response(swaggerUiHtml, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      }),
    );
  }

  const matchedRoute = routesStore.find((storedRoute) => {
    if (storedRoute.method !== method) {
      return false;
    }
    const routeMatchResult = matchRoute(storedRoute.pathPattern, path);
    return routeMatchResult.matched;
  });

  if (!matchedRoute) {
    return Promise.resolve(
      new Response(JSON.stringify({ message: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    );
  }

  const matchedParams = matchRoute(matchedRoute.pathPattern, path).params;

  return req
    .json()
    .then((jsonBody) => jsonBody)
    .catch(() => ({}))
    .then((body) => {
      // Build mock request/response for TSOA
      const expressReq: any = {
        method,
        url: path,
        headers: req.headers,
        query: Object.fromEntries(url.searchParams),
        body,
        params: matchedParams,
      };

      const expressRes: any = {
        statusCode: 200,
        headers: new Headers(),
        body: "",
        setHeader: (key: string, value: string) => {
          expressRes.headers.set(key, value);
        },
        status: (code: number) => {
          expressRes.statusCode = code;
          return expressRes;
        },
        send: (output: any) => {
          expressRes.body = output;
        },
        json: (output: any) => {
          expressRes.setHeader("Content-Type", "application/json");
          expressRes.body = JSON.stringify(output);
        },
      };

      const next = (err?: any) => {
        if (err) {
          expressRes.status(500);
          expressRes.body = JSON.stringify({ error: String(err) });
        }
      };

      return Promise.resolve(matchedRoute.handler(expressReq, expressRes, next))
        .then(() => {
          return new Response(expressRes.body, {
            status: expressRes.statusCode,
            headers: {
              ...corsHeaders,
              ...Object.fromEntries(expressRes.headers.entries()),
            },
          });
        })
        .catch((error: any) => {
          return new Response(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        });
    });
};

Bun.serve({
  port: 3000,
  fetch: handleRequest,
});

console.log("Server running on http://localhost:3000");
