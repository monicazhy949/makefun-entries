// The radar's valuation model and farm plans: one sealed snapshot in, one ranked board out.
//
// The board ranks protocols that record no token. The watchlist is the floor: every one of its
// slugs is ranked. Below the floor, the early radar ranks every pre-token protocol the watchlist's
// own rule would keep (not a wrapped, staked or bridged product, not an exchange, not a versioned
// pool). A protocol at or above the floor that the watchlist left out is never ranked: the house's
// rule left it out because it is a product of a token that already trades.
//
// Implied value is calibrated, not assumed. The market multiple is the median market-cap-to-TVL
// ratio the market actually pays the snapshot's own live-token protocols, so the model prices a
// pre-token protocol the way the market prices live ones:
//
//   multiple   = median(mcap_usd / tvl_usd) over live-token protocols, clamped to [0.05, 2.00]
//   growth     = 1 + clamp(change_7d, -60, 120) / 100 * 0.5
//   maturity   = 0.6 + min(age_days, 1095) / 1095 * 0.4   (age unknown: 365 days)
//   implied    = max(1, round(tvl_usd * multiple * growth * maturity))
//
// No protocol name is ever special-cased: one function scores every row, and the dashboard's page
// recomputes every row from the same figures.

/** One protocol entry of the sealed snapshot: exactly its ten fields. */
export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

/** The model's parameters: the calibrated multiple plus the fixed curve constants. */
export interface ModelParams {
  multiple: number;
  comparables: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
}

/** The fixed constants of the growth and maturity curves. */
export const CURVE = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
} as const;

/** The multiple's clamp: the market's median is trusted only inside this band. */
export const MULTIPLE_FLOOR = 0.05;
export const MULTIPLE_CAP = 2.0;

/** The model's version label, shown on the dashboard. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the dashboard's Live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One farm step: what to do, what it costs, how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** A board row's compact form for data.js; the page derives the farm plan from it. */
export interface DashboardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
}

/** A live-token protocol for the dashboard's Live view: the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard renders. */
export interface DashboardData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelParams;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: DashboardRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Whole days from `listedAt` to `asOf`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The market multiple: the median market-cap-to-TVL ratio across the snapshot's live-token
 * protocols with at least $5M of TVL, exchanges left out (an exchange's TVL is custody, not a
 * protocol's value). Clamped to [MULTIPLE_FLOOR, MULTIPLE_CAP] and rounded to four decimals so
 * the dashboard states exactly the number the model used.
 */
export function marketMultiple(snapshot: Snapshot): { multiple: number; comparables: number } {
  const ratios = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd >= 5_000_000 && p.category !== 'CEX')
    .map((p) => (p.mcap_usd as number) / p.tvl_usd)
    .sort((a, b) => a - b);
  if (ratios.length === 0) return { multiple: 0.25, comparables: 0 };
  const median = ratios.length % 2 === 1
    ? ratios[(ratios.length - 1) / 2]!
    : (ratios[ratios.length / 2 - 1]! + ratios[ratios.length / 2]!) / 2;
  return { multiple: round4(Math.min(MULTIPLE_CAP, Math.max(MULTIPLE_FLOOR, median))), comparables: ratios.length };
}

/** The full parameter set for one snapshot: the calibrated multiple plus the fixed curves. */
export function calibrate(snapshot: Snapshot): ModelParams {
  const { multiple, comparables } = marketMultiple(snapshot);
  return { multiple, comparables, ...CURVE };
}

/** The implied value one protocol gets, with every multiplier shown. */
export function impliedValue(
  p: Protocol,
  asOf: string,
  params: ModelParams,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, p.listed_at);
  const growthPct = Math.min(params.growth_cap, Math.max(params.growth_floor, finite(p.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * params.growth_weight;
  const ageForModel = age ?? params.unknown_age_days;
  const maturityMult =
    params.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), params.maturity_days) / params.maturity_days) * params.maturity_range;
  const implied = Math.max(1, Math.round(p.tvl_usd * params.multiple * growthMult * maturityMult));
  return { implied, growthPct, growthMult, maturityMult, age };
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: Protocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Categories the watchlist's rule treats as products of a token that already trades. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Exchange names: a protocol beginning with one is the exchange's own product. */
const EXCHANGES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** A name ending in a version marker is a pool of another protocol, not a protocol of its own. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name carrying a whole word wrapped, staked or staking names a wrapped or staked product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/**
 * Whether a pre-token protocol is one the board may rank: the watchlist's own rule, applied
 * below the floor. The watchlist itself is the floor and is always ranked whole.
 */
