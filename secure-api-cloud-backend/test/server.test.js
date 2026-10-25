import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/server.js";

test("health endpoint reports prototype status", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.service, "nitin-secure-api-cloud");
    assert.equal(json.status, "ok");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("unknown route is not a public proxy", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/not-registered/test`, {
      headers: { authorization: "Bearer 01234567890123456789012345678901" }
    });
    assert.ok([401, 503].includes(response.status));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
