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
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Idempotent bootstrap seed for the initial super_admin (FR-040, R-015).
 * Re-running this script is safe: it no-ops when an account with the canonical
 * email already exists.
 *
 * Run:  npx prisma db seed
 */
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
function canonicaliseEmail(raw) {
    const display = raw.trim();
    const email = display.normalize('NFKC').toLowerCase();
    return { email, display };
}
async function main() {
    const rawEmail = required('SEED_ADMIN_EMAIL');
    const name = required('SEED_ADMIN_NAME');
    const password = required('SEED_ADMIN_PASSWORD');
    const cost = Number(process.env['BCRYPT_COST'] ?? 12);
    const { email, display } = canonicaliseEmail(rawEmail);
    const existing = await prisma.staffAccount.findUnique({ where: { email } });
    if (existing) {
        log(`seed: super_admin already present (${email}) — no action.`);
        return;
    }
    if (password.length < 12 || password.length > 128) {
        throw new Error('SEED_ADMIN_PASSWORD must be 12–128 characters');
    }
    const passwordHash = await bcrypt.hash(password, cost);
    await prisma.staffAccount.create({
        data: {
            email,
            emailDisplay: display,
            name: name.trim(),
            passwordHash,
            role: client_1.StaffRole.SUPER_ADMIN,
            isActive: true,
            mustChangePassword: true,
        },
    });
    log(`seed: created super_admin (${email}) with mustChangePassword=true.`);
}
function required(key) {
    const v = process.env[key];
    if (!v)
        throw new Error(`Missing env var: ${key}`);
    return v;
}
function log(msg) {
    // eslint-disable-next-line no-console
    console.log(`[seed] ${msg}`);
}
main()
    .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed] failed:', err);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map