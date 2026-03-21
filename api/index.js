const express = require("express");
const path = require("path");
const { createClient } = require("redis");

const app = express();
const port = Number(process.env.PORT || 3000);
const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
const jobsQueueName = "jobs";
const recentOrdersKey = "recent-orders";
const recentOrdersLimit = 25;
const orderClaimTtlSeconds = 30;

const redis = createClient({ url: redisUrl });

redis.on("error", (error) => {
  console.error("Redis error", error);
});

// Keep the dashboard's recent-order list deduplicated and capped.
async function trackRecentOrder(clientOrderId) {
  await redis.lRem(recentOrdersKey, 0, clientOrderId);
  await redis.lPush(recentOrdersKey, clientOrderId);
  await redis.lTrim(recentOrdersKey, 0, recentOrdersLimit - 1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// Accept an order submission, track retry metadata, and queue work once.
async function enqueueOrder(order) {
  const clientOrderId = order?.clientOrderId;

  if (!clientOrderId) {
    const error = new Error("clientOrderId is required");
    error.statusCode = 400;
    throw error;
  }

  const existingOrderJson = await redis.get(`order:${clientOrderId}`);
  const existingOrder = existingOrderJson ? JSON.parse(existingOrderJson) : null;
  const now = new Date().toISOString();
  const isCompletedOrder = existingOrder?.status === "completed";

  const storedOrder = {
    ...existingOrder,
    ...order,
    quantity: Number(order.quantity || 1),
    status: isCompletedOrder ? existingOrder.status : "queued",
    createdAt: existingOrder?.createdAt || now,
    updatedAt: now,
    lastAttemptAt: now,
    attemptCount: (existingOrder?.attemptCount || 0) + 1,
    isDuplicate: Boolean(existingOrder),
  };

  if (isCompletedOrder) {
    await redis.set(`order:${clientOrderId}`, JSON.stringify(storedOrder));
    await trackRecentOrder(clientOrderId);
    return storedOrder;
  }

  const claimResult = await redis.set(`claim:${clientOrderId}`, now, {
    NX: true,
    EX: orderClaimTtlSeconds,
  });

  if (claimResult !== "OK") {
    if (existingOrder) {
      const duplicateOrder = {
        ...existingOrder,
        ...order,
        quantity: Number(order.quantity || existingOrder.quantity || 1),
        updatedAt: now,
        lastAttemptAt: now,
        attemptCount: (existingOrder.attemptCount || 0) + 1,
        isDuplicate: true,
      };

      await redis.set(`order:${clientOrderId}`, JSON.stringify(duplicateOrder));
      await trackRecentOrder(clientOrderId);
      return duplicateOrder;
    }

    const error = new Error("order is already being created");
    error.statusCode = 409;
    throw error;
  }

  await redis.set(`order:${clientOrderId}`, JSON.stringify(storedOrder));
  await redis.lPush(jobsQueueName, JSON.stringify({ clientOrderId }));
  await trackRecentOrder(clientOrderId);

  return storedOrder;
}

app.post("/kiosk/orders", async (req, res) => {
  try {
    const storedOrder = await enqueueOrder(req.body);
    const params = new URLSearchParams({
      responseTitle: "Order accepted",
      responseBody: JSON.stringify(storedOrder, null, 2),
      clientOrderId: String(req.body.clientOrderId || ""),
      item: String(req.body.item || ""),
      quantity: String(req.body.quantity || "1"),
    });

    return res.redirect(303, `/?${params.toString()}`);
  } catch (error) {
    const params = new URLSearchParams({
      responseTitle: "Order failed",
      responseBody: error.message || "Unexpected error",
      clientOrderId: String(req.body.clientOrderId || ""),
      item: String(req.body.item || ""),
      quantity: String(req.body.quantity || "1"),
    });

    return res.redirect(error.statusCode || 500, `/?${params.toString()}`);
  }
});

app.post("/orders", async (req, res) => {
  try {
    const storedOrder = await enqueueOrder(req.body);
    return res.status(201).json(storedOrder);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || "Unexpected error",
    });
  }
});

app.get("/orders/:clientOrderId", async (req, res) => {
  const { clientOrderId } = req.params;
  const order = await redis.get(`order:${clientOrderId}`);

  if (!order) {
    return res.status(404).json({ error: "order not found" });
  }

  return res.json(JSON.parse(order));
});

app.get("/dashboard/orders", async (_req, res) => {
  const clientOrderIds = await redis.lRange(recentOrdersKey, 0, recentOrdersLimit - 1);

  if (clientOrderIds.length === 0) {
    return res.json([]);
  }

  const orderJsonList = await redis.mGet(
    clientOrderIds.map((clientOrderId) => `order:${clientOrderId}`)
  );

  const orders = orderJsonList
    .filter(Boolean)
    .map((orderJson) => JSON.parse(orderJson));

  return res.json(orders);
});

// Connect Redis before the API begins accepting requests.
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
