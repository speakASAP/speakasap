# Email Migration Documentation

## Overview

This document describes the migration of all email communication in the SpeakASAP Django application from direct AWS SES integration to the centralized notifications-microservice. This migration ensures **ALL email notifications from speakasap.com go through the shared notifications-microservice** using AWS SES as the email provider.

## Migration Status

**Status**: ✅ **COMPLETE**

All Django apps have been successfully migrated to use notifications-microservice:

- ✅ **notifications app**: Uses notification client directly
- ✅ **orders app**: Uses `NotificationTemplate.send()` which uses notification client
- ✅ **education app**: Uses `NotificationTemplate.send()` which uses notification client
- ✅ **employees app**: Uses `NotificationTemplate.send()` which uses notification client

## Architecture

### Before Migration

- Direct AWS SES integration via `ses` Django app
- Direct `boto3` SDK calls throughout the codebase
- AWS SES credentials stored in Django settings
- No centralized email management

### After Migration

- All email sending via notifications-microservice API
- Python notification client wrapper for easy integration
- AWS SES credentials configured in notifications-microservice
- Centralized email management and logging
- No direct AWS SES SDK calls in Django codebase

## Email Sending Patterns

### Pattern 1: Using NotificationTemplate (Recommended)

Most Django apps use the `NotificationTemplate` system which automatically uses the notification client:

```python
from notifications.models import NotificationTemplate

# Send email notification
NotificationTemplate.get(
    machine_name='student/course_started',
    default_title='Course Started'
).send(
    user=student.user,
    subject='Your course has started',
    **template_context
)
```

### Pattern 2: Direct Notification Client Usage

For custom email sending, use the notification client directly:

```python
from speakasap.shared.notifications.notification_client import send_email

# Send email
send_email(
    to='user@example.com',
    subject='Order Confirmation',
    message='<html>Your order has been confirmed</html>',
    template_data={
        'orderNumber': '12345',
        'orderTotal': '100.00'
    }
)
```

### Pattern 3: Using NotificationClient Class

For more control, use the `NotificationClient` class:

```python
from speakasap.shared.notifications.notification_client import get_notification_client

client = get_notification_client()
client.send_email(
    to='user@example.com',
    subject='Test Email',
    message='<html>Test message</html>'
)
```

## Environment Configuration

### Required Environment Variables

Add these to your `.env` file:

```bash
# Notification Service URL
NOTIFICATION_SERVICE_URL=https://notifications.statex.cz
# or for local development:
# NOTIFICATION_SERVICE_URL=http://notifications-microservice:3368

# Notification Service Timeout (optional, default: 10 seconds)
NOTIFICATION_SERVICE_TIMEOUT=10
```

### Docker Network Access

When running in Docker, use the service name:

```bash
NOTIFICATION_SERVICE_URL=http://notifications-microservice:3368
```

### Production Access

In production, use the HTTPS URL:

```bash
NOTIFICATION_SERVICE_URL=https://notifications.statex.cz
```

## Apps Migration Details

### Notifications App

**Location**: `notifications/models.py`

**Changes**:

- `Letter.send()` method now uses `get_notification_client().send_email()`
- All email sending goes through notifications-microservice
- No direct AWS SES calls

**Code**:

```python
from speakasap.shared.notifications.notification_client import get_notification_client

def send(self, subject=None, attachments=None):
    notification_client = get_notification_client()
    for recipient in recipients:
        notification_client.send_email(
            to=recipient,
            subject=subject,
            message=self.text,
            attachments=attachments
        )
```

### Orders App

**Location**: `orders/models.py`, `orders/handlers.py`, `orders/tasks.py`

**Changes**:

- All email sending uses `NotificationTemplate.get(...).send()`
- Order confirmations, payment notifications use notification system
- No direct email sending code

**Example**:

```python
NotificationTemplate.get(
    machine_name='student/order_paid',
    default_title='Order Paid'
).send(user=order.user, order=order)
```

### Education App

**Location**: `education/models.py`, `education/tasks.py`, `education/signals/handlers.py`

**Changes**:

- Course notifications use `NotificationTemplate.get(...).send()`
- Lesson reminders, homework notifications use notification system
- No direct email sending code

**Example**:

```python
NotificationTemplate.get(
    machine_name='student/lesson_reminder',
    default_title='Lesson Reminder'
).send(user=student.user, lesson=lesson)
```

### Employees App

**Location**: `employees/models/contracts.py`, `employees/models/common.py`, `employees/tasks.py`

**Changes**:

- Teacher notifications use `NotificationTemplate.get(...).send()`
- Contract notifications use notification system
- No direct email sending code

**Example**:

```python
NotificationTemplate.get(
    machine_name='teacher/contract_created',
    default_title='Contract Created'
).send(user=teacher.user, contract=contract)
```

## Dependencies

### Required

- `requests==2.11.0` (already in requirements.txt)

### Removed

- `boto3` - No longer needed (was only used for AWS SES)

**Note**: If `boto3` is still in requirements.txt but not used for SES, it can be removed. Verify it's not used for other AWS services before removing.

## Verification Checklist

- ✅ No direct AWS SES calls (`boto3.client('ses')`) in codebase
- ✅ No direct Django email sending (`django.core.mail.send_mail()`) in apps
- ✅ All apps use `NotificationTemplate.send()` or notification client
- ✅ `requests` library is in requirements.txt
- ✅ Environment variables configured
- ✅ Notification client is Python 3.4+ compatible (no f-strings, uses `.format()`)

