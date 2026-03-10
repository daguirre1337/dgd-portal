<?php
/**
 * DGD Dashboard - Declarative Route Dispatcher
 *
 * Replaces the 50+ elseif chain with a route table.
 * Each route is [method, pattern, handler, ...args].
 */

/**
 * Dispatch a request against a route table.
 *
 * @param string $method  HTTP method (GET, POST, PUT, DELETE)
 * @param string $path    Normalized request path (no trailing slash)
 * @param array  $routes  Route definitions: [method, regex, callable, ...extra]
 * @return bool  true if a route matched
 */
function dispatch(string $method, string $path, array $routes): bool
{
    foreach ($routes as $route) {
        [$routeMethod, $pattern, $handler] = $route;
        $auth = $route[3] ?? 'auth';  // 'none', 'auth', 'admin'

        if ($routeMethod !== $method) {
            continue;
        }

        if (preg_match($pattern, $path, $matches)) {
            // Enforce auth
            if ($auth === 'auth') {
                requireAuth();
            } elseif ($auth === 'admin') {
                requireAdmin();
            }

            // Call handler with captured groups (skip full match)
            $args = array_slice($matches, 1);
            $handler(...$args);
            return true;
        }
    }

    return false;
}
