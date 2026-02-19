

# Site-Wide Password Gate

## Overview
Add a simple password screen that blocks access to the entire website until the correct password (MMMSGD2027) is entered. This is completely separate from the existing user signup/login system -- it acts as a front door to the site itself.

## How It Works
- When anyone visits the site, they see a password prompt before anything else
- After entering the correct password, access is granted and stored in `sessionStorage` so they don't have to re-enter it on every page navigation
- Closing the browser tab/window clears the session, requiring the password again on next visit
- The existing signup/login flow remains unchanged inside the site

## Security Note
The password is checked client-side, which is appropriate for a simple access gate (not protecting sensitive data beyond what RLS already secures). The password is stored as a hashed constant in the code rather than plaintext for basic obfuscation.

## Technical Details

### New File: `src/components/SitePasswordGate.tsx`
- A full-screen overlay with a password input and submit button
- Compares input against the hardcoded password "MMMSGD2027"
- On success, stores a flag in `sessionStorage` and renders `children`
- On failure, shows an error message

### Modified File: `src/App.tsx`
- Wrap the entire app content inside `<SitePasswordGate>` so every route is gated:

```
<SitePasswordGate>
  <QueryClientProvider ...>
    <AuthProvider>
      ...all routes...
    </AuthProvider>
  </QueryClientProvider>
</SitePasswordGate>
```

### File Summary

| File | Change |
|------|--------|
| `src/components/SitePasswordGate.tsx` | New component -- password prompt UI with sessionStorage persistence |
| `src/App.tsx` | Wrap entire app in `<SitePasswordGate>` |