## Testing

### Manual Testing

1. **Test Notification App Email**:
   - Send test email from Django admin
   - Verify email arrives correctly
   - Check email content is correct

2. **Test Order Confirmations**:
   - Create a test order
   - Verify order confirmation email is sent
   - Check email contains correct order details

3. **Test Course Notifications**:
   - Trigger course start notification
   - Verify email is sent to student
   - Check email contains course information

4. **Test Teacher Notifications**:
   - Trigger teacher assignment notification
   - Verify email is sent to teacher
   - Check email contains assignment details

### Integration Testing

- Test end-to-end email flows
- Verify all email types work correctly
- Check email delivery in production
- Monitor notification service logs

## Troubleshooting

### Email Not Sending

1. **Check Notification Service URL**:

   ```bash
   echo $NOTIFICATION_SERVICE_URL
   ```

2. **Test Notification Service Connection**:

   ```bash
   curl https://notifications.statex.cz/health
   ```

3. **Check Logs**:
   - Check Django application logs for email sending errors
   - Check notifications-microservice logs
   - Check centralized logging microservice

### Common Issues

**Issue**: `requests.RequestException` when sending email

- **Solution**: Verify `NOTIFICATION_SERVICE_URL` is correct and service is accessible

**Issue**: Email sent but not received

- **Solution**: Check notifications-microservice logs, verify AWS SES configuration

**Issue**: Template variables not working

- **Solution**: Ensure `template_data` dict is passed correctly to `send_email()`

## Rollback Procedures

If issues occur, the migration can be rolled back:

1. **Temporary Rollback**:
   - Revert to direct AWS SES calls in `ses` app
   - Update `Letter.send()` to use `ses` app directly
   - Keep notification client for future use

2. **Full Rollback**:
   - Revert all changes to apps
   - Restore direct AWS SES integration
   - Remove notification client usage

**Note**: Rollback should only be used in emergency situations. The notification service approach is the recommended architecture.

## Python 3.4 Compatibility

The notification client is fully compatible with Python 3.4+:

- ✅ No f-strings (uses `.format()` instead)
- ✅ No type hints in function signatures
- ✅ Uses `%` formatting where appropriate
- ✅ Compatible with Python 3.4, 3.5, 3.6, 3.7+

## Future Improvements

1. **Email Templates**: Consider moving email templates to notifications-microservice
2. **Email Queue**: Implement email queue for better reliability
3. **Email Analytics**: Add email open/click tracking
4. **Multi-Provider**: Support multiple email providers (SendGrid, Mailgun, etc.)

## Related Documentation

- [Email Refactoring Overview](./EMAIL_REFACTORING.md)
- [Agent 4 Instructions](./AGENT4_OTHER_APPS_EMAIL.md)
- [Agent Coordination](./AGENT_COORDINATION.md)

## Summary

✅ **Migration Complete**: All email communication from speakasap.com now goes through notifications-microservice
✅ **No Direct AWS SES**: All direct AWS SES calls have been removed
✅ **Centralized Management**: All emails are managed via shared microservice
✅ **Python 3.4 Compatible**: Notification client works with Python 3.4+
✅ **Documentation**: Complete migration documentation created

---

**Last Updated**: 2025-01-29
**Migration Completed By**: Agent 4
**Status**: ✅ Complete

## Agent 4 Completion Summary

**Checkpoint 3 Achieved**: ✅ Notification client verified for Python 3.4 compatibility

### Verification Results

✅ **Task 4.1**: Notifications app - Already using `NotificationTemplate.send()` which uses notification client
✅ **Task 4.2**: Orders app - Already using `NotificationTemplate.get(...).send()` for all email sending
✅ **Task 4.3**: Education app - Already using `NotificationTemplate.get(...).send()` for course notifications
✅ **Task 4.4**: Employees app - Already using `NotificationTemplate.get(...).send()` for teacher notifications
✅ **Task 4.5**: No direct AWS SES dependencies found - No `boto3` imports or AWS SES calls in codebase
✅ **Task 4.6**: Requirements.txt verified - No `boto3` dependency, `requests==2.11.0` present
✅ **Task 4.7**: Migration documentation updated

### Python 3.4 Compatibility Verification

The notification client (`speakasap/shared/notifications/notification_client.py`) is fully Python 3.4 compatible:

- ✅ No f-strings (uses `.format()` method)
- ✅ No type hints in function signatures
- ✅ Uses `%` formatting where appropriate
- ✅ Compatible with Python 3.4, 3.5, 3.6, 3.7+

### Environment Variables

Environment variables are configured in `portal/local_settings_default.py`:

- `NOTIFICATION_SERVICE_URL` - Defaults to `https://notifications.statex.cz`
- `NOTIFICATION_SERVICE_TIMEOUT` - Defaults to `10` seconds

These can be overridden via `.env` file or environment variables.

### Final Status

**All Agent 4 tasks complete**: ✅

- All Django apps (notifications, orders, education, employees) use notifications-microservice
- No direct AWS SES calls remain in codebase
- No `boto3` dependency in requirements.txt
- Notification client is Python 3.4 compatible
- Documentation is complete and up-to-date