export function passesHouseRule(p: Protocol): boolean {
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGES.some((e) => p.name.startsWith(e))) return false;
  return true;
}

/** The protocols the board ranks: the watchlist whole, plus the early radar below the floor. */
export function selectBoard(snapshot: Snapshot): Protocol[] {
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, Protocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (chosen.has(p.slug)) continue;
    if (p.tvl_usd >= snapshot.floor_usd) continue;
    if (!isPreToken(p) || !passesHouseRule(p)) continue;
    chosen.set(p.slug, p);
  }
  return [...chosen.values()];
}

/** The ranked board: every selected protocol scored, strongest implied value first, ranks 1..N. */
export function buildBoard(snapshot: Snapshot, params: ModelParams): BoardRow[] {
  const scored = selectBoard(snapshot).map((p) => {
    const v = impliedValue(p, snapshot.as_of, params);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      multiple: params.multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmPlan(s.p, s.age).map(stepText),
  }));
}

/** The live-token protocols for the dashboard's Live view, by market cap. */
export function liveSet(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

// ---------------------------------------------------------------- farm plans

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: Protocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: Protocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 10_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols need a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 90;
  if (age < 365) return 60;
  return 30;
}

/** Gas for one transaction on a chain: mainnet is dear, Solana is near-free, the rest sit between. */
function gasFor(chain: string): { once: string; weekly: string } {
  if (chain === 'Ethereum') return { once: 'about $12 of gas', weekly: 'about $8 of gas a week' };
  if (chain === 'Solana') return { once: 'under $0.10 of gas', weekly: 'under $0.10 of gas a week' };
  return { once: 'about $3 of gas', weekly: 'about $2 of gas a week' };
}

/**
 * The category's action, as a data table, not a list of names: the first keyword that matches the
 * category decides what a farmer does. Every template names the protocol, the capital and the chain.
 */
type Action = (name: string, capital: number, chain: string) => string;

