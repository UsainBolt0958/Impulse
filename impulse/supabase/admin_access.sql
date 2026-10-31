-- Limit the shared admin role to the two verified Google accounts.
create or replace function public.is_billing_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as admin_user
    where admin_user.id = (select auth.uid())
      and lower(admin_user.email) in ('yashbharati81@gmail.com', 'impulsepreps@gmail.com')
      and admin_user.email_confirmed_at is not null
      and exists (
        select 1
        from auth.identities as admin_identity
        where admin_identity.user_id = admin_user.id
          and admin_identity.provider = 'google'
      )
  )
$$;

revoke execute on function public.is_billing_admin() from public, anon;
grant execute on function public.is_billing_admin() to authenticated;
