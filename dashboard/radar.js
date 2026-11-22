// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable and sortable table, a per-protocol detail drawer with
// the model's own inputs and the protocol's farm plan, and the live-token view set apart. No
// network: every byte it shows is in data.js. The page recomputes each row's implied value from
// the snapshot figures and derives each farm plan from the row's own record, so the page's code
// and the board's data are visibly the same arithmetic.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var app = document.getElementById('board');
  if (!DATA) {
    app.textContent = 'Token Radar needs its data file beside this page.';
    return;
  }
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries. The multiple is the one main.ts calibrated from the snapshot's own
  // live-token protocols; the growth and maturity curves are the model's fixed constants.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * model.multiple * growthMult * maturity));
  }

  // A row is on the watchlist exactly when its TVL meets the floor: the board holds the watchlist
  // whole (every row at or above the floor) and the early radar below it, so the floor divides them.
  function onWatchlist(row) { return row.tvl_usd >= DATA.floor_usd; }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // ---------------------------------------------------------------- farm plans
  // The same derivation main.ts writes to board.json: category, chains, TVL and age decide the
  // action, the capital, the hold and every cost and time. No name is special-cased.

  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 1e9) return 250;
    if (p.tvl_usd >= 1e8) return 150;
    if (p.tvl_usd >= 1e7) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 45;
    if (age < 180) return 90;
    if (age < 365) return 60;
    return 30;
  }
  function gasFor(chain) {
    if (chain === 'Ethereum') return { once: 'about $12 of gas', weekly: 'about $8 of gas a week' };
    if (chain === 'Solana') return { once: 'under $0.10 of gas', weekly: 'under $0.10 of gas a week' };
    return { once: 'about $3 of gas', weekly: 'about $2 of gas a week' };
  }

  var ACTIONS = [
    [['lend', 'cdp', 'collateral'], function (n, c, ch) { return 'Supply $' + c + ' of USDC on ' + n + ' on ' + ch + ', then borrow $' + Math.floor(c / 2) + ' of USDC against it at under 50% loan-to-value and leave both legs open.'; }],
    [['dex'], function (n, c, ch) { return "Add $" + c + " of liquidity to " + n + "'s deepest pool on " + ch + ' in a 50/50 pair, then swap $10 through the pool once to register activity.'; }],
    [['yield', 'farm'], function (n, c, ch) { return 'Deposit $' + c + " into " + n + "'s highest-TVL vault on " + ch + ", hold the receipt tokens, and note the vault's deposit fee."; }],
    [['bridge'], function (n, c, ch) { return 'Bridge $' + c + ' of USDC through ' + n + ' onto ' + ch + ', then use half of it in one app on ' + ch + '.'; }],
    [['staking', 'restak'], function (n, c, ch) { return 'Stake $' + c + ' of the native asset through ' + n + ' on ' + ch + ', keep the receipt token, and delegate to an active validator.'; }],
    [['perpetual', 'derivative'], function (n, c, ch) { return 'Post $' + c + ' of USDC as margin on ' + n + ', open one small long and one small short to stay delta-neutral, and set a stop at 5%.'; }],
    [['prediction'], function (n, c, ch) { return 'Fund ' + n + ' with $' + c + ' and take one small position in an open market, sized under 10% of the deposit.'; }],
    [['curator', 'allocator'], function (n, c, ch) { return 'Deposit $' + c + ' into a ' + n + ' curator vault on ' + ch + ", hold the shares, and check the curator's allocation each week."; }],
    [['stable', 'algo-stables', 'dual-token'], function (n, c, ch) { return 'Mint or hold $' + c + " of " + n + "'s stable asset on " + ch + ' and supply half of it to its savings pool.'; }],
    [['rwa'], function (n, c, ch) { return 'Mint $' + c + " of " + n + "'s tokenised asset on " + ch + ", hold it, and read the asset's redemption terms first."; }],
    [['insurance'], function (n, c, ch) { return 'Buy $' + c + ' of cover from ' + n + ' on ' + ch + ' for a 30-day term and keep the policy live.'; }],
    [['basis'], function (n, c, ch) { return 'Deposit $' + c + " into " + n + "'s basis vault on " + ch + ' and hold the position through one full funding cycle.'; }],
    [['launchpad'], function (n, c, ch) { return 'Stake or hold $' + c + ' through ' + n + ' to qualify for its next launch allocation and register for the next sale.'; }],
    [['liquidity manager'], function (n, c, ch) { return 'Deposit $' + c + ' into a ' + n + '-managed pool on ' + ch + ' and leave the range managed for the full hold.'; }],
    [['index'], function (n, c, ch) { return 'Buy $' + c + " of " + n + "'s index token on " + ch + ", hold it, and note the index's next rebalance date."; }],
    [['payment'], function (n, c, ch) { return 'Route $' + c + ' of payments through ' + n + ' on ' + ch + ' across the month in at least four separate payments.'; }],
    [['nft'], function (n, c, ch) { return 'List or buy one item on ' + n + ' with $' + c + ' of funds on ' + ch + ' and complete one sale or purchase.'; }],
    [['locker'], function (n, c, ch) { return 'Lock $' + c + ' of tokens through ' + n + ' on ' + ch + ' for the stated term and note the unlock date.'; }],
    [['governance'], function (n, c, ch) { return 'Deposit $' + c + " and vote once on " + n + "'s current proposal, then delegate the remainder."; }],
    [['ai agent', 'decentralized ai'], function (n, c, ch) { return 'Fund ' + n + ' with $' + c + ' on ' + ch + ', run one agent task, and keep the task receipt.'; }],
    [['privacy'], function (n, c, ch) { return 'Shield $' + c + ' through ' + n + ' on ' + ch + ', keep the note safe, and unshield $10 once to prove the flow works.'; }],
    [['option'], function (n, c, ch) { return 'Buy one ' + n + ' option with $' + c + ' of premium on ' + ch + ' and hold it to expiry or a 2x move.'; }],
    [['synthetic'], function (n, c, ch) { return 'Mint $' + c + " of " + n + "'s synthetic asset on " + ch + ' at 150% collateral and hold it.'; }],
    [['interest rate'], function (n, c, ch) { return 'Deposit $' + c + " into " + n + "'s rate market on " + ch + ' and fix the rate for one term.'; }],
    [['reserve currency'], function (n, c, ch) { return 'Bond $' + c + ' through ' + n + ' on ' + ch + ' and hold the receipt to vesting.'; }],
    [['btc'], function (n, c, ch) { return 'Deposit $' + c + ' of BTC exposure through ' + n + ' on ' + ch + ' and hold the receipt token.'; }],
    [['cedefi'], function (n, c, ch) { return 'Deposit $' + c + " into " + n + "'s managed account on " + ch + ' and read its withdrawal terms first.'; }],
    [['card'], function (n, c, ch) { return 'Load $' + c + ' onto a ' + n + ' card and spend it in at least four purchases through the month.'; }],
    [['otc'], function (n, c, ch) { return 'Place one $' + c + " order on " + n + "'s OTC desk on " + ch + ' and settle it in full.'; }],
    [['dor'], function (n, c, ch) { return 'Deposit $' + c + " into " + n + "'s rate vault on " + ch + ' and hold for one rate period.'; }],
    [['wrapper'], function (n, c, ch) { return 'Wrap $' + c + ' through ' + n + ' on ' + ch + ', hold the wrapped asset, and unwrap $10 once to test redemption.'; }],
    [['chain'], function (n, c, ch) { return 'Bridge $' + c + " to " + n + "'s chain, use one of its apps, and leave a small balance for gas."; }]
  ];
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    for (var i = 0; i < ACTIONS.length; i++) {
      var keywords = ACTIONS[i][0];
      for (var j = 0; j < keywords.length; j++) {
        if (c.indexOf(keywords[j]) >= 0) return ACTIONS[i][1](p.name, capital, chain);
      }
    }
    return 'Deposit $' + capital + ' of USDC into ' + p.name + ' on ' + chain + ' and keep the position open.';
  }

  var WEEKLY = [
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
    [['chain'], 'Use one app on the chain and keep a gas balance.']
  ];
  function weeklyFor(p) {
    var c = (p.category || '').toLowerCase();
    for (var i = 0; i < WEEKLY.length; i++) {
      var keywords = WEEKLY[i][0];
      for (var j = 0; j < keywords.length; j++) {
        if (c.indexOf(keywords[j]) >= 0) return WEEKLY[i][1];
      }
    }
    return 'Make one qualifying action: a deposit, a swap, a vote or a claim.';
  }

  function gasBufferFor(chain) {
    if (chain === 'Ethereum') return 25;
    if (chain === 'Solana') return 1;
    return 10;
  }

  var RISKS = [
    [['lend', 'cdp', 'collateral'], function () { return 'a falling market can liquidate a borrow; keep the loan under 50% of the deposit'; }],
    [['dex'], function () { return 'impermanent loss if the pair moves sharply: a 2x move costs about 6% of the position'; }],
    [['yield', 'farm'], function () { return "vault yields fall as deposits rise, and a vault's strategy can change without notice"; }],
    [['bridge'], function () { return 'a bridge holds your funds in transit: a bridge exploit can strand them'; }],
    [['staking', 'restak'], function () { return 'unstaking takes days, so the position cannot exit in a crash'; }],
    [['perpetual', 'derivative'], function () { return 'leverage cuts both ways: a 5% move against a 10x position liquidates it'; }],
    [['prediction'], function () { return 'a market can resolve against you and the stake is lost'; }],
    [['curator', 'allocator'], function () { return "the curator's allocation can change, and a bad allocation loses principal"; }],
    [['stable'], function (c) { return 'a stable asset can depeg: a 2% depeg costs about $' + Math.max(1, Math.round(c * 0.02)) + ' on this position'; }],
    [['rwa'], function () { return 'tokenised real-world assets can freeze redemptions; read the redemption terms first'; }],
    [['insurance'], function () { return 'cover pays only on the stated event; read what the policy excludes'; }],
    [['basis'], function () { return 'a basis trade loses if funding flips negative for a long stretch'; }],
    [['launchpad'], function () { return 'an allocation is not guaranteed, and a launch can fall below its sale price'; }],
    [['liquidity manager'], function () { return 'a managed range can drift out of range and stop earning fees'; }],
    [['index'], function () { return 'an index falls with its whole basket; there is no single asset to exit'; }],
    [['payment'], function () { return 'a payment rail can freeze funds; keep the balance small'; }],
    [['nft'], function () { return 'an NFT can be illiquid; a listing may not sell at all'; }],
    [['locker'], function () { return 'locked tokens cannot be sold until the unlock date'; }],
    [['governance'], function () { return 'a vote locks the deposit until the proposal closes'; }],
    [['ai agent', 'decentralized ai'], function () { return 'an agent can spend its budget on a failed task; cap the spend per task'; }],
    [['privacy'], function () { return 'losing the shielding note loses the funds; there is no recovery'; }],
    [['option'], function () { return 'an option can expire worthless; the premium is the maximum loss'; }],
    [['synthetic'], function () { return 'a synthetic asset liquidates if its collateral ratio falls below the minimum'; }],
    [['interest rate'], function () { return 'a fixed rate locks the deposit until the term ends'; }],
    [['reserve currency'], function () { return 'a bond vests over time; exiting early forfeits part of it'; }],
    [['btc'], function () { return 'a BTC wrapper can depeg from BTC; check the peg every week'; }],
    [['cedefi'], function () { return 'a managed account is custodial; a withdrawal freeze strands the funds'; }],
    [['card'], function () { return 'card funds sit with the issuer; a frozen card strands the balance'; }],
    [['otc'], function () { return 'an OTC order can fail to settle; use escrow where the desk offers it'; }],
    [['dor'], function () { return "a rate vault's yield can fall to zero if rates move"; }],
    [['wrapper'], function () { return 'a wrapped asset depends on its custodian; check the backing every week'; }],
    [['chain'], function () { return 'a new chain can halt; keep a gas balance on a second chain'; }]
  ];
  function riskFor(p, capital) {
    var c = (p.category || '').toLowerCase();
    for (var i = 0; i < RISKS.length; i++) {
      var keywords = RISKS[i][0];
      for (var j = 0; j < keywords.length; j++) {
        if (c.indexOf(keywords[j]) >= 0) return RISKS[i][1](capital);
      }
    }
    return 'smart contracts can fail; never farm with money you cannot afford to lose';
  }

  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }

  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasFor(chain);
    var buffer = gasBufferFor(chain);
    var secondChain = p.chains && p.chains.length > 1 ? p.chains[1] : null;
    var check1 = Math.max(1, Math.floor(hold / 3));
    var check2 = Math.max(check1 + 1, Math.floor((2 * hold) / 3));
    var second = secondChain === null
      ? { text: 'Deepen the position after two weeks: add $50 more on ' + chain + ' and log the new entry with its date and transaction hash.', cost: '$50 of capital and ' + gas.once, time: '10 minutes' }
      : { text: 'Open the same position on ' + secondChain + ' with $' + Math.max(25, Math.floor(capital / 2)) + ' so the activity spans two chains, and bridge the funds in one transaction.', cost: '$' + Math.max(25, Math.floor(capital / 2)) + ' of capital and about $3 of gas', time: '15 minutes' };
    return [
      { text: 'Create a fresh wallet for this farm only, fund it with $' + (capital + buffer) + ' in total ($' + capital + ' of capital plus about $' + buffer + ' for gas), and store its seed phrase offline.', cost: '$' + (capital + buffer) + ' to fund the wallet', time: '15 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and ' + gas.once, time: '15 minutes to set up' },
      { text: weeklyFor(p), cost: gas.weekly, time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot. Check in on day ' + check1 + ' and day ' + check2 + ": confirm the position is still open and the protocol's TVL has not fallen 30%.", cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      second,
      { text: 'Risk: ' + riskFor(p, capital) + ". Each week, open " + p.name + "'s own points or rewards page and claim only from the link it publishes; if its TVL falls 30% in a week, unwind the position. Write every transaction in a farm log.", cost: 'no fee to check, and never pay to claim', time: '10 minutes a week' }
    ].map(stepText);
  }

  // ---------------------------------------------------------------- state and filtering

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).some(function (c) { return c === state.chain; })) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  // ---------------------------------------------------------------- sections

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' },
        el('span', { class: 'mark' }),
        el('span', { class: 'brand-name', text: 'TOKEN RADAR' }),
        el('span', { class: 'brand-sub', text: 'market-calibrated pre-token board' })
      ),
      el('div', { class: 'top-meta' },
        el('span', null, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', null, 'Model ', el('b', { text: DATA.model_version })),
        el('span', null, 'Multiple ', el('b', { text: DATA.model.multiple + 'x' }))
      )
    );
  }

  function hero() {
    return el('section', { class: 'hero' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', null,
          'The watchlist is the floor: every protocol with at least $', el('b', { text: Math.round(DATA.floor_usd / 1e6) + 'M' }),
          ' of TVL and no token on record. The early radar adds ', el('b', { text: String(DATA.early_size) }),
          ' pre-token protocols below that floor, under the watchlist\u2019s own rule. Implied value is a model, not a promise: it prices each protocol the way the market prices live ones.'
        )
      ),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size }), el('span', { text: 'Watchlist covered' })),
        el('div', { class: 'stat' }, el('b', { text: String(DATA.board_size) }), el('span', { text: 'Pre-token rows scored' })),
        el('div', { class: 'stat' }, el('b', { text: DATA.model.multiple + 'x' }), el('span', { text: 'Market multiple (median mcap / TVL)' })),
        el('div', { class: 'stat' }, el('b', { text: String(DATA.live_size) }), el('span', { text: 'Live-token protocols set aside' }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? filteredRows().length + ' of ' + DATA.board_size + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category or chain to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; writeHash(); render(); } })
      ));
    }
    var max = 1;
    DATA.rows.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('span', null, el('b', { text: r.name }), onWatchlist(r) ? el('span', { class: 'watch', text: 'WATCHLIST' }) : null),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan. "No token" means the snapshot records no token for the protocol.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking, and their median market-cap / TVL is the multiple the model calibrates from.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel model' },
      el('h2', null, 'How implied value is computed', el('span', { class: 'tag', text: 'model ' + DATA.model_version })),
      el('p', { class: 'sub', text: 'One function scores every row from the snapshot figures alone. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x ' + m.multiple + ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') )'
      ),
      el('div', { class: 'model-grid' },
        el('div', { class: 'model-cell' },
          el('h3', { text: 'The multiple is calibrated' }),
          el('p', null, 'The market pays a median of ', el('b', { text: m.multiple + 'x TVL' }), ' for the ', el('b', { text: String(m.comparables) }), ' live-token protocols in this snapshot (clamped to 0.05\u20132.00). A pre-token protocol is priced the way the market prices live ones, not at an assumed ratio.')
        ),
        el('div', { class: 'model-cell' },
          el('h3', { text: 'Growth and age move it' }),
          el('p', null, 'Seven-day TVL growth, clamped to ', el('b', { text: m.growth_floor + '% to +' + m.growth_cap + '%' }), ', shifts value by half its weight. Age with no token raises the maturity factor from ', el('b', { text: String(m.maturity_floor) }), ' to ', el('b', { text: String(m.maturity_floor + m.maturity_range) }), ' over three years; an unlisted age uses ', el('b', { text: String(m.unknown_age_days) + ' days' }), '.')
        ),
        el('div', { class: 'model-cell' },
          el('h3', { text: 'Farm plans are derived' }),
          el('p', null, 'Each plan follows from the row\u2019s own record: the category picks the action, TVL sizes the capital ($50\u2013$250), age sets the hold (30\u201390 days), and the chain sets the gas. Every step states its cost and its time, and each plan ends with the category\u2019s main risk.')
        )
      ),
      el('p', { class: 'sub', text: 'The early radar is every pre-token protocol below the watchlist floor that the watchlist\u2019s own rule would keep: not a wrapped, staked or bridged product, not an exchange, not a versioned pool. A protocol at or above the floor that the watchlist left out is a product of a token that already trades, so it is never ranked.' })
    );
  }

  function footer() {
    return el('footer', { class: 'foot' },
      el('p', null, el('b', { text: 'Data. ' }), 'DefiLlama protocol index, snapshot ', DATA.as_of, '. The snapshot is sealed: every run of this radar reads the same bytes.'),
      el('p', null, el('b', { text: 'Wording. ' }), 'A protocol "records no token" when the snapshot carries no market cap, CoinGecko id or symbol for it; that is the record, not proof it has none. Implied value is this radar\u2019s own claim, never a price, and nothing here is financial advice.')
    );
  }

  // ---------------------------------------------------------------- detail drawer

  /** The watchlist's median TVL, from the rows at or above the floor: the context bar's mark. */
  function watchlistMedianTvl() {
    var tvls = DATA.rows.filter(onWatchlist).map(function (r) { return r.tvl_usd; }).sort(function (a, b) { return a - b; });
    if (tvls.length === 0) return null;
    return tvls.length % 2 === 1 ? tvls[(tvls.length - 1) / 2] : (tvls[tvls.length / 2 - 1] + tvls[tvls.length / 2]) / 2;
  }

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /** One line on why this row sits at its rank, from its own figures and the board around it. */
  function whyRank(row) {
    var tvlRank = DATA.rows.filter(function (r) { return r.tvl_usd > row.tvl_usd; }).length + 1;
    var parts = [];
    if (tvlRank === 1) parts.push('the largest TVL on the board');
    else if (tvlRank <= 3) parts.push('the ' + ordinal(tvlRank) + ' largest TVL on the board');
    else if (tvlRank <= 10) parts.push('a top-10 TVL on the board');
    else if (onWatchlist(row)) parts.push('TVL above the watchlist floor');
    else parts.push('TVL below the watchlist floor');
    if (row.change_7d !== null && row.change_7d !== undefined) {
      if (row.change_7d >= 20) parts.push('7-day growth of ' + fmtPct(row.change_7d));
      else if (row.change_7d <= -20) parts.push('a 7-day fall of ' + fmtPct(row.change_7d));
    }
    if (row.age_days !== null && row.age_days !== undefined) {
      if (row.age_days >= 1095) parts.push('three years tokenless');
      else if (row.age_days < 180) parts.push('listed only ' + fmtAge(row.age_days) + ' ago');
    } else parts.push('an unknown listing age');
    return 'Why rank ' + row.rank + ': ' + parts.join(', ') + '.';
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DATA.model);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (onWatchlist(row) ? '  ·  watchlist' : '  ·  early radar') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('p', { class: 'why', text: whyRank(row) }));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Market multiple (median mcap / TVL)' }), el('b', { class: 'num', text: String(DATA.model.multiple) + 'x' })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'note', text: 'Model ' + DATA.model_version + ': this page recomputes the row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number the board carries.' : ', which differs from the board: the data would be stale.') + ' An estimate, not a price.' })
    ));
    var median = watchlistMedianTvl();
    var minTvl = Infinity;
    var maxTvl = 0;
    DATA.rows.forEach(function (r) { if (r.tvl_usd < minTvl) minTvl = r.tvl_usd; if (r.tvl_usd > maxTvl) maxTvl = r.tvl_usd; });
    var logMin = Math.log10(minTvl);
    var logMax = Math.log10(maxTvl);
    var logPos = function (v) { return Math.max(0, Math.min(100, ((Math.log10(v) - logMin) / (logMax - logMin)) * 100)); };
    var ratio = median === null ? null : row.tvl_usd / median;
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'TVL in context' }),
      el('div', { class: 'tvl-track', 'aria-hidden': 'true' },
        el('i', { class: 'tvl-fill', style: 'width:' + logPos(row.tvl_usd).toFixed(1) + '%' }),
        median === null ? null : el('i', { class: 'tvl-median', style: 'left:' + logPos(median).toFixed(1) + '%' })
      ),
      el('p', { class: 'note', text: median === null
        ? fmtUsd(row.tvl_usd) + ' of TVL. The green bar is this protocol, on a log scale from the smallest to the largest TVL on the board.'
        : fmtUsd(row.tvl_usd) + ' of TVL — ' + (ratio >= 1 ? ratio.toFixed(1) : ratio.toFixed(2)) + 'x the watchlist median (' + fmtUsd(median) + '). The green bar is this protocol and the amber line is the median, on a log scale from the smallest to the largest TVL on the board.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  // ---------------------------------------------------------------- render

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(hero());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(footer());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
