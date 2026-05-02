# Skye Mail Vault — Full Gmail Command Center Hardening Pass

This pass pushes the mailbox closer to a real client-offerable Gmail command center while preserving the SkyeEmail1st visual lane.

What is upgraded in this pack:
- Real Google Contacts sync via the People API
- Save/edit Google Contacts from inside the contacts page
- Copy Gmail-discovered `Other contacts` into writable My Contacts before editing
- Verified send-as alias selection in Compose
- Attachment support for send and draft save
- Draft attachment preservation for smaller existing draft attachments
- Preferred alias storage in settings
- Gmail vacation responder read/update in settings
- Existing Gmail inbox, drafts, threads, push watch, bulk actions, and mailbox pages stay in place

## Repo integration methodology

1. Run `sql/schema.sql` against Neon before deploy. This adds the contact-sync and alias-preference columns.
2. In Google Cloud, make sure **both** the Gmail API and the **People API** are enabled for the same OAuth client.
3. Keep the existing Netlify environment variables from `.env.template`.
4. Reconnect the Google mailbox once after deploy so the new People/contact scopes are granted.
5. Deploy through Git. This pack depends on Netlify Functions and the scheduled Gmail watch renewal lane.

## Operational reality

This build is now a much more complete **Gmail-backed email workspace**. It is suitable as a branded mailbox dashboard layer for clients who connect Google mailboxes.

It is still not a standalone mail-hosting provider by itself. The mailbox authority remains Gmail / Google Workspace; this app is the branded command center, workflow shell, and client-facing mail surface on top of that.
