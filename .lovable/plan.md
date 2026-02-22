

## Changes

### 1. Allow waitlist for Lottery events

Currently the "Enable Waitlist" toggle is only shown when `bookingMode === 'fcfs'` (line 336 in `AvailabilityManager.tsx`). The fix is to remove that condition so the waitlist toggle appears for both FCFS and Lottery modes. The preview text will also be updated to show "Waitlist enabled" for both modes.

### 2. Forgot Password flow

Add a complete password reset workflow:

- **"Forgot password?" link** on the Sign In tab of the Auth page, below the password field
- **Forgot password form**: When clicked, replaces the sign-in form with an email input that calls `supabase.auth.resetPasswordForEmail()` with a redirect to `/reset-password`
- **New `/reset-password` page**: A dedicated page that detects the `type=recovery` token in the URL hash, then shows a "Set new password" form that calls `supabase.auth.updateUser({ password })`
- **New route** in `App.tsx` for `/reset-password`

---

### Technical Details

**Files to modify:**

1. **`src/components/admin/AvailabilityManager.tsx`**
   - Remove the `{bookingMode === 'fcfs' && ...}` conditional around the waitlist toggle (line 336) so it renders for all booking modes
   - Update the preview text condition on line 370 from `waitlistEnabled && bookingMode === 'fcfs'` to just `waitlistEnabled`

2. **`src/pages/Auth.tsx`**
   - Add a `forgotPassword` state to toggle between sign-in and forgot-password views
   - Add a "Forgot password?" link below the password field in the Sign In tab
   - When active, show an email-only form that calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
   - Show a success message after submission telling the user to check their inbox

3. **`src/pages/ResetPassword.tsx`** (new file)
   - On mount, listen for `supabase.auth.onAuthStateChange` with `PASSWORD_RECOVERY` event
   - Show a form with new password + confirm password fields
   - On submit, call `supabase.auth.updateUser({ password })` 
   - On success, redirect to `/` with a success toast

4. **`src/App.tsx`**
   - Import and add a `<Route path="/reset-password" element={<ResetPassword />} />` route

