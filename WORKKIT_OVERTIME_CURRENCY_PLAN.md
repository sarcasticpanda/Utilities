# WorkKit overtime currency conversion

## Implementation

- [x] Preserve the calculated pay in the entered source currency.
- [x] Add a separate “View this estimate in” currency control and converted result.
- [x] Use Frankfurter's public v2 single-pair daily rate endpoint; cache each pair only in page memory and show the rate date and source.
- [x] Send only source and target currency codes; calculate and format the pay locally.
- [x] Add same-currency behavior, explicit refresh and a graceful unavailable-rate message.
- [x] Disclose the rate request in WorkKit privacy copy; clarify that this is a daily reference estimate, not a real-time bank, cash or payroll rate.

## Browser acceptance checks

- [x] Confirm the overtime estimate is unchanged by conversion and converted value matches the mocked rate.
- [x] Confirm same-currency selection skips the network request.
- [x] Confirm another currency pair works and refresh performs a new GET.
- [x] Confirm request URLs contain only the currency pair and never hours, pay or hourly rate.
- [x] Confirm the production rate service is reachable from the deployed Cloudflare Pages origin; live browser check returned a dated USD→INR rate and confirmed calculated pay stayed intact.
- [ ] Exercise unavailable-rate recovery against an intentionally failing API in a separate browser check.

The reference API uses daily mid-market observations, not intraday payroll or transaction quotes. Frankfurter's official docs state that its rates update daily, expose a no-key `/v2/rate/{base}/{quote}` endpoint, and are not intended for live trading. See [Frankfurter API documentation](https://frankfurter.dev/) and [ECB reference-rate framework](https://www.ecb.europa.eu/stats/pdf/exchange/Frameworkfortheeuroforeignexchangereferencerates.en.pdf).
