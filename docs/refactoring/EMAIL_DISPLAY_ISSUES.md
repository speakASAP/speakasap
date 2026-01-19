# Email Display Issues in Helpdesk - Analysis

**Date:** 2026-01-19  
**Ticket:** HD-219575  
**URL:** https://speakasap.com/helpdesk/tickets/219575/  
**Status:** 🔍 Issues Identified

---

## Issues Found

### 1. ❌ Word Breaks with "=" Signs

**Problem:**  
Customer emails are displaying with incorrect word breaks, showing patterns like:
- `continue = using` (should be `continue using`)
- `mon= ey` (should be `money`)
- `wit= h` (should be `with`)

**Root Cause:**  
Quoted-printable email encoding is not being decoded correctly. In quoted-printable encoding:
- A line ending with `=` indicates a soft line break (the line continues on the next line)
- The `=` and line break should be removed during decoding
- Current implementation in `notifications-microservice/src/email/inbound-email.service.ts` (line 366) only removes `=\r\n` and `=\n`, but may miss other variations

**Location:**  
`notifications-microservice/src/email/inbound-email.service.ts` - `decodeContent()` method

**Current Code:**
```typescript
// Step 1: Remove soft line breaks (= followed by CRLF or LF)
let processed = content.replace(/=\r\n/g, '').replace(/=\n/g, '');
```

**Issue:**  
The regex may not catch all cases:
- Lines with trailing whitespace: `= \r\n` or `= \n`
- Different line ending formats
- Cases where the `=` is followed by spaces before the newline

---

### 2. ❌ Strange Styling - Thick Borders Around Text

**Problem:**  
Email content is displayed with thick, multi-layered borders around every text block, making it difficult to read.

**Root Cause Analysis:**  
Email content is displayed in an iframe (`Comment.jsx` uses `<IframeStyled src={comment.body_url}/>`). The borders could be coming from:

1. **Email HTML itself** - The original email from Wise might have inline styles or embedded CSS
2. **Iframe styling** - CSS applied to the iframe or its content
3. **Email sanitization/processing** - Additional styles being added during processing

**Location:**  
- `speakasap-portal/src/incab/helpdesk/components/Comment.jsx` - Email rendering
- Email body URL generation (need to check where `comment.body_url` is created)

**Investigation Needed:**
- Check what CSS is being applied to the iframe content
- Check if email HTML is being sanitized/modified during processing
- Check if there are global styles affecting iframe content

---

## Email Flow

1. **Email Received** → AWS SES SNS webhook → `notifications-microservice`
2. **Email Parsed** → `InboundEmailService.parseEmailContent()` → Decodes quoted-printable
3. **Email Stored** → Saved to `inbound_emails` table with `bodyHtml` and `bodyText`
4. **Webhook to Helpdesk** → `notifications-microservice` sends webhook to helpdesk
5. **Helpdesk Receives** → `helpdesk/views.py` receives webhook with `bodyHtml`/`bodyText`
6. **Ticket Created** → Email body stored in ticket
7. **Email Displayed** → React component `Comment.jsx` renders email in iframe

---

## Fixes Required

### Fix 1: Improve Quoted-Printable Decoding

**File:** `notifications-microservice/src/email/inbound-email.service.ts`

**Change:** Improve soft line break removal to handle all cases:

```typescript
// Current (line 366):
let processed = content.replace(/=\r\n/g, '').replace(/=\n/g, '');

// Improved:
// Remove soft line breaks: = at end of line (with optional whitespace before newline)
// Handle: =\r\n, =\n, = \r\n, = \n, =\r, etc.
let processed = content
  .replace(/=\s*\r\n/g, '')  // = followed by optional whitespace and CRLF
  .replace(/=\s*\n/g, '')    // = followed by optional whitespace and LF
  .replace(/=\s*\r/g, '');   // = followed by optional whitespace and CR (just in case)
```

### Fix 2: Investigate and Fix Styling Issues

**Steps:**
1. Check what CSS is applied to iframe content
2. Check if email HTML is being modified during processing
3. Add CSS to sanitize/reset email styles if needed
4. Consider using a safer email rendering approach (sanitized HTML instead of iframe)

---

## Testing

After fixes:
1. Send a test email with quoted-printable encoding
2. Verify word breaks are correct (no `=` signs in middle of words)
3. Verify email styling is clean (no thick borders)
4. Test with various email clients (Gmail, Outlook, etc.)

---

**Status:** ✅ Fix 1 Complete - Fix 2 Needs Investigation

---

## Fixes Applied

### ✅ Fix 1: Quoted-Printable Decoding (COMPLETED)

**File:** `notifications-microservice/src/email/inbound-email.service.ts`  
**Line:** 366

**Change Applied:**
```typescript
// Before:
let processed = content.replace(/=\r\n/g, '').replace(/=\n/g, '');

// After:
let processed = content
  .replace(/=\s*\r\n/g, '')  // = followed by optional whitespace and CRLF
  .replace(/=\s*\n/g, '')    // = followed by optional whitespace and LF
  .replace(/=\s*\r/g, '');   // = followed by optional whitespace and CR
```

**Status:** ✅ Fixed in codebase  
**Next:** Deploy to production and test

---

### ⏳ Fix 2: Email Styling Issues (INVESTIGATION NEEDED)

**Issue:** Thick, multi-layered borders around email content blocks

**Investigation Findings:**
- Email content is displayed in an iframe (`Comment.jsx` uses `<IframeStyled src={comment.body_url}/>`)
- Email body is served via `EmailView` and `CommentEmailView` in `helpdesk/views.py`
- `ensure_utf8_html()` function wraps email body but doesn't add borders
- Borders likely come from:
  1. Original email HTML (Wise email) having inline styles or embedded CSS
  2. Email HTML containing nested elements with border styles
  3. Global CSS affecting iframe content

**Recommended Solutions:**
1. **Sanitize email HTML** - Remove or override problematic inline styles and CSS
2. **Add CSS reset** - Apply CSS to iframe content to reset/override email styles
3. **Use email sanitization library** - Consider using a library like `DOMPurify` or similar

**Files to Modify:**
- `speakasap-portal/helpdesk/views.py` - `EmailView` and `CommentEmailView` classes
- Consider adding HTML sanitization before serving email body

**Next Steps:**
1. Inspect actual email HTML from ticket 219575 to identify border source
2. Add HTML sanitization to remove problematic styles
3. Test with various email clients
