import "reflect-metadata";
import { readFileSync } from "fs";
import { join } from "path";
import { RegisterRoutes } from "./routes/routes"; // <-- TSOA generated file

// Mock TSOA expects certain Express types:
type RequestHandler = (req: any, res: any, next: any) => any;

// Our in-memory route store
const routesStore: {
  method: string;
  pathPattern: string;
  handler: RequestHandler;
}[] = [];

// Create a mock router object that TSOA's RegisterRoutes will populate.
// Each method simply pushes a {method, path, handler} into routesStore.
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

// Now call TSOA's RegisterRoutes with our mock router
RegisterRoutes(mockRouter);

// We'll need a small utility to match routes with path params:
// e.g. stored route '/items/:id' should match incoming '/items/123'.
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

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

// Load swagger.json for serving
const swaggerSpecPath = join(__dirname, "swagger.json");
const swaggerSpec = JSON.parse(readFileSync(swaggerSpecPath, "utf-8"));

const handleRequest = async (req: Request) => {
  const url = new URL(req.url);
  const method = req.method;
  const path = url.pathname;

  // Preflight
  if (method === "OPTIONS") {
    return Promise.resolve(new Response(null, { headers: corsHeaders }));
  }

  // Serve swagger.json
  if (method === "GET" && path === "/swagger.json") {
    return Promise.resolve(
      new Response(JSON.stringify(swaggerSpec), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    );
  }

  // Serve minimal Swagger UI
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

  // Attempt to match a stored TSOA route
  const matchedRoute = routesStore.find((storedRoute) => {
    if (storedRoute.method !== method) {
      return false;
    }
    const routeMatchResult = matchRoute(storedRoute.pathPattern, path);
    return routeMatchResult.matched;
  });

  // No match => 404
  if (!matchedRoute) {
    return Promise.resolve(
      new Response(JSON.stringify({ message: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    );
  }

  // If matched, parse path parameters:
  const matchedParams = matchRoute(matchedRoute.pathPattern, path).params;

  // We must parse the body. We'll return a Promise, parse or empty object on error.
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

      // Call the TSOA route handler
      // matchedRoute.handler is from `RegisterRoutes` -> e.g. function (req, res, next) {...}
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

// Start Bun server
Bun.serve({
  port: 3000,
  fetch: handleRequest,
});

console.log("Server running on http://localhost:3000");
