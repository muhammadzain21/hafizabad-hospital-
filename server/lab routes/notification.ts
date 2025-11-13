import { Router } from "express";
import Notification from "../lab models/Notification";

const router = Router();

// Auth disabled for notifications: open access

// GET /notification - list notifications, latest first
router.get("/", async (req: any, res: any) => {
  try {
    const { limit = 50, unread } = req.query as any;
    const filter: any = {};
    if (String(unread).toLowerCase() === 'true') filter.read = false;

    const docs = await Notification.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    res.json(docs);
    return;
  } catch (err) {
    console.error("Failed to fetch notifications", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
    return;
  }
});

// PATCH /notification/:id/read - mark as read
router.patch("/:id/read", async (req: any, res: any) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }
    notif.read = true;
    await notif.save();
    res.json(notif);
    return;
  } catch {
    res.status(500).json({ message: "Failed to update notification" });
    return;
  }
});

export default router;