const ACTIONS: [string[], Action][] = [
  [['lend', 'cdp', 'collateral'], (n, c, ch) => `Supply $${c} of USDC on ${n} on ${ch}, then borrow $${Math.floor(c / 2)} of USDC against it at under 50% loan-to-value and leave both legs open.`],
  [['dex'], (n, c, ch) => `Add $${c} of liquidity to ${n}'s deepest pool on ${ch} in a 50/50 pair, then swap $10 through the pool once to register activity.`],
  [['yield', 'farm'], (n, c, ch) => `Deposit $${c} into ${n}'s highest-TVL vault on ${ch}, hold the receipt tokens, and note the vault's deposit fee.`],
  [['bridge'], (n, c, ch) => `Bridge $${c} of USDC through ${n} onto ${ch}, then use half of it in one app on ${ch}.`],
  [['staking', 'restak'], (n, c, ch) => `Stake $${c} of the native asset through ${n} on ${ch}, keep the receipt token, and delegate to an active validator.`],
  [['perpetual', 'derivative'], (n, c, ch) => `Post $${c} of USDC as margin on ${n}, open one small long and one small short to stay delta-neutral, and set a stop at 5%.`],
  [['prediction'], (n, c, ch) => `Fund ${n} with $${c} and take one small position in an open market, sized under 10% of the deposit.`],
  [['curator', 'allocator'], (n, c, ch) => `Deposit $${c} into a ${n} curator vault on ${ch}, hold the shares, and check the curator's allocation each week.`],
  [['stable', 'algo-stables', 'dual-token'], (n, c, ch) => `Mint or hold $${c} of ${n}'s stable asset on ${ch} and supply half of it to its savings pool.`],
  [['rwa'], (n, c, ch) => `Mint $${c} of ${n}'s tokenised asset on ${ch}, hold it, and read the asset's redemption terms first.`],
  [['insurance'], (n, c, ch) => `Buy $${c} of cover from ${n} on ${ch} for a 30-day term and keep the policy live.`],
  [['basis'], (n, c, ch) => `Deposit $${c} into ${n}'s basis vault on ${ch} and hold the position through one full funding cycle.`],
  [['launchpad'], (n, c, ch) => `Stake or hold $${c} through ${n} to qualify for its next launch allocation and register for the next sale.`],
  [['liquidity manager'], (n, c, ch) => `Deposit $${c} into a ${n}-managed pool on ${ch} and leave the range managed for the full hold.`],
  [['index'], (n, c, ch) => `Buy $${c} of ${n}'s index token on ${ch}, hold it, and note the index's next rebalance date.`],
  [['payment'], (n, c, ch) => `Route $${c} of payments through ${n} on ${ch} across the month in at least four separate payments.`],
  [['nft'], (n, c, ch) => `List or buy one item on ${n} with $${c} of funds on ${ch} and complete one sale or purchase.`],
  [['locker'], (n, c, ch) => `Lock $${c} of tokens through ${n} on ${ch} for the stated term and note the unlock date.`],
  [['governance'], (n, c, ch) => `Deposit $${c} and vote once on ${n}'s current proposal, then delegate the remainder.`],
  [['ai agent', 'decentralized ai'], (n, c, ch) => `Fund ${n} with $${c} on ${ch}, run one agent task, and keep the task receipt.`],
  [['privacy'], (n, c, ch) => `Shield $${c} through ${n} on ${ch}, keep the note safe, and unshield $10 once to prove the flow works.`],
  [['option'], (n, c, ch) => `Buy one ${n} option with $${c} of premium on ${ch} and hold it to expiry or a 2x move.`],
  [['synthetic'], (n, c, ch) => `Mint $${c} of ${n}'s synthetic asset on ${ch} at 150% collateral and hold it.`],
  [['interest rate'], (n, c, ch) => `Deposit $${c} into ${n}'s rate market on ${ch} and fix the rate for one term.`],
  [['reserve currency'], (n, c, ch) => `Bond $${c} through ${n} on ${ch} and hold the receipt to vesting.`],
  [['btc'], (n, c, ch) => `Deposit $${c} of BTC exposure through ${n} on ${ch} and hold the receipt token.`],
  [['cedefi'], (n, c, ch) => `Deposit $${c} into ${n}'s managed account on ${ch} and read its withdrawal terms first.`],
  [['card'], (n, c, ch) => `Load $${c} onto a ${n} card and spend it in at least four purchases through the month.`],
  [['otc'], (n, c, ch) => `Place one $${c} order on ${n}'s OTC desk on ${ch} and settle it in full.`],
  [['dor'], (n, c, ch) => `Deposit $${c} into ${n}'s rate vault on ${ch} and hold for one rate period.`],
  [['wrapper'], (n, c, ch) => `Wrap $${c} through ${n} on ${ch}, hold the wrapped asset, and unwrap $10 once to test redemption.`],
  [['chain'], (n, c, ch) => `Bridge $${c} to ${n}'s chain, use one of its apps, and leave a small balance for gas.`],
];

/** The category's action: the first table row whose keyword the category carries, else the default. */
function actionFor(p: Protocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  for (const [keywords, fn] of ACTIONS) {
    if (keywords.some((k) => c.includes(k))) return fn(p.name, capital, chain);
  }
  return `Deposit $${capital} of USDC into ${p.name} on ${chain} and keep the position open.`;
}

