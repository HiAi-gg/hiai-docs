#!/usr/bin/env sh
set -eu

# Prove that host port overrides never leak into the container network
# contract. Compose must keep api:50700 and web:50701 internally.
API_PORT=57100 WEB_PORT=57101 docker compose config --format json | bun -e '
const compose = await Bun.stdin.json();
const api = compose.services.api;
const web = compose.services.web;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(api.ports.some((port) => port.published === "57100" && port.target === 50700), "API host mapping must be 57100:50700");
assert(api.environment.API_PORT === "50700", "API process must listen on 50700");
assert(api.healthcheck.test.join(" ").includes("127.0.0.1:50700/api/health"), "API healthcheck must use 50700");

assert(web.ports.some((port) => port.published === "57101" && port.target === 50701), "Web host mapping must be 57101:50701");
assert(web.environment.API_URL === "http://api:50700", "Web must reach api:50700");
assert(web.environment.PORT === "50701", "Web process must listen on 50701");
assert(web.healthcheck.test.join(" ").includes("127.0.0.1:50701"), "Web healthcheck must use 50701");

console.log("Compose port contract passed: host overrides -> api:50700, web:50701");
'

API_PORT=57100 WEB_PORT=57101 docker compose -f docker-compose.dev.yml.example config --format json | bun -e '
const compose = await Bun.stdin.json();
const api = compose.services.api;
const web = compose.services.web;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(api.ports.some((port) => port.published === "57100" && port.target === 50700), "Dev API host mapping must be 57100:50700");
assert(api.environment.API_PORT === "50700", "Dev API process must listen on 50700");
assert(web.ports.some((port) => port.published === "57101" && port.target === 50701), "Dev web host mapping must be 57101:50701");
assert(web.environment.API_URL === "http://api:50700", "Dev web must reach api:50700");
assert(web.environment.PORT === "50701", "Dev web process must listen on 50701");

console.log("Dev Compose port contract passed: host overrides -> api:50700, web:50701");
'
