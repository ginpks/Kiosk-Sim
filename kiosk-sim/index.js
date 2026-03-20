const apiBaseUrl = process.env.KIOSK_SIM_API_BASE_URL || "http://api:3000";
const kiosks = Number(process.env.KIOSK_SIM_KIOSKS || 1);
const kioskPrefix = process.env.KIOSK_SIM_KIOSK_PREFIX || "kiosk";
const intervalMs = Number(process.env.KIOSK_SIM_INTERVAL_MS || 1000);
const retryRate = Number(process.env.KIOSK_SIM_RETRY_RATE || 0.2);

const menuItems = ["coffee", "tea", "muffin", "bagel", "sandwich"];

console.log(
  `Kiosk simulator started. api=${apiBaseUrl} kiosks=${kiosks} prefix=${kioskPrefix} intervalMs=${intervalMs} retryRate=${retryRate}`
);

for (let index = 1; index <= kiosks; index += 1) {
  const kioskId = `${kioskPrefix}-${index}`;
  let sequence = 0;
  const previousOrders = [];

  console.log(`[${kioskId}] simulator loop started`);

  async function submitOrder() {
    const shouldRetry =
      previousOrders.length > 0 && Math.random() < retryRate;

    let order;

    if (shouldRetry) {
      order =
        previousOrders[Math.floor(Math.random() * previousOrders.length)];
    } else {
      sequence += 1;
      order = {
        kioskId,
        clientOrderId: `${kioskId}-${Date.now()}-${sequence}`,
        item: menuItems[Math.floor(Math.random() * menuItems.length)],
        quantity: Math.floor(Math.random() * 3) + 1,
      };

      previousOrders.push(order);

      if (previousOrders.length > 25) {
        previousOrders.shift();
      }
    }

    console.log(
      `[${kioskId}] submitting ${shouldRetry ? "retry" : "new"} order ${order.clientOrderId}`
    );

    try {
      const response = await fetch(`${apiBaseUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(order),
      });

      console.log(
        `[${kioskId}] response ${response.status} for ${order.clientOrderId}`
      );
    } catch (error) {
      console.error(
        `[${kioskId}] request failed for ${order.clientOrderId}: ${error.message}`
      );
    }
  }

  void submitOrder();

  setInterval(() => {
    void submitOrder();
  }, intervalMs);
}

