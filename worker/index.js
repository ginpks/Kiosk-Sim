const { createClient } = require("redis");

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
const jobsQueueName = "jobs";

const redis = createClient({ url: redisUrl });

redis.on("error", (error) => {
  console.error("Worker Redis error", error);
});

// Simulate slow background work without blocking the API process.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Take one queued job through processing and final completion state.
async function processJob(jobPayload) {
  const job = JSON.parse(jobPayload);
  const { clientOrderId } = job;

  if (!clientOrderId) {
    console.error("Skipped job without clientOrderId");
    return;
  }

  const orderJson = await redis.get(`order:${clientOrderId}`);

  if (!orderJson) {
    console.error(`Skipped missing order ${clientOrderId}`);
    return;
  }

  const order = JSON.parse(orderJson);
  const processingAt = new Date().toISOString();

  await redis.set(
    `order:${clientOrderId}`,
    JSON.stringify({
      ...order,
      status: "processing",
      updatedAt: processingAt,
    })
  );

  // Simulate slow fulfillment work off the API request path.
  await sleep(2000);

  const completedAt = new Date().toISOString();

  await redis.set(
    `order:${clientOrderId}`,
    JSON.stringify({
      ...order,
      status: "completed",
      updatedAt: completedAt,
    })
  );

  await redis.del(`claim:${clientOrderId}`);

  console.log(`Processed order ${clientOrderId}`);
}

// Connect Redis and continuously consume jobs from the shared queue.
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
