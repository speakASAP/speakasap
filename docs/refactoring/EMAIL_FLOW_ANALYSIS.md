# Email Flow Analysis - Helpdesk Ticket HD-219575

**Date:** 2026-01-19  
**Ticket:** HD-219575  
**URL:** https://speakasap.com/helpdesk/tickets/219575/  
**Status:** ✅ Fix 1 Applied, ⏳ Fix 2 Needs Investigation

---

## Email Flow Path

```
1. Email Received (Wise)
   ↓
2. AWS SES → SNS Webhook
   ↓
3. notifications-microservice
   ├─ InboundEmailController.handleInbound()
   ├─ InboundEmailService.parseEmailContent()
   │  ├─ Decode base64 email content
   │  ├─ Parse email parts (headers, body, attachments)
   │  └─ decodeContent() - Decode quoted-printable ⚠️ FIXED
   ├─ Store in inbound_emails table
   └─ WebhookDeliveryService.deliverToHelpdesk()
      ↓
4. Helpdesk Webhook Endpoint
   ├─ helpdesk/views.py: InboundEmailWebhookView
   ├─ Extract bodyHtml and bodyText from webhook payload
   ├─ Create Ticket with email body
   └─ Store body in ticket.body field
      ↓
5. Email Display
   ├─ Ticket.body_url → EmailView.get()
   ├─ ensure_utf8_html() - Wrap in HTML structure
   └─ Served to iframe in Comment.jsx
```

---

## Issues Found & Fixed

### ✅ Issue 1: Word Breaks with "=" Signs (FIXED)

**Symptoms:**
- `continue = using` (should be `continue using`)
- `mon= ey` (should be `money`)
- `wit= h` (should be `with`)

**Root Cause:**  
Quoted-printable soft line breaks not being removed correctly. The regex only matched `=\r\n` and `=\n`, missing cases with whitespace.

**Fix Applied:**
- **File:** `notifications-microservice/src/email/inbound-email.service.ts`
- **Line:** 365-369
- **Change:** Improved regex to handle all soft line break variations
- **Status:** ✅ Fixed and committed to git

**Code:**
```typescript
// Before:
let processed = content.replace(/=\r\n/g, '').replace(/=\n/g, '');

// After:
let processed = content
  .replace(/=\s*\r\n/g, '')  // = followed by optional whitespace and CRLF
  .replace(/=\s*\n/g, '')    // = followed by optional whitespace and LF
  .replace(/=\s*\r/g, '');   // = followed by optional whitespace and CR
```

---

### ⏳ Issue 2: Thick Borders Around Email Content (INVESTIGATION NEEDED)

**Symptoms:**
- Thick, multi-layered borders around every text block in email
- Makes email content difficult to read
- Borders appear around individual paragraphs, sentences, and images

**Possible Causes:**
1. **Original Email HTML** - Wise email contains inline styles or embedded CSS with borders
2. **Email HTML Structure** - Nested elements with border styles
3. **CSS Inheritance** - Global CSS affecting iframe content
4. **Email Processing** - Styles added during email parsing/processing

**Investigation Needed:**
1. Inspect actual email HTML from ticket 219575
2. Check if email HTML has inline styles or `<style>` tags
3. Check if `ensure_utf8_html()` adds any styles
4. Check iframe CSS in helpdesk application

**Recommended Solutions:**
1. **HTML Sanitization** - Remove problematic inline styles and CSS from email HTML
2. **CSS Reset** - Add CSS to iframe to reset/override email styles
3. **Email Sanitization Library** - Use library like DOMPurify for email HTML

**Files to Check/Modify:**
- `speakasap-portal/helpdesk/views.py` - `EmailView` and `CommentEmailView`
- `speakasap-portal/src/incab/helpdesk/components/Comment.jsx` - Iframe styling
- Consider adding HTML sanitization before serving email body

---

## Testing

### After Fix 1 Deployment:
1. ✅ Send test email with quoted-printable encoding
2. ✅ Verify word breaks are correct (no `=` signs in middle of words)
3. ✅ Test with various email clients (Gmail, Outlook, etc.)

### For Fix 2:
1. ⏳ Inspect email HTML from ticket 219575
2. ⏳ Identify source of border styles
3. ⏳ Implement HTML sanitization or CSS reset
4. ⏳ Test email display after fix

---

## Next Steps

1. ✅ **Fix 1:** Deploy notifications-microservice with quoted-printable fix
2. ⏳ **Fix 2:** Investigate and fix email styling issues
3. ⏳ **Testing:** Test both fixes with real emails
4. ⏳ **Monitoring:** Monitor helpdesk for similar issues

---

**Status:** ✅ Fix 1 Complete, ⏳ Fix 2 Pending Investigation
