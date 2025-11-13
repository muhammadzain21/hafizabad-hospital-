"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Notification_1 = __importDefault(require("../lab models/Notification"));
const router = (0, express_1.Router)();
// Auth disabled for notifications: open access
// GET /notification - list notifications, latest first
router.get("/", async (req, res) => {
    try {
        const { limit = 50, unread } = req.query;
        const filter = {};
        if (String(unread).toLowerCase() === 'true')
            filter.read = false;
        const docs = await Notification_1.default.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
        res.json(docs);
        return;
    }
    catch (err) {
        console.error("Failed to fetch notifications", err);
        res.status(500).json({ message: "Failed to fetch notifications" });
        return;
    }
});
// PATCH /notification/:id/read - mark as read
router.patch("/:id/read", async (req, res) => {
    try {
        const notif = await Notification_1.default.findById(req.params.id);
        if (!notif) {
            res.status(404).json({ message: "Notification not found" });
            return;
        }
        notif.read = true;
        await notif.save();
        res.json(notif);
        return;
    }
    catch {
        res.status(500).json({ message: "Failed to update notification" });
        return;
    }
});
exports.default = router;
