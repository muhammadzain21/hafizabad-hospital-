import { Router } from "express";
import path from "path";
import fs from "fs";

const router = Router();

// Return lab referrals derived from prescriptions that were flagged for Lab
router.get("/", async (_req: any, res: any) => {
  try {
    // Resolve to server/models regardless of runtime location (ts-node dev or compiled)
    const modelCandidates = [
      path.resolve(__dirname, '..', 'models'),                // server/models (dev)
      path.resolve(__dirname, '..', '..', 'models'),          // fallback one more up
      path.resolve(process.cwd(), 'server', 'models'),        // cwd/server/models
    ];
    const modelsRoot = modelCandidates.find(p => {
      try { return fs.existsSync(p); } catch { return false; }
    }) || path.resolve(__dirname, '..', 'models');
    const Prescription = require(path.join(modelsRoot, 'prescription'));
    const Patient = require(path.join(modelsRoot, 'Patient'));
    const Doctor = require(path.join(modelsRoot, 'Doctor'));
    const User = require(path.join(modelsRoot, 'User'));

    const list = await Prescription.find({ referredToLab: true })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    // Fetch related patient/doctor names in batches
    // Patient and Doctor models use string IDs (UUID). Some prescriptions store doctorId as username.
    // Normalize all ids to strings to handle numbers/ObjectIds gracefully.
    const norm = (v: any) => {
      try { const s = String(v).trim(); return s; } catch { return ''; }
    };
    const isNonEmpty = (s: string) => s.length > 0;
    const patientIds = Array.from(new Set(list.map((p: any) => norm(p.patientId)))).filter(isNonEmpty);
    const doctorIds = Array.from(new Set(list.map((p: any) => norm(p.doctorId)))).filter(isNonEmpty);
    let patients: any[] = [];
    let doctors: any[] = [];
    try {
      if (patientIds.length > 0) {
        patients = await Patient.find({ _id: { $in: patientIds } }).select('name mrNumber _id').lean();
        // Fallback: if some IDs didn't match _id, try mrNumber in the same list
        const foundIds = new Set(patients.map((x: any) => String(x._id)));
        const missing = patientIds.filter(id => !foundIds.has(String(id)));
        if (missing.length > 0) {
          const viaMr = await Patient.find({ mrNumber: { $in: missing } }).select('name mrNumber _id').lean();
          if (viaMr?.length) patients = patients.concat(viaMr);
        }
      }
      if (doctorIds.length > 0) {
        doctors = await Doctor.find({
          $or: [
            { _id: { $in: doctorIds } },      // doctorId is Doctor._id (UUID)
            { username: { $in: doctorIds } },  // doctorId is doctor username
          ]
        }).select('name username _id').lean();

        // Fallback: some prescriptions may store doctorId as User._id
        const foundKeys = new Set<string>(
          doctors.flatMap((d: any) => [String(d._id), String(d.username || '')].filter(Boolean))
        );
        const missing = doctorIds.filter(id => !foundKeys.has(String(id)));
        if (missing.length > 0) {
          const users = await User.find({ $or: [ { _id: { $in: missing } }, { username: { $in: missing } } ] })
            .select('username')
            .lean();
          const usernames = Array.from(new Set(users.map((u: any) => String(u.username)).filter(Boolean)));
          if (usernames.length > 0) {
            const viaUsers = await Doctor.find({ username: { $in: usernames } }).select('name username _id').lean();
            if (viaUsers?.length) doctors = doctors.concat(viaUsers);
          }
        }
      }
    } catch (e: any) {
      console.error('[lab/referrals] lookup error:', e?.message || e);
      patients = [];
      doctors = [];
    }
    type PatientLite = { _id?: any; name?: string; mrNumber?: string };
    type DoctorLite = { _id?: any; name?: string; username?: string };
    const pMap: Map<string, PatientLite> = new Map(
      (patients as PatientLite[]).flatMap((x) => {
        const entries: [string, PatientLite][] = [];
        const idKey = x._id?.toString?.();
        if (idKey) entries.push([idKey, x]);
        if (x.mrNumber) entries.push([String(x.mrNumber), x]);
        return entries;
      })
    );
    const dMap: Map<string, DoctorLite> = new Map(
      (doctors as DoctorLite[]).flatMap((x) => {
        const entries: [string, DoctorLite][] = [];
        const idKey = x._id?.toString?.();
        if (idKey) entries.push([idKey, x]);
        if (x.username) entries.push([String(x.username), x]);
        return entries;
      })
    );

    const referrals = list.map((p: any) => ({
      _id: p._id,
      patientId: p.patientId,
      doctorId: p.doctorId,
      patientName: pMap.get(norm(p.patientId))?.name || '-',
      mrNumber: pMap.get(norm(p.patientId))?.mrNumber || '-',
      doctorName: dMap.get(norm(p.doctorId))?.name || '-',
      testRequested: Array.isArray(p.tests) ? p.tests.join(', ') : '',
      status: 'Pending',
      createdAt: p.createdAt,
    }));

    res.json({ referrals });
  } catch (err: any) {
    console.error('[lab/referrals] handler error:', err?.stack || err?.message || err);
    res.status(500).json({ message: err?.message || 'Failed to load referrals' });
  }
});

export default router;
