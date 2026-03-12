const redisUrl = process.env.REDIS_URL || "redis://redis:6379";

console.log(`Worker container started. Redis URL: ${redisUrl}`);

setInterval(() => {
  console.log("Worker heartbeat");
}, 30000);
