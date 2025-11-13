"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
// Return lab referrals derived from prescriptions that were flagged for Lab
router.get("/", async (_req, res) => {
    try {
        // Resolve to server/models regardless of runtime location (ts-node dev or compiled)
        const modelCandidates = [
            path_1.default.resolve(__dirname, '..', 'models'), // server/models (dev)
            path_1.default.resolve(__dirname, '..', '..', 'models'), // fallback one more up
            path_1.default.resolve(process.cwd(), 'server', 'models'), // cwd/server/models
        ];
        const modelsRoot = modelCandidates.find(p => {
            try {
                return fs_1.default.existsSync(p);
            }
            catch {
                return false;
            }
        }) || path_1.default.resolve(__dirname, '..', 'models');
        const Prescription = require(path_1.default.join(modelsRoot, 'prescription'));
        const Patient = require(path_1.default.join(modelsRoot, 'Patient'));
        const Doctor = require(path_1.default.join(modelsRoot, 'Doctor'));
        const User = require(path_1.default.join(modelsRoot, 'User'));
        const list = await Prescription.find({ referredToLab: true })
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();
        // Fetch related patient/doctor names in batches
        // Patient and Doctor models use string IDs (UUID). Some prescriptions store doctorId as username.
        // Normalize all ids to strings to handle numbers/ObjectIds gracefully.
        const norm = (v) => {
            try {
                const s = String(v).trim();
                return s;
            }
            catch {
                return '';
            }
        };
        const isNonEmpty = (s) => s.length > 0;
        const patientIds = Array.from(new Set(list.map((p) => norm(p.patientId)))).filter(isNonEmpty);
        const doctorIds = Array.from(new Set(list.map((p) => norm(p.doctorId)))).filter(isNonEmpty);
        let patients = [];
        let doctors = [];
        try {
            if (patientIds.length > 0) {
                patients = await Patient.find({ _id: { $in: patientIds } }).select('name mrNumber _id').lean();
                // Fallback: if some IDs didn't match _id, try mrNumber in the same list
                const foundIds = new Set(patients.map((x) => String(x._id)));
                const missing = patientIds.filter(id => !foundIds.has(String(id)));
                if (missing.length > 0) {
                    const viaMr = await Patient.find({ mrNumber: { $in: missing } }).select('name mrNumber _id').lean();
                    if (viaMr === null || viaMr === void 0 ? void 0 : viaMr.length)
                        patients = patients.concat(viaMr);
                }
            }
            if (doctorIds.length > 0) {
                doctors = await Doctor.find({
                    $or: [
                        { _id: { $in: doctorIds } }, // doctorId is Doctor._id (UUID)
                        { username: { $in: doctorIds } }, // doctorId is doctor username
                    ]
                }).select('name username _id').lean();
                // Fallback: some prescriptions may store doctorId as User._id
                const foundKeys = new Set(doctors.flatMap((d) => [String(d._id), String(d.username || '')].filter(Boolean)));
                const missing = doctorIds.filter(id => !foundKeys.has(String(id)));
                if (missing.length > 0) {
                    const users = await User.find({ $or: [{ _id: { $in: missing } }, { username: { $in: missing } }] })
                        .select('username')
                        .lean();
                    const usernames = Array.from(new Set(users.map((u) => String(u.username)).filter(Boolean)));
                    if (usernames.length > 0) {
                        const viaUsers = await Doctor.find({ username: { $in: usernames } }).select('name username _id').lean();
                        if (viaUsers === null || viaUsers === void 0 ? void 0 : viaUsers.length)
                            doctors = doctors.concat(viaUsers);
                    }
                }
            }
        }
        catch (e) {
            console.error('[lab/referrals] lookup error:', (e === null || e === void 0 ? void 0 : e.message) || e);
            patients = [];
            doctors = [];
        }
        const pMap = new Map(patients.flatMap((x) => {
            var _a, _b;
            const entries = [];
            const idKey = (_b = (_a = x._id) === null || _a === void 0 ? void 0 : _a.toString) === null || _b === void 0 ? void 0 : _b.call(_a);
            if (idKey)
                entries.push([idKey, x]);
            if (x.mrNumber)
                entries.push([String(x.mrNumber), x]);
            return entries;
        }));
        const dMap = new Map(doctors.flatMap((x) => {
            var _a, _b;
            const entries = [];
            const idKey = (_b = (_a = x._id) === null || _a === void 0 ? void 0 : _a.toString) === null || _b === void 0 ? void 0 : _b.call(_a);
            if (idKey)
                entries.push([idKey, x]);
            if (x.username)
                entries.push([String(x.username), x]);
            return entries;
        }));
        const referrals = list.map((p) => {
            var _a, _b, _c;
            return ({
                _id: p._id,
                patientId: p.patientId,
                doctorId: p.doctorId,
                patientName: ((_a = pMap.get(norm(p.patientId))) === null || _a === void 0 ? void 0 : _a.name) || '-',
                mrNumber: ((_b = pMap.get(norm(p.patientId))) === null || _b === void 0 ? void 0 : _b.mrNumber) || '-',
                doctorName: ((_c = dMap.get(norm(p.doctorId))) === null || _c === void 0 ? void 0 : _c.name) || '-',
                testRequested: Array.isArray(p.tests) ? p.tests.join(', ') : '',
                status: 'Pending',
                createdAt: p.createdAt,
            });
        });
        res.json({ referrals });
    }
    catch (err) {
        console.error('[lab/referrals] handler error:', (err === null || err === void 0 ? void 0 : err.stack) || (err === null || err === void 0 ? void 0 : err.message) || err);
        res.status(500).json({ message: (err === null || err === void 0 ? void 0 : err.message) || 'Failed to load referrals' });
    }
});
exports.default = router;
