const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'comparator_user',
  host: 'localhost',
  database: 'comparator_db',
  password: 'comparator_pass',
  port: 5432
});

const realisticCapabilities = {
  'Adyen': ['DCC', 'TIPPING', 'SPLIT_BILL', 'BNPL', 'TAX_FREE', 'LOYALTY', 'GIFT_CARDS', 'INSTANT_SETTLE', 'AUTO_RECON', 'ACCOUNTING', 'INVOICING'],
  'Checkout.com': ['DCC', 'BNPL', 'AUTO_RECON', 'ACCOUNTING', 'INSTANT_SETTLE'],
  'Planet': ['DCC', 'TAX_FREE', 'TIPPING', 'SPLIT_BILL', 'ORDER_TABLE', 'INVOICING', 'LOYALTY'],
  'PAX Technology': ['LOYALTY', 'GIFT_CARDS', 'TIPPING', 'SPLIT_BILL', 'AI_CATALOG'],
  'Worldline': ['DCC', 'TIPPING', 'SPLIT_BILL', 'TAX_FREE', 'LOYALTY', 'GIFT_CARDS', 'INSTANT_SETTLE', 'AUTO_RECON', 'ACCOUNTING', 'INVOICING']
};

async function seed() {
  try {
    const comps = await pool.query('SELECT id, name FROM competitors');
    const vas = await pool.query('SELECT id, code FROM vas_types');
    
    const compMap = {};
    comps.rows.forEach(c => compMap[c.name] = c.id);
    
    const vasMap = {};
    vas.rows.forEach(v => vasMap[v.code] = v.id);

    await pool.query('BEGIN');

    // Clear existing to avoid duplicates during our test
    await pool.query('DELETE FROM competitor_vas');

    let count = 0;
    for (const [compName, activeCodes] of Object.entries(realisticCapabilities)) {
      const compId = compMap[compName];
      if (!compId) continue;

      for (const vasObj of vas.rows) {
        const isAvail = activeCodes.includes(vasObj.code);
        await pool.query(
          'INSERT INTO competitor_vas (competitor_id, vas_type_id, is_available) VALUES ($1, $2, $3)',
          [compId, vasObj.id, isAvail]
        );
        count++;
      }
    }
    
    // Fill the rest with false so the matrix explicitly knows they are false, rather than missing
    for (const comp of comps.rows) {
      if (realisticCapabilities[comp.name]) continue; // Already handled
      for (const vasObj of vas.rows) {
        // give random ones true for the rest
        const randomAvail = Math.random() > 0.7; 
        await pool.query(
          'INSERT INTO competitor_vas (competitor_id, vas_type_id, is_available) VALUES ($1, $2, $3)',
          [comp.id, vasObj.id, randomAvail]
        );
        count++;
      }
    }

    // ------------------------------------------------------------------------------------------------ //
    // 2) SEED ACQUIRER / COMPETITOR PRICING
    // ------------------------------------------------------------------------------------------------ //
    await pool.query('DELETE FROM competitor_pricing');
    
    const psList = await pool.query('SELECT id, code FROM pricing_structures');
    const psMap = {};
    psList.rows.forEach(p => psMap[p.code] = p.id);

    // Realistic dummy pricing definitions
    const pricingDefs = {
      'Adyen': [
        { code: 'INTERCHANGE', rate: 0.0050, fee: 0.10, desc: 'Interchange++ with €0.10 fixed fee' },
        { code: 'CUSTOM', rate: null, fee: null, desc: 'Custom enterprise pricing available' }
      ],
      'Checkout.com': [
        { code: 'INTERCHANGE', rate: 0.0045, fee: 0.08, desc: 'Aggressive Interchange++' },
        { code: 'PAYG', rate: 0.0120, fee: 0.20, desc: 'Blended Pay-As-You-Go at 1.2%' }
      ],
      'Planet': [
        { code: 'PAYG', rate: 0.0140, fee: 0.15, desc: 'Standard blended rate' },
        { code: 'RENTAL', desc: 'Hardware rental available from €15/mo' }
      ],
      'PAX Technology': [
        // PAX is mostly hardware, but could have SaaS
        { code: 'SUBSCRIPTION', desc: 'SaaS and terminal management subscription' }
      ],
      'Worldline': [
        { code: 'PAYG', rate: 0.0150, fee: 0.05, desc: 'Standard Merchant Blended Rate at 1.5%' },
        { code: 'INTERCHANGE', rate: 0.0060, fee: 0.12, desc: 'Interchange++ for high volume' },
        { code: 'RENTAL', desc: 'Terminals from €12/month' }
      ]
    };

    let pricingCount = 0;
    for (const [compName, plans] of Object.entries(pricingDefs)) {
      const compId = compMap[compName];
      if (!compId) continue;

      for (const plan of plans) {
        const structId = psMap[plan.code];
        if (!structId) continue;
        await pool.query(
          `INSERT INTO competitor_pricing 
            (competitor_id, pricing_structure_id, percentage_rate, flat_fee_eur, description) 
           VALUES ($1, $2, $3, $4, $5)`,
          [compId, structId, plan.rate || null, plan.fee || null, plan.desc]
        );
        pricingCount++;
      }
    }

    // Give random pay-as-you-go data for remaining competitors
    for (const comp of comps.rows) {
      if (pricingDefs[comp.name]) continue;
      const structId = psMap['PAYG'];
      if (structId) {
        await pool.query(
          `INSERT INTO competitor_pricing (competitor_id, pricing_structure_id, percentage_rate, description) 
           VALUES ($1, $2, $3, $4)`,
          [comp.id, structId, 0.0175, 'Standard un-negotiated 1.75% blended rate']
        );
        pricingCount++;
      }
    }

    await pool.query('COMMIT');
    console.log(`Successfully seeded ${count} competitor_vas records and ${pricingCount} competitor_pricing records.`);
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error('Failed to seed DB', e);
  } finally {
    pool.end();
  }
}

seed();
