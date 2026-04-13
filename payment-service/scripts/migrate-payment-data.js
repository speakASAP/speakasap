"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Phase-4 payment DB ETL: read-only legacy portal Postgres → speakasap_payment_db (Prisma).
 *
 *   npm run migrate:payment-data -- --dry-run
 *   npm run migrate:payment-data -- --load
 *   npm run migrate:payment-data -- --dry-run --write-docs
 *
 * Env (speakasap/.env): PAYMENT_LEGACY_DATABASE_URL, PAYMENT_DATABASE_URL (or DATABASE_URL for target).
 */
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const pg_1 = __importDefault(require("pg"));
const __filename = (0, node_url_1.fileURLToPath)(import.meta.url);
const __dirname = (0, node_path_1.dirname)(__filename);
const NS_DNS = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');
function ts() {
    return new Date().toISOString();
}
function log(msg, meta) {
    console.log(JSON.stringify({ timestamp: ts(), msg, ...meta }));
}
function loadEnvFrom(filePath) {
    if (!(0, node_fs_1.existsSync)(filePath)) {
        return;
    }
    const text = (0, node_fs_1.readFileSync)(filePath, 'utf8');
    for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) {
            continue;
        }
        const eq = t.indexOf('=');
        if (eq === -1) {
            continue;
        }
        const key = t.slice(0, eq).trim();
        let val = t.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
            process.env[key] = val;
        }
    }
}
function uuidV5(name) {
    const hash = (0, node_crypto_1.createHash)('sha1');
    hash.update(NS_DNS);
    hash.update(name, 'utf8');
    const buf = hash.digest().subarray(0, 16);
    buf[6] = (buf[6] & 0x0f) | 0x50;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const hex = buf.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
function computeOrderStatus(row) {
    if (row.trashed) {
        return 'canceled';
    }
    if (row.paid) {
        return 'paid';
    }
    if (row.till_date) {
        const td = new Date(row.till_date);
        td.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (td <= today) {
            return 'expired';
        }
    }
    return 'awaiting_payment';
}
function mapDiscountType(raw) {
    if (raw === 'fixed') {
        return 'FIXED';
    }
    return 'PERCENT';
}
function buildOrderJson(data, additional) {
    const base = data !== null && data !== undefined && typeof data === 'object' && !Array.isArray(data)
        ? { ...data }
        : {};
    if (additional && additional.trim()) {
        try {
            const parsed = JSON.parse(additional);
            return { ...base, legacyAdditional: parsed };
        }
        catch {
            return { ...base, legacyAdditionalText: additional };
        }
    }
    return base;
}
function trashedAtFromOrder(row) {
    return row.trashed ? row.created : null;
}
async function collectLegacyStats(client) {
    const one = async (sql) => {
        const r = await client.query(sql);
        return parseInt(r.rows[0].c, 10);
    };
    const subs = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name ILIKE '%subscription%'
    ORDER BY table_name
  `);
    let transactions = 0;
    try {
        transactions = await one('SELECT COUNT(*)::text AS c FROM orders_transaction');
    }
    catch {
        transactions = 0;
    }
    let failedPayments = 0;
    try {
        failedPayments = await one('SELECT COUNT(*)::text AS c FROM orders_failedpayment');
    }
    catch {
        failedPayments = 0;
    }
    let discountM2mRows = 0;
    try {
        discountM2mRows = await one('SELECT COUNT(*)::text AS c FROM discount_discounttemplate_products');
    }
    catch {
        discountM2mRows = 0;
    }
    return {
        orders: await one('SELECT COUNT(*)::text AS c FROM orders_order'),
        payments: await one('SELECT COUNT(*)::text AS c FROM orders_payment'),
        paymentsAndroid: await one(`SELECT COUNT(*)::text AS c FROM orders_payment p
       INNER JOIN orders_androidpayment a ON a.payment_ptr_id = p.id`).catch(() => 0),
        transactions,
        failedPayments,
        discountTemplates: await one('SELECT COUNT(*)::text AS c FROM discount_discounttemplate'),
        discountOrders: await one('SELECT COUNT(*)::text AS c FROM discount_discountorder'),
        discountM2mRows,
        orphanPayments: await one(`SELECT COUNT(*)::text AS c FROM orders_payment p
       WHERE NOT EXISTS (SELECT 1 FROM orders_order o WHERE o.id = p.order_id)`),
        ordersMissingUser: await one('SELECT COUNT(*)::text AS c FROM orders_order WHERE user_id IS NULL'),
        subscriptionLikeTables: subs.rows.map((r) => r.table_name),
    };
}
function paymentStatus(paid, method, externalStatus) {
    if (method === 'external' && externalStatus) {
        return externalStatus.toLowerCase();
    }
    if (paid) {
        return 'completed';
    }
    return 'pending';
}
function normalizeMethod(raw) {
    if (raw === 'paypal') {
        return 'paypal';
    }
    if (raw === 'webpay') {
        return 'webpay';
    }
    if (raw === 'card') {
        return 'card';
    }
    if (raw === 'inner') {
        return 'inner';
    }
    if (raw === 'invoice') {
        return 'invoice';
    }
    if (raw === 'external') {
        return 'external';
    }
    return raw;
}
async function main() {
    const args = process.argv.slice(2);
    const doLoad = args.includes('--load');
    const writeDocs = args.includes('--write-docs');
    const envPath = (0, node_path_1.join)(__dirname, '..', '..', '.env');
    loadEnvFrom(envPath);
    const legacyUrl = process.env.PAYMENT_LEGACY_DATABASE_URL;
    const targetUrl = process.env.PAYMENT_DATABASE_URL || process.env.DATABASE_URL;
    if (!legacyUrl) {
        throw new Error('PAYMENT_LEGACY_DATABASE_URL is required (read-only legacy portal DB).');
    }
    if (!targetUrl) {
        throw new Error('PAYMENT_DATABASE_URL or DATABASE_URL is required for target DB.');
    }
    log('payment_etl_start', { dryRun: !doLoad, load: doLoad });
    const legacy = new pg_1.default.Client({ connectionString: legacyUrl, statement_timeout: 120000 });
    await legacy.connect();
    log('legacy_connected', {});
    const stats = await collectLegacyStats(legacy);
    log('legacy_counts', stats);
    process.env.DATABASE_URL = targetUrl;
    const { PrismaClient, Prisma } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
    const prisma = new PrismaClient();
    const paymentSql = `
    SELECT p.id, p.order_id, p.paid, p.amount, p.uuid::text AS uuid, p.trashed, p.created,
      CASE
        WHEN ep.payment_ptr_id IS NOT NULL THEN COALESCE(ep.provider, 'external')
        WHEN pp.payment_ptr_id IS NOT NULL THEN 'paypal'
        WHEN ip.payment_ptr_id IS NOT NULL THEN 'invoice'
        WHEN inp.payment_ptr_id IS NOT NULL THEN 'inner'
        WHEN wp.payment_ptr_id IS NOT NULL THEN 'webpay'
        WHEN csp.payment_ptr_id IS NOT NULL THEN 'card'
        WHEN ap.payment_ptr_id IS NOT NULL THEN 'android'
        ELSE 'legacy_unknown'
      END AS legacy_method,
      pp.payment_id AS paypal_payment_id,
      pp.url AS paypal_url,
      ip.number AS invoice_number,
      ip.received AS invoice_received,
      ip.actual_amount AS invoice_actual_amount,
      ep.external_payment_id,
      ep.status AS external_status,
      ep.redirect_url AS external_redirect
    FROM orders_payment p
    LEFT JOIN orders_externalpayment ep ON ep.payment_ptr_id = p.id
    LEFT JOIN orders_paypalpayment pp ON pp.payment_ptr_id = p.id
    LEFT JOIN orders_invoicepayment ip ON ip.payment_ptr_id = p.id
    LEFT JOIN orders_innerpayment inp ON inp.payment_ptr_id = p.id
    LEFT JOIN orders_webpaypayment wp ON wp.payment_ptr_id = p.id
    LEFT JOIN orders_cspayment csp ON csp.payment_ptr_id = p.id
    LEFT JOIN orders_androidpayment ap ON ap.payment_ptr_id = p.id
  `;
    const ordersRes = await legacy.query(`SELECT id, user_id, price, title, comment, paid, sticky, discountable, deletable,
            created, product_id, additional, data, till_date, trashed
     FROM orders_order ORDER BY id`);
    const orderRowsWithUser = ordersRes.rows.filter((r) => r.user_id != null);
    const ordersSkippedNoUser = ordersRes.rows.length - orderRowsWithUser.length;
    if (ordersSkippedNoUser > 0) {
        log('orders_skipped_null_user', { count: ordersSkippedNoUser });
    }
    const paymentsRes = await legacy.query(paymentSql);
    const templatesRes = await legacy.query(`SELECT code, single_user, enabled, discount, discount_type, valid_till, comment, permanent, course_discount
     FROM discount_discounttemplate`);
    const m2mRes = await legacy
        .query(`SELECT discounttemplate_id, product_id FROM discount_discounttemplate_products`)
        .catch(() => ({ rows: [] }));
    const dOrderRes = await legacy.query(`SELECT order_id, discount_template_id FROM discount_discountorder`);
    const orderIdMap = new Map();
    for (const row of orderRowsWithUser) {
        orderIdMap.set(row.id, uuidV5(`speakasap:payment-service:order:${row.id}`));
    }
    const ordersPayload = orderRowsWithUser.map((row) => ({
        id: orderIdMap.get(row.id),
        userId: String(row.user_id),
        title: row.title || '',
        priceMinor: row.price,
        currency: 'EUR',
        paid: row.paid,
        status: computeOrderStatus(row),
        productId: row.product_id != null ? String(row.product_id) : null,
        data: buildOrderJson(row.data, row.additional),
        tillDate: row.till_date,
        comment: row.comment,
        sticky: row.sticky,
        discountable: row.discountable,
        deletable: row.deletable,
        trashedAt: trashedAtFromOrder(row),
        createdAt: row.created,
        updatedAt: row.created,
    }));
    const androidExcluded = paymentsRes.rows.filter((p) => p.legacy_method === 'android');
    const paymentsForLoad = paymentsRes.rows.filter((p) => p.legacy_method !== 'android' && orderIdMap.has(p.order_id));
    const paymentsSkippedMissingOrder = paymentsRes.rows.filter((p) => p.legacy_method !== 'android' && !orderIdMap.has(p.order_id));
    const paymentPayload = paymentsForLoad.map((p) => {
        const oid = orderIdMap.get(p.order_id);
        const method = normalizeMethod(p.legacy_method);
        const providerPaymentId = p.external_payment_id || p.paypal_payment_id || null;
        const payload = {
            legacyPaymentId: p.id,
            legacyMethod: p.legacy_method,
        };
        if (p.paypal_url) {
            payload.paypalUrl = p.paypal_url;
        }
        if (p.invoice_number != null) {
            payload.invoiceNumber = p.invoice_number;
            payload.invoiceReceived = p.invoice_received;
            payload.invoiceActualAmountMinor = p.invoice_actual_amount;
        }
        if (p.external_redirect) {
            payload.redirectUrl = p.external_redirect;
        }
        return {
            id: uuidV5(`speakasap:payment-service:payment:${p.id}`),
            orderId: oid,
            amountMinor: p.amount,
            paidAt: p.paid,
            publicUuid: p.uuid,
            providerPaymentId,
            method,
            status: paymentStatus(p.paid, method, p.external_status),
            providerPayload: payload,
            createdAt: p.created,
        };
    });
    const templatesPayload = templatesRes.rows.map((t) => ({
        code: t.code.toUpperCase(),
        singleUser: t.single_user,
        enabled: t.enabled,
        discount: new Prisma.Decimal(t.discount),
        discountType: mapDiscountType(t.discount_type),
        validTill: t.valid_till,
        comment: t.comment,
        permanent: t.permanent,
        courseDiscount: t.course_discount,
    }));
    const productsPayload = m2mRes.rows.map((r) => ({
        templateCode: r.discounttemplate_id.toUpperCase(),
        productId: String(r.product_id),
    }));
    const discountOrdersPayload = dOrderRes.rows
        .filter((d) => orderIdMap.has(d.order_id))
        .map((d) => ({
        orderId: orderIdMap.get(d.order_id),
        discountTemplateCode: d.discount_template_id.toUpperCase(),
    }));
    const invoiceRows = paymentsForLoad.filter((p) => p.invoice_number != null && p.legacy_method === 'invoice');
    const orderByLegacyId = new Map(orderRowsWithUser.map((o) => [o.id, o]));
    const invoicesPayload = invoiceRows.map((p) => {
        const order = orderByLegacyId.get(p.order_id);
        return {
            id: uuidV5(`speakasap:payment-service:invoice:${p.id}`),
            orderId: orderIdMap.get(p.order_id),
            userId: String(order.user_id),
            number: p.invoice_number != null ? String(p.invoice_number) : null,
            received: Boolean(p.invoice_received),
            amountMinor: p.invoice_actual_amount ?? p.amount,
            currency: 'EUR',
            metadata: { legacyPaymentId: p.id, legacyInvoice: true },
            createdAt: p.created,
        };
    });
    log('transform_summary', {
        orders: ordersPayload.length,
        paymentAttempts: paymentPayload.length,
        paymentsSkippedAndroid: androidExcluded.length,
        paymentsSkippedMissingOrder: paymentsSkippedMissingOrder.length,
        discountTemplates: templatesPayload.length,
        discountProducts: productsPayload.length,
        discountOrders: discountOrdersPayload.length,
        invoices: invoicesPayload.length,
    });
    if (doLoad) {
        log('load_batch_start', { step: 'discount_templates' });
        for (let i = 0; i < templatesPayload.length; i += 200) {
            const chunk = templatesPayload.slice(i, i + 200);
            await prisma.discountTemplate.createMany({ data: chunk, skipDuplicates: true });
            log('load_batch_progress', { step: 'discount_templates', at: Math.min(i + chunk.length, templatesPayload.length) });
        }
        for (let i = 0; i < productsPayload.length; i += 500) {
            const chunk = productsPayload.slice(i, i + 500);
            if (chunk.length) {
                await prisma.discountProduct.createMany({ data: chunk, skipDuplicates: true });
            }
        }
        for (let i = 0; i < ordersPayload.length; i += 200) {
            const chunk = ordersPayload.slice(i, i + 200);
            await prisma.order.createMany({ data: chunk, skipDuplicates: true });
            log('load_batch_progress', { step: 'orders', at: Math.min(i + chunk.length, ordersPayload.length) });
        }
        for (let i = 0; i < discountOrdersPayload.length; i += 300) {
            const chunk = discountOrdersPayload.slice(i, i + 300);
            if (chunk.length) {
                await prisma.discountOrder.createMany({ data: chunk, skipDuplicates: true });
            }
        }
        for (let i = 0; i < paymentPayload.length; i += 200) {
            const chunk = paymentPayload.slice(i, i + 200);
            await prisma.paymentAttempt.createMany({ data: chunk, skipDuplicates: true });
            log('load_batch_progress', {
                step: 'payment_attempts',
                at: Math.min(i + chunk.length, paymentPayload.length),
            });
        }
        for (let i = 0; i < invoicesPayload.length; i += 200) {
            const chunk = invoicesPayload.slice(i, i + 200);
            if (chunk.length) {
                await prisma.invoice.createMany({ data: chunk, skipDuplicates: true });
            }
        }
        log('load_complete', {});
    }
    else {
        log('dry_run_no_writes', {});
    }
    await legacy.end();
    await prisma.$disconnect();
    if (writeDocs) {
        const docDir = (0, node_path_1.join)(__dirname, '..', '..', 'docs', 'refactoring');
        const logPath = (0, node_path_1.join)(docDir, 'PAYMENT_DATA_MIGRATION_LOG.md');
        const block = `\n## Run ${ts()}\n\n\`\`\`json\n${JSON.stringify({
            dryRun: !doLoad,
            stats,
            ordersSkippedNoUser,
            transform: {
                orders: ordersPayload.length,
                paymentAttempts: paymentPayload.length,
                paymentsSkippedAndroid: androidExcluded.length,
                paymentsSkippedMissingOrder: paymentsSkippedMissingOrder.length,
            },
        }, null, 2)}\n\`\`\`\n`;
        (0, node_fs_1.appendFileSync)(logPath, block);
        log('appended_migration_log', { path: logPath });
    }
}
main().catch((e) => {
    console.error(JSON.stringify({ timestamp: ts(), msg: 'payment_etl_fatal', error: String(e) }));
    process.exit(1);
});