/** The weekly qualifying action, by category keyword: one concrete repeat action per category. */
const WEEKLY: [string[], string][] = [
  [['lend', 'cdp', 'collateral'], 'Borrow $20 against the deposit and repay it the same week; keep the loan under 50% of the deposit.'],
  [['dex'], 'Swap $10 through the pool once and add $5 of liquidity.'],
  [['yield', 'farm'], "Harvest and re-deposit the week's yield once."],
  [['bridge'], 'Bridge $10 back or to a second chain once.'],
  [['staking', 'restak'], "Claim the week's staking rewards once and restake half."],
  [['perpetual', 'derivative'], 'Close and reopen the hedge once; keep the position delta-neutral.'],
  [['prediction'], 'Take one new small market position, under $10.'],
  [['curator', 'allocator'], "Rebalance into the vault's newest allocation once."],
  [['stable', 'rwa'], 'Mint or redeem $10 of the asset once.'],
  [['basis'], 'Check the funding rate and top up $10 if the vault is below its target.'],
  [['insurance'], 'Check the policy is live, and renew it if it lapses within 7 days.'],
  [['index'], 'Check the index rebalance and hold through it.'],
  [['payment'], 'Make one more payment through the app, at least $10.'],
  [['governance'], 'Vote on any new proposal, or delegate the vote.'],
  [['card'], 'Spend at least $10 on the card this week.'],
  [['liquidity manager'], 'Check the managed range is still in range; leave it alone if it is.'],
  [['btc'], 'Check the BTC peg and hold; unwrap $10 once a month to test redemption.'],
  [['cedefi'], 'Check the account statement and withdraw $10 once to test the exit.'],
  [['chain'], 'Use one app on the chain and keep a gas balance.'],
];

function weeklyFor(p: Protocol): string {
  const c = (p.category ?? '').toLowerCase();
  for (const [keywords, text] of WEEKLY) {
    if (keywords.some((k) => c.includes(k))) return text;
  }
  return 'Make one qualifying action: a deposit, a swap, a vote or a claim.';
}

/** Gas to keep aside for a farm's setup, by chain: mainnet is dear, Solana is near-free. */
function gasBufferFor(chain: string): number {
  if (chain === 'Ethereum') return 25;
  if (chain === 'Solana') return 1;
  return 10;
}

/**
 * The category's main risk, as a data table, not a list of names: the first keyword that matches
 * the category decides what can go wrong. The stable-asset risk is priced on the position's size.
 */
type Risk = (capital: number) => string;

const RISKS: [string[], Risk][] = [
  [['lend', 'cdp', 'collateral'], () => 'a falling market can liquidate a borrow; keep the loan under 50% of the deposit'],
  [['dex'], () => 'impermanent loss if the pair moves sharply: a 2x move costs about 6% of the position'],
  [['yield', 'farm'], () => "vault yields fall as deposits rise, and a vault's strategy can change without notice"],
  [['bridge'], () => 'a bridge holds your funds in transit: a bridge exploit can strand them'],
  [['staking', 'restak'], () => 'unstaking takes days, so the position cannot exit in a crash'],
  [['perpetual', 'derivative'], () => 'leverage cuts both ways: a 5% move against a 10x position liquidates it'],
  [['prediction'], () => 'a market can resolve against you and the stake is lost'],
  [['curator', 'allocator'], () => "the curator's allocation can change, and a bad allocation loses principal"],
  [['stable'], (c) => `a stable asset can depeg: a 2% depeg costs about $${Math.max(1, Math.round(c * 0.02))} on this position`],
  [['rwa'], () => 'tokenised real-world assets can freeze redemptions; read the redemption terms first'],
  [['insurance'], () => 'cover pays only on the stated event; read what the policy excludes'],
  [['basis'], () => 'a basis trade loses if funding flips negative for a long stretch'],
  [['launchpad'], () => 'an allocation is not guaranteed, and a launch can fall below its sale price'],
  [['liquidity manager'], () => 'a managed range can drift out of range and stop earning fees'],
  [['index'], () => 'an index falls with its whole basket; there is no single asset to exit'],
  [['payment'], () => 'a payment rail can freeze funds; keep the balance small'],
  [['nft'], () => 'an NFT can be illiquid; a listing may not sell at all'],
  [['locker'], () => 'locked tokens cannot be sold until the unlock date'],
  [['governance'], () => 'a vote locks the deposit until the proposal closes'],
  [['ai agent', 'decentralized ai'], () => 'an agent can spend its budget on a failed task; cap the spend per task'],
  [['privacy'], () => 'losing the shielding note loses the funds; there is no recovery'],
  [['option'], () => 'an option can expire worthless; the premium is the maximum loss'],
  [['synthetic'], () => 'a synthetic asset liquidates if its collateral ratio falls below the minimum'],
  [['interest rate'], () => 'a fixed rate locks the deposit until the term ends'],
  [['reserve currency'], () => 'a bond vests over time; exiting early forfeits part of it'],
  [['btc'], () => 'a BTC wrapper can depeg from BTC; check the peg every week'],
  [['cedefi'], () => 'a managed account is custodial; a withdrawal freeze strands the funds'],
  [['card'], () => 'card funds sit with the issuer; a frozen card strands the balance'],
  [['otc'], () => 'an OTC order can fail to settle; use escrow where the desk offers it'],
  [['dor'], () => "a rate vault's yield can fall to zero if rates move"],
  [['wrapper'], () => 'a wrapped asset depends on its custodian; check the backing every week'],
  [['chain'], () => 'a new chain can halt; keep a gas balance on a second chain'],
];

