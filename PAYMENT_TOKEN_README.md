# 🚨 PAYMENT TOKEN FLOW - CRITICAL DOCUMENTATION

## ⚠️ MANDATORY READING FOR ADMIN CLIENT CHANGES

**Before modifying token passing logic, you MUST read:**
`../PAYMENT_API_STRUCTURE.md` in the root directory

## Token Flow Responsibility

This admin client is responsible for:
1. **Getting JWT token** from `localStorage.getItem("idToken")`
2. **Passing token** to ticketing website via URL parameter `userToken`
3. **Setting test flags** in postMessage data (`testMode: true`, `adminTest: true`)

## Critical Files

### EventCreate.jsx
```javascript
// Line ~808: Token passing logic
const token = localStorage.getItem("idToken");
if (token) {
  urlParams.set('userToken', token);
  console.log('🧪 Added user token');
}
```

### EventEditTickets.jsx  
```javascript
// Line ~473: Token passing logic (same pattern)
const token = localStorage.getItem("idToken");
if (token) {
  urlParams.set('userToken', token);
  console.log('🧪 Added user token');
}
```

## What Happens Next

1. **Admin client** opens `https://ticket.keeptabs.app/?userToken={token}&...`
2. **Ticketing website** extracts token from URL: `urlParams.get('userToken')`
3. **Ticketing website** uses token in API calls: `Authorization: Bearer {token}`
4. **Payment API** validates token and processes payment

## Common Failures

❌ **No token in localStorage** → API calls fail with 403 Forbidden
❌ **Token not added to URL** → Ticketing website can't authenticate  
❌ **Wrong token format** → API rejects authentication
❌ **Missing test flags** → Auto-fill doesn't work

## Testing the Token Flow

```bash
# Check if token exists in browser
# 1. Open http://localhost:8080/admin/my-events/create
# 2. Open browser console (F12)
# 3. Type: localStorage.getItem("idToken")
# 4. Should return a JWT token string

# Test full flow
# 1. Login to admin client
# 2. Create/edit event  
# 3. Click "Test Purchase"
# 4. Check browser console for "🧪 Added user token" message
# 5. Verify ticketing website receives token
```

## Emergency Debugging

If token flow breaks:
1. **Check login status** - User must be logged in
2. **Check localStorage** - Token must exist and be valid
3. **Check URL generation** - Token must be added to ticketing URL
4. **Check postMessage data** - Test flags must be set
5. **Read full architecture** in `PAYMENT_API_STRUCTURE.md`

**Remember: Without proper token flow, all payments fail!**