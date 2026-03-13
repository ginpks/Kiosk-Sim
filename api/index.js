const express = require("express");
const { createClient } = require("redis");

const app = express();
const port = Number(process.env.PORT || 3000);
const redisUrl = process.env.REDIS_URL || "redis://redis:6379";

const redis = createClient({ url: redisUrl });

redis.on("error", (error) => {
  console.error("Redis error", error);
});

function orderKey(clientOrderId) {
  return `order:${clientOrderId}`;
}

app.use(express.json());

app.post("/orders", async (req, res) => {
  const order = req.body;
  const clientOrderId = order?.clientOrderId;

  if (!clientOrderId) {
    return res.status(400).json({ error: "clientOrderId is required" });
  }

  const storedOrder = {
    ...order,
    status: order.status || "accepted",
  };

  await redis.set(orderKey(clientOrderId), JSON.stringify(storedOrder));

  return res.status(201).json(storedOrder);
});

app.get("/orders/:clientOrderId", async (req, res) => {
  const { clientOrderId } = req.params;
  const order = await redis.get(orderKey(clientOrderId));

  if (!order) {
    return res.status(404).json({ error: "order not found" });
  }

  return res.json(JSON.parse(order));
});

async function start() {
  await redis.connect();

  app.listen(port, () => {
    console.log(`API listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
