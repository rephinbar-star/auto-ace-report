# Promote MarketCheck + VinAudit to primary pricing sources

## Goal

Replace the current 2-source pricing chain (auto.dev + VehicleDatabases) with a stronger 4-source weighted aggregation that leads with **MarketCheck** and **VinAudit**, keeps **auto.dev** as a corroborator, and demotes **VehicleDatabases** to a low-weight tiebreaker (or removes it entirely after observation).

The same upgrade extends to non-pricing vehicle data: VinAudit provides VIN specs, history flags, and market value in one call; MarketCheck provides listing context, dealer info, and market days-on-lot.

## Sources & roles after the change

| Source | Role | Reliability weight | Data provided |
|---|---|---|---|
| **MarketCheck** | Primary — live market | 0.65 | Active + sold listings, median price, days-on-market, dealer type |
| **VinAudit** | Primary — book + comparable sales | 0.60 | Market value (low/avg/high), VIN specs, title flags, ownership history hints |
| **auto.dev** | Corroborator — active listings | 0.45 | Active dealer listing prices |
| **VehicleDatabases** | Tiebreaker only | 0.20 | Book values (kept temporarily; will remove after 2-week observation if outlier rate stays high) |

Outputs unchanged: `fairMarketPrivate`, `fairMarketDealer`, `fairMarketTradeIn` — but derived from a stronger weighted aggregation.

## Required user action

VinAudit is not currently integrated. The user needs to:
1. Sign up at vinaudit.com (self-serve, instant)
2. Provide the API key — I'll request it via the secrets tool (`VINAUDIT_API_KEY`)

MarketCheck is already configured (`MARKETCHECK_API_KEY`); no new signup needed.

## Implementation steps

### 1. Add VinAudit secret
Request `VINAUDIT_API_KEY` via the secrets tool. Halt until provided.

### 2. New source modules in `lookup-pricing/index.ts`

**`tryMarketCheck(vin, mileage)`** — Re-enable pricing path:
- Call `/v2/search/car/active?vins={vin}` for active listings → median price, count, dealer type
- Call `/v2/search/car/sold?vins={vin}` for sold comps (last 90 days) → median sold price
- Derive: dealerRetail = active median; privateParty = sold median × 0.91; tradeIn = sold median × 0.83
- Keep the existing dealer-type detection inline (one combined call instead of two)

**`tryVinAudit(vin, mileage)`** — New module:
- Endpoint: `https://marketvalue.vinaudit.com/getmarketvalue.php?vin={vin}&mileage={mileage}&format=json&period=90`
- Returns `prices.mean`, `prices.below` (low), `prices.above` (high), `prices.stdev`, `count`
- Map: privateParty = mean; tradeIn = mean × 0.85; dealerRetail = mean × 1.10
- Return `count` as confidence signal (more comps = higher confidence weight)

### 3. Update aggregation weights

In `SOURCE_RELIABILITY`:
```
"MarketCheck":      { tradeIn: 0.65, privateParty: 0.65, dealerRetail: 0.65 }
"VinAudit":         { tradeIn: 0.60, privateParty: 0.60, dealerRetail: 0.60 }
"auto.dev":         { tradeIn: 0.45, privateParty: 0.45, dealerRetail: 0.45 }
"VehicleDatabases": { tradeIn: 0.20, privateParty: 0.20, dealerRetail: 0.20 }
```

The lower VehicleDatabases weight ensures it can't drag FMV down when other sources disagree (the CTS-V failure mode). Outlier detection (>15% from median) already halves contribution further.

### 4. Sanity gate stays
The 35% asking-price floor stays as a final safety net.

### 5. Trim guard expansion
Performance-trim refusal (currently only on VehicleDatabases) extends to VinAudit if the response includes a trim field that mismatches.

### 6. Logging & observability
Add per-source log lines: which sources returned, their values, the final weighted result, and outlier flags. This will let us decide in 2 weeks whether to drop VehicleDatabases entirely.

### 7. VIN spec enrichment (separate but related)
In `decode-vin-specs/index.ts`, add VinAudit as a fallback after NHTSA VPIC — VinAudit returns trim, engine, transmission, and drivetrain that NHTSA often misses. Respect the existing make-mismatch guard.

## Out of scope (this plan)

- Removing VehicleDatabases entirely — deferred until we have 2 weeks of comparison data
- UI changes — the report already renders whatever `sourceBreakdown` contains, so new sources appear automatically
- MarketCheck quota management — needs monitoring after pricing is re-enabled (roughly 2× current call volume per report)

## Risk & cost notes

- **MarketCheck quota**: pricing path adds ~1 extra call per report on top of dealer detection. If your plan caps at 10K/month, monitor usage.
- **VinAudit cost**: ~$0.05–$0.10 per VIN lookup (pay-as-you-go). For 1,000 reports/month → ~$50–$100/month.
- **Latency**: All four sources fire in parallel via `Promise.all`, so total wall-clock time stays roughly the same as today.
