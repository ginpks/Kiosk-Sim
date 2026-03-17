const { createClient } = require("redis");

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
const jobsQueueName = "jobs";

const redis = createClient({ url: redisUrl });

redis.on("error", (error) => {
  console.error("Worker Redis error", error);
});

function orderKey(clientOrderId) {
  return `order:${clientOrderId}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processJob(jobPayload) {
  const job = JSON.parse(jobPayload);
  const { clientOrderId } = job;

  if (!clientOrderId) {
    console.error("Skipped job without clientOrderId");
    return;
  }

  const orderJson = await redis.get(orderKey(clientOrderId));

  if (!orderJson) {
    console.error(`Skipped missing order ${clientOrderId}`);
    return;
  }

  const order = JSON.parse(orderJson);

  await redis.set(
    orderKey(clientOrderId),
    JSON.stringify({
      ...order,
      status: "processing",
    })
  );

  // Simulate slow fulfillment work off the API request path.
  await sleep(2000);

  await redis.set(
    orderKey(clientOrderId),
    JSON.stringify({
      ...order,
      status: "completed",
      completedAt: new Date().toISOString(),
    })
  );

  console.log(`Processed order ${clientOrderId}`);
}

async function start() {
  await redis.connect();
  console.log(`Worker started. Redis URL: ${redisUrl}`);

  while (true) {
    const job = await redis.brPop(jobsQueueName, 0);
    await processJob(job.element);
  }
}

start().catch((error) => {
  console.error("Worker failed", error);
  process.exit(1);
});
