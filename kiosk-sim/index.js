const apiBaseUrl = process.env.KIOSK_SIM_API_BASE_URL || "http://api:3000";
const kiosks = Number(process.env.KIOSK_SIM_KIOSKS || 1);
const intervalMs = Number(process.env.KIOSK_SIM_INTERVAL_MS || 1000);

console.log(
  `Kiosk simulator started. api=${apiBaseUrl} kiosks=${kiosks} intervalMs=${intervalMs}`
);

setInterval(() => {
  console.log("Kiosk simulator heartbeat");
}, 30000);
