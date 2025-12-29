import { Router } from 'express';
import webhookController from '../controllers/webhookController';

const router = Router();

// Health check
router.get('/health', webhookController.healthCheck.bind(webhookController));

// WhatsApp webhook verification (GET)
router.get('/webhook', webhookController.verifyWebhook.bind(webhookController));

// WhatsApp webhook handler (POST)
router.post('/webhook', webhookController.handleWebhook.bind(webhookController));

// Admin/testing endpoints
router.get('/conversation/:phoneNumber', webhookController.getConversationHistory.bind(webhookController));
router.post('/send-message', webhookController.sendManualMessage.bind(webhookController));

export default router;

