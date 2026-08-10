# Purchase order viewer role

The application reserves the trusted Supabase `app_metadata` role `viewer` for accounts that may only:

- Open the purchase order list.
- Search, filter, sort, and refresh the list.
- Open a purchase order detail.
- Open the current stored PDF.

The role cannot upload or delete a PO, edit its status or note, email vendor issues, or add/update QuickBooks lines.

## Assign the role

Replace the email and run this as an administrator in the Supabase SQL editor:

```sql
update auth.users
set raw_app_meta_data = jsonb_set(
  coalesce(raw_app_meta_data, '{}'::jsonb),
  '{roles}',
  '["viewer"]'::jsonb,
  true
)
where lower(email) = lower('viewer@example.com')
returning id, email, raw_app_meta_data -> 'roles' as roles;
```

The user must sign out and sign in again after the change so Supabase issues a JWT with the new `app_metadata` claim.

Authorization must never be assigned through `user_metadata`: authenticated users can edit that metadata themselves.

## n8n webhooks

The frontend blocks mutation webhooks for a viewer before sending a request. Each n8n mutation webhook must also validate the Supabase bearer token and reject a JWT whose `app_metadata.role` is `viewer` or whose `app_metadata.roles` contains `viewer`. This is required because a caller can invoke a public webhook without using the application UI.
