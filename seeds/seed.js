'use strict';
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'comparator_db',
  user: process.env.DB_USER || 'comparator_user',
  password: process.env.DB_PASSWORD || 'comparator_pass',
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🌱 Starting seed...');

    // ── Admin User ─────────────────────────────────────────────
    const hash = await bcrypt.hash('Admin@1234', 12);
    const adminResult = await client.query(`
      INSERT INTO users (email, username, password_hash, role, first_name, last_name)
      VALUES ('admin@comparator.io', 'admin', $1, 'admin', 'Platform', 'Admin')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id
    `, [hash]);
    const adminId = adminResult.rows[0].id;
    console.log('  ✅ Admin user seeded');

    // ── Countries ──────────────────────────────────────────────
    const countries = [
      ['FR', 'France', 'EU', '🇫🇷'], ['DE', 'Germany', 'EU', '🇩🇪'], ['GB', 'United Kingdom', 'EU', '🇬🇧'],
      ['ES', 'Spain', 'EU', '🇪🇸'], ['IT', 'Italy', 'EU', '🇮🇹'], ['NL', 'Netherlands', 'EU', '🇳🇱'],
      ['BE', 'Belgium', 'EU', '🇧🇪'], ['PL', 'Poland', 'EU', '🇵🇱'], ['SE', 'Sweden', 'EU', '🇸🇪'],
      ['NO', 'Norway', 'EU', '🇳🇴'], ['DK', 'Denmark', 'EU', '🇩🇰'], ['FI', 'Finland', 'EU', '🇫🇮'],
      ['AT', 'Austria', 'EU', '🇦🇹'], ['CH', 'Switzerland', 'EU', '🇨🇭'], ['PT', 'Portugal', 'EU', '🇵🇹'],
      ['GR', 'Greece', 'EU', '🇬🇷'], ['CZ', 'Czech Republic', 'EU', '🇨🇿'], ['RO', 'Romania', 'EU', '🇷🇴'],
      ['US', 'United States', 'Americas', '🇺🇸'], ['CA', 'Canada', 'Americas', '🇨🇦'],
      ['BR', 'Brazil', 'Americas', '🇧🇷'], ['MX', 'Mexico', 'Americas', '🇲🇽'],
      ['CN', 'China', 'APAC', '🇨🇳'], ['JP', 'Japan', 'APAC', '🇯🇵'],
      ['AU', 'Australia', 'APAC', '🇦🇺'], ['IN', 'India', 'APAC', '🇮🇳'],
      ['SG', 'Singapore', 'APAC', '🇸🇬'], ['KR', 'South Korea', 'APAC', '🇰🇷'],
      ['AE', 'UAE', 'MEA', '🇦🇪'], ['ZA', 'South Africa', 'MEA', '🇿🇦'],
    ];
    for (const [code, name, region, flag] of countries) {
      await client.query(
        `INSERT INTO countries (code, name, region, flag_emoji) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING`,
        [code, name, region, flag]
      );
    }
    console.log(`  ✅ ${countries.length} countries seeded`);

    // ── Terminal Categories ────────────────────────────────────
    const categories = [
      ['COUNTERTOP',  'Countertop Terminal',     'Traditional counter-mounted payment terminal for fixed checkout points.',                 'Both',       'In-Store',    1],
      ['MPOS',        'Mobile POS (mPOS)',        'Lightweight dongle or compact reader paired with a smartphone or tablet.',               'SMB',        'Mobile',      2],
      ['SMART_POS',   'Smart POS',               'Android-based intelligent terminal with app ecosystem and touchscreen.',                  'Both',       'In-Store',    3],
      ['SOFTPOS',     'SoftPOS / Tap-on-Phone',  'Software-only solution turning a merchant\'s NFC-capable smartphone into a terminal.',   'SMB',        'Mobile',      4],
      ['UNATTENDED',  'Unattended / Self-Service','Kiosk or vending machine payment module — no cashier required.',                        'Enterprise', 'In-Store',    5],
      ['EV_CHARGING', 'EV Charging Payment',     'Integrated payment unit for electric vehicle charging stations.',                        'Both',       'In-Store',    6],
      ['KIOSK',       'Interactive Kiosk',       'Full self-service ordering and payment kiosk (e.g., QSR / retail).',                     'Enterprise', 'In-Store',    7],
      ['INTEGRATED',  'Integrated / ECR',        'Embedded payment engine integrated into an ECR or POS software.',                        'Enterprise', 'Omnichannel', 8],
    ];
    for (const [code, name, desc, size, channel, order] of categories) {
      await client.query(
        `INSERT INTO terminal_categories (code, name, description, target_merchant_size, channel, sort_order, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (code) DO NOTHING`,
        [code, name, desc, size, channel, order, adminId]
      );
    }
    console.log(`  ✅ ${categories.length} terminal categories seeded`);

    // ── Verticals ──────────────────────────────────────────────
    const verticals = [
      ['RETAIL',         'Retail',                 'General merchandise and specialty retail stores.',     '🛒'],
      ['HOSPITALITY',    'Hospitality / Restaurant','Hotels, restaurants, bars, and food service.',       '🍽️'],
      ['HEALTHCARE',     'Healthcare',              'Clinics, pharmacies, and medical services.',          '🏥'],
      ['MOBILITY_EV',    'Mobility / EV',           'Electric vehicle charging and mobility services.',    '⚡'],
      ['GROCERY',        'Grocery / Supermarket',   'Supermarkets, convenience stores, and food retail.',  '🛍️'],
      ['PETROL',         'Petrol / Forecourt',      'Fuel stations and forecourt payments.',               '⛽'],
      ['TRANSPORT',      'Transport',               'Public transport, taxi, and ride-hailing payments.',  '🚌'],
      ['ENTERTAINMENT',  'Entertainment',           'Cinemas, events, venues, and gaming.',                '🎭'],
      ['B2B',            'B2B / Corporate',         'Business-to-business payments and corporate billing.','💼'],
      ['GOVERNMENT',     'Government',              'Public sector, utilities, and government agencies.',  '🏛️'],
    ];
    for (const [code, name, desc, icon] of verticals) {
      await client.query(
        `INSERT INTO verticals (code, name, description, icon) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING`,
        [code, name, desc, icon]
      );
    }
    console.log(`  ✅ ${verticals.length} verticals seeded`);

    // ── Offer Types ────────────────────────────────────────────
    const offerTypes = [
      ['PSP',         'Payment Service Provider'], ['ACQUIRER',   'Acquirer'],
      ['PSP_ACQUIRER','PSP + Acquirer'],           ['TERMINAL_MFR','Terminal Manufacturer'],
      ['SUPPLIER',    'Technology Supplier'],      ['FULL_STACK',  'Full-Stack Commerce'],
    ];
    for (const [code, name] of offerTypes) {
      await client.query(`INSERT INTO offer_types (code, name) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING`, [code, name]);
    }
    console.log(`  ✅ ${offerTypes.length} offer types seeded`);

    // ── VAS Types ──────────────────────────────────────────────
    const vasTypes = [
      ['DCC',             'Dynamic Currency Conversion', 'Payment',  'Convert transactions to cardholder\'s home currency.'],
      ['TIPPING',         'Tipping',                    'Payment',  'On-terminal tipping prompts.'],
      ['SPLIT_BILL',      'Split Bill',                 'Payment',  'Split a transaction across multiple payment methods.'],
      ['BNPL',            'Buy Now Pay Later',          'Finance',  'Deferred payment and instalment plans.'],
      ['TAX_FREE',        'Tax-Free Shopping',          'Finance',  'VAT refund for international shoppers.'],
      ['LOYALTY',         'Loyalty & Rewards',          'Loyalty',  'Integrated loyalty point and rewards programme.'],
      ['GIFT_CARDS',      'Gift Cards',                 'Loyalty',  'Digital and physical gift card issuance and redemption.'],
      ['INSTANT_SETTLE',  'Instant Settlement',         'Finance',  'Same-day or real-time settlement of funds.'],
      ['FREE_ACCOUNT',    'Free Merchant Account',      'Finance',  'Zero-cost merchant account with bundled payments.'],
      ['CORP_CARD',       'Corporate Card',             'Finance',  'Business purchasing and expense management card.'],
      ['AI_CATALOG',      'AI Product Catalogue',       'AI',       'AI-powered product recommendations at checkout.'],
      ['AUTO_RECON',      'Auto-Reconciliation',        'AI',       'Automated transaction reconciliation and reporting.'],
      ['ORDER_TABLE',     'Order at Table',             'Loyalty',  'QR-based ordering integrated with payment.'],
      ['INVOICING',       'Invoicing',                  'Finance',  'Digital invoice generation and payment tracking.'],
      ['ACCOUNTING',      'Accounting Integration',     'Finance',  'Direct sync to accounting software (Xero, QuickBooks).'],
    ];
    for (const [code, name, cat, desc] of vasTypes) {
      await client.query(
        `INSERT INTO vas_types (code, name, category, description) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING`,
        [code, name, cat, desc]
      );
    }
    console.log(`  ✅ ${vasTypes.length} VAS types seeded`);

    // ── Pricing Structures ─────────────────────────────────────
    const pricingStructures = [
      ['PAYG',         'Pay-As-You-Go',    'Per-transaction fee with no monthly commitment.'],
      ['SUBSCRIPTION', 'Subscription',     'Fixed monthly or annual fee covering defined transaction volumes.'],
      ['CUSTOM',       'Custom / Bespoke', 'Negotiated pricing for enterprise customers.'],
      ['RENTAL',       'Terminal Rental',  'Monthly hardware rental including maintenance.'],
      ['REVENUE_SHARE','Revenue Share',    'Acquirer or partner shares a percentage of transaction revenue.'],
      ['INTERCHANGE',  'Interchange++',    'Pass-through interchange plus a fixed markup.'],
    ];
    for (const [code, name, desc] of pricingStructures) {
      await client.query(
        `INSERT INTO pricing_structures (code, name, description) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING`,
        [code, name, desc]
      );
    }
    console.log(`  ✅ ${pricingStructures.length} pricing structures seeded`);

    // ── Payment Interfaces ─────────────────────────────────────
    const paymentInterfaces = [
      ['EMV_CONTACT',    'EMV Contact',          'Card',      'Chip & PIN / Chip & Sign (ISO/IEC 7816).'],
      ['EMV_CTLS',       'EMV Contactless',       'Card',      'Contactless EMV (ISO/IEC 14443 / EMVCo).'],
      ['NFC_APPLE_PAY',  'NFC / Apple Pay',       'Mobile',    'Apple Pay via NFC.'],
      ['NFC_GOOGLE_PAY', 'NFC / Google Pay',      'Mobile',    'Google Pay via NFC.'],
      ['NFC_SAMSUNG_PAY','NFC / Samsung Pay',     'Mobile',    'Samsung Pay via NFC / MST.'],
      ['QR_STATIC',      'QR Code (Static)',      'QR',        'Fixed QR code displayed by merchant.'],
      ['QR_DYNAMIC',     'QR Code (Dynamic)',     'QR',        'Transaction-specific dynamic QR.'],
      ['BIOMETRIC_FP',   'Biometric Fingerprint', 'Biometric', 'Fingerprint sensor payment authorisation.'],
      ['BIOMETRIC_FACE', 'Biometric Face',        'Biometric', 'Facial recognition payment authorisation.'],
      ['MAGSTRIPE',      'Magstripe',             'Card',      'Traditional magnetic stripe card reader.'],
    ];
    for (const [code, name, cat, desc] of paymentInterfaces) {
      await client.query(
        `INSERT INTO payment_interfaces (code, name, category, description) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING`,
        [code, name, cat, desc]
      );
    }
    console.log(`  ✅ ${paymentInterfaces.length} payment interfaces seeded`);

    // ── Get France ID for seeding ──────────────────────────────
    const frResult  = await client.query(`SELECT id FROM countries WHERE code='FR'`);
    const deResult  = await client.query(`SELECT id FROM countries WHERE code='DE'`);
    const gbResult  = await client.query(`SELECT id FROM countries WHERE code='GB'`);
    const usResult  = await client.query(`SELECT id FROM countries WHERE code='US'`);
    const cnResult  = await client.query(`SELECT id FROM countries WHERE code='CN'`);
    const frId = frResult.rows[0]?.id;
    const deId = deResult.rows[0]?.id;
    const gbId = gbResult.rows[0]?.id;
    const usId = usResult.rows[0]?.id;
    const cnId = cnResult.rows[0]?.id;

    // ── Competitors ────────────────────────────────────────────
    const competitors = [
      ['WORLDLINE',   'Worldline',      '#2E75B6', 'PSP_Acquirer',  frId,  1973, 'https://worldline.com',     'European payment technology leader.'],
      ['INGENICO',    'Ingenico',       '#E31937', 'Terminal_Mfr',  frId,  1980, 'https://ingenico.com',      'Global leader in payment terminals.'],
      ['VERIFONE',    'Verifone',       '#0073CF', 'Terminal_Mfr',  usId,  1981, 'https://verifone.com',      'Global payment & commerce solutions.'],
      ['PAX',         'PAX Technology', '#00A651', 'Terminal_Mfr',  cnId,  2000, 'https://www.pax.us',        'Fast-growing smart POS manufacturer.'],
      ['SUNMI',       'SUNMI',          '#FF6600', 'Terminal_Mfr',  cnId,  2013, 'https://www.sunmi.com',     'Smart commercial hardware for retail.'],
      ['ADYEN',       'Adyen',          '#0ABF53', 'PSP_Acquirer',  deId,  2006, 'https://adyen.com',         'Global payments platform.'],
      ['STRIPE',      'Stripe',         '#635BFF', 'PSP',           usId,  2010, 'https://stripe.com',        'Developer-first payment infrastructure.'],
      ['SQUARE',      'Square',         '#3E4348', 'PSP_Acquirer',  usId,  2009, 'https://squareup.com',      'Commerce solutions for SMBs.'],
      ['SUMUP',       'SumUp',          '#00D4BC', 'PSP_Acquirer',  gbId,  2012, 'https://sumup.com',         'mPOS and SMB payment solutions.'],
      ['ZETTLE',      'Zettle by PayPal','#009CDE','PSP',           gbId,  2010, 'https://zettle.com',        'PayPal\'s point-of-sale platform.'],
      ['NEXI',        'Nexi',           '#FF6200', 'PSP_Acquirer',  null,  2017, 'https://nexigroup.com',     'Leading European PayTech.'],
      ['NETS',        'Nets',           '#0032A0', 'PSP_Acquirer',  deId,  1968, 'https://nets.eu',           'Nordic payments and infrastructure.'],
      ['ELAVON',      'Elavon',         '#004B87', 'Acquirer',      usId,  1991, 'https://elavon.com',        'Global merchant acquirer (US Bancorp).'],
      ['CHECKOUT_COM','Checkout.com',   '#0039C6', 'PSP',           gbId,  2012, 'https://checkout.com',      'Enterprise digital payment processing.'],
      ['NUVEI',       'Nuvei',          '#16213E', 'PSP',           null,  2003, 'https://nuvei.com',         'Modular payment technology company.'],
      ['PLANET',      'Planet',         '#5BB3E4', 'PSP_Acquirer',  null,  1985, 'https://weareplanet.com',   'Payments for international commerce.'],
    ];
    for (const [code, name, hex, type, country, year, url, desc] of competitors) {
      await client.query(
        `INSERT INTO competitors (code, name, logo_color_hex, competitor_type, hq_country_id, founded_year, website_url, description, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (code) DO NOTHING`,
        [code, name, hex, type, country, year, url, desc, adminId]
      );
    }
    console.log(`  ✅ ${competitors.length} competitors seeded`);

    await client.query('COMMIT');
    console.log('\n🎉 Database seed completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
