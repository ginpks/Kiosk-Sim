# brief.md

**Name:** Gin Park\
**Email:** gspark@umass.edu\
**Spire ID:** 33800512

------------------------------------------------------------------------

## How to Run / Test the Project

1.  Start Docker Desktop.

2.  Run the following command to build and start all services:

    ``` bash
    docker compose up -d --build
    ```

3.  Open your browser:

    -   Submit an order ([screenshot of kiosk page](shots\kiosk-page.png)):\
        http://localhost:3000/
    -   View monitoring dashboard ([screenshot of dashboard page](shots\dashboard.png)):\
        http://localhost:3000/dashboard.html

------------------------------------------------------------------------

## Architecture

This project is a small **distributed order-processing system** built
using four Docker services:

-   **API**
-   **Worker**
-   **Kiosk Simulator**
-   **Redis**

### Main Flow

1.  The kiosk page or simulator submits an order to the API.
2.  The API:
    -   Stores the order in Redis using: `order:<clientOrderId>`
    -   Pushes a job into the `jobs` queue.
3.  The [worker](shots\worker-logs.png):
    -   Pops jobs from the `jobs` queue.
    -   Processes them.
    -   Updates the order status in Redis.
4.  The dashboard:
    -   Reads recent orders from the API.
    -   Displays queue activity and status changes over time.

------------------------------------------------------------------------

## Kiosk Simulator

The [`kiosk-sim`](shots\kiosk-sim-logs.png) service simulates multiple kiosks submitting orders.

Each simulated kiosk: - Periodically submits new orders. - Occasionally
retries a previous order using the same `clientOrderId` to test
duplicate handling.

### Environment Variables

-   **KIOSK_SIM_API_BASE_URL**\
    Base URL of the API to send orders to.

-   **KIOSK_SIM_KIOSKS**\
    Number of concurrent simulated kiosks.

-   **KIOSK_SIM_INTERVAL_MS**\
    Time interval between order submissions per kiosk.

-   **KIOSK_SIM_RETRY_RATE**\
    Probability of retrying an existing order instead of creating a new
    one.

------------------------------------------------------------------------

## Idempotency Strategy

The system ensures idempotency by treating `clientOrderId` as the unique
identifier of a logical order.

-   Each new order gets a unique `clientOrderId`.
-   Retries reuse the same `clientOrderId`.

### Implementation Details

-   Orders are stored in Redis as: `order:<clientOrderId>`

-   Duplicate submissions are detected by checking this key.

-   The API uses a short-lived Redis **claim key**: `SET NX EX` to
    prevent concurrent duplicate processing.

-   If an order is already completed:

    -   Retry attempts update [metadata](shots\duplicate-handling.png) (e.g., attempt count).
    -   The job is **not re-queued**.

------------------------------------------------------------------------

## AI Usage

The following components were generated or assisted using AI (Codex):

-   Dockerfiles for each service

-   `docker-compose.yml`

-   Static kiosk HTML page (served via Express)

-   Dashboard HTML page

-   API endpoint: `/dashboard/orders` which retrieves recent orders from
    Redis

-   Explanations for Redis functions:

    -   `redis.LRem()`
    -   `redis.mGet()`
    -   `redis.LRange()`