/** The category's main risk: the first table row whose keyword the category carries, else the default. */
function riskFor(p: Protocol, capital: number): string {
  const c = (p.category ?? '').toLowerCase();
  for (const [keywords, fn] of RISKS) {
    if (keywords.some((k) => c.includes(k))) return fn(capital);
  }
  return 'smart contracts can fail; never farm with money you cannot afford to lose';
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time, ending with the
 * category's main risk. Everything is derived from the protocol's own record (category, chains,
 * TVL, age), never from a hand-written list: the wallet is funded with the capital plus a gas
 * buffer, the hold carries two check-in days, and the risk names what can go wrong for this kind
 * of protocol.
 */
export function farmPlan(p: Protocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  const buffer = gasBufferFor(chain);
  const secondChain = p.chains.length > 1 ? p.chains[1]! : null;
  const check1 = Math.max(1, Math.floor(hold / 3));
  const check2 = Math.max(check1 + 1, Math.floor((2 * hold) / 3));
  return [
    {
      text: `Create a fresh wallet for this farm only, fund it with $${capital + buffer} in total ($${capital} of capital plus about $${buffer} for gas), and store its seed phrase offline.`,
      cost: `$${capital + buffer} to fund the wallet`,
      time: '15 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and ${gas.once}`,
      time: '15 minutes to set up',
    },
    {
      text: weeklyFor(p),
      cost: gas.weekly,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot. Check in on day ${check1} and day ${check2}: confirm the position is still open and the protocol's TVL has not fallen 30%.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    secondChain === null
      ? {
          text: `Deepen the position after two weeks: add $50 more on ${chain} and log the new entry with its date and transaction hash.`,
          cost: '$50 of capital and ' + gas.once,
          time: '10 minutes',
        }
      : {
          text: `Open the same position on ${secondChain} with $${Math.max(25, Math.floor(capital / 2))} so the activity spans two chains, and bridge the funds in one transaction.`,
          cost: `$${Math.max(25, Math.floor(capital / 2))} of capital and about $3 of gas`,
          time: '15 minutes',
        },
    {
      text: `Risk: ${riskFor(p, capital)}. Each week, open ${p.name}'s own points or rewards page and claim only from the link it publishes; if its TVL falls 30% in a week, unwind the position. Write every transaction in a farm log.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes a week',
    },
  ];
}

// ---------------------------------------------------------------- validation, parsing, data

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared value, steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  for (const r of board) {
    if (!known.has(r.slug)) return `${r.slug} is not one of the snapshot's protocols`;
    if (r.name.length === 0) return `${r.slug} has an empty name`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
  }
  return null;
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** A board row's compact form for data.js. */
function dashboardRow(row: BoardRow): DashboardRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot and the board. */
export function dashboardData(snapshot: Snapshot, params: ModelParams, board: BoardRow[]): DashboardData {
  const live = liveSet(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  return {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: params,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(dashboardRow),
    live,
  };
}

/** data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(data: DashboardData): string {
  return `window.RADAR=${JSON.stringify(data)};\n`;
}
