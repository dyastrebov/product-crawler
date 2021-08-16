# Prerequisites

-   NodeJS
-   Docker & docker-compose

# Running using Docker

-   run `npm run docker-build` to build the image
-   run `npm run docker-start` to start the service
-   Open http://localhost:5677/swagger/ to try out API
-   Open http://localhost:5677/ to test using some sample UI

Note: when started with no data, crawling begins automatically. Next runs happen as scheduled (see `server/crawlers/index.ts`), or when triggered manually through UI.

Crawling of https://www.makitatools.com/, https://www.asus.com/us/ and https://www.samsung.com/us/ is included.

# Adding a crawler

1. Create a runnable module in `server/crawlers` folder.
2. Implement crawling logic; save the results using `updateProducts()` API (see `server/crawlers/base/tools.ts`).
3. Implement `fetchDetails()` API (can be done in the same or a separate module)
4. Register the module(s) in `server/crawlers/index.ts` (could be a JSON file as well)

# Running on the host environment

-   `npm install && npm run build`
-   `npm start`

# Known issues


-   Crawlers need more stability against random network errors - currently they have to cancel the work, if (for example) a temporary request timeout occurs. However, this state is recoverable - the job can be completed (and all data corrected) after the next scheduled run.

-   'fetchDetails' is executed in the same process as the main APIs. While this should not be a problem to performance (neither from CPU nor RAM perspective; at least, in the scope of this example and all its potential uses), it may be dangerous in terms of security and stability (especially if the crawlers want to run sites JS to emulate user's behavior). Moving 'fetchDetails' to a separate process should not be a problem, but it's not clear how valuable it would be in terms of evaluating this sample.
