# Supabase runtime keys

The Eutaktos server runtime accepts the modern Supabase server-only secret key format (`sb_secret_...`) and the legacy service-role JWT format.

Preferred server-only variables:

- `EUTAKTOS_SUPABASE_URL` or server-only alias `SUPABASE_URL`
- `EUTAKTOS_SUPABASE_SECRET_KEY` or server-only alias `SUPABASE_SECRET_KEY`

Legacy compatibility remains available through `EUTAKTOS_SUPABASE_SERVICE_ROLE_KEY`.

Modern `sb_secret_...` keys are sent only in the `apikey` header. They are never placed in browser variables and are never committed to the repository. Legacy JWT service-role keys retain the required Bearer authorization behavior.

Do not use `NEXT_PUBLIC_*` or `VITE_*` for server secrets.
