# Memory Index

- [Mail Settings Feature](project_mail_settings.md) — Mail settings panel, SMTP DB storage, order notification emails, permissions (mail.settings.view/manage, mail.test.send, order.notifications.manage)
- [Async Order Sync Architecture](project_async_order_sync.md) — Order creation is fully async: POST /orders returns immediately with PENDING_SYNC, worker syncs to SnelStart via BullMQ queue, email sent after sync success via QueueEventsListener
