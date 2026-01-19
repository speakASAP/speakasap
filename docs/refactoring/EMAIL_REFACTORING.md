# Email Communication Refactoring

**Objective**: Migrate **ALL email communication** in legacy SpeakASAP Django application to use centralized notifications-microservice. This includes helpdesk email sending/receiving (customer-facing, uses AWS), ses app (core email infrastructure), and all other Django apps that send emails. **ALL email communications from speakasap.com must be managed via the shared notifications-microservice.**

---

## Overview

This refactoring migrates all email communication in the legacy SpeakASAP Django application from direct AWS SES integration to the centralized notifications-microservice. This provides:

- **Centralized Email Management**: All email communication goes through notifications-microservice
- **Multi-Provider Support**: Can use AWS SES or SendGrid via notifications-microservice
- **Consistent API**: Single API for all email operations
- **Better Monitoring**: Centralized logging and tracking of all emails
- **Easier Maintenance**: Single codebase for email functionality

## Research & Implementation Plan

### Current Architecture Analysis

**Legacy SpeakASAP Email System**:

- Uses AWS SES directly via `ses` Django app
- Helpdesk sends/receives customer emails via AWS SES
- Other Django apps (notifications, orders, education, employees) send emails via AWS SES
- Direct AWS SES SDK calls (`boto3`) throughout the codebase
- AWS SES SNS webhook for receiving emails (configured in AWS console)

**notifications-microservice Current State**:

- Supports SendGrid only (`@sendgrid/mail`)
- Email sending only (no receiving capability)
- Used by flipflop-service and allegro-service
- REST API: `POST /notifications/send`
- No AWS SES support
- No inbound email handling

### Target Architecture

**notifications-microservice Extended**:

- Multi-provider support: SendGrid + AWS SES
- Provider selection via environment variable or per-request parameter
- Inbound email receiving via AWS SES SNS webhook
- Email storage and processing for inbound emails
- Backward compatible with existing SendGrid usage

**Legacy SpeakASAP Refactored**:

- All email sending via notifications-microservice API
- All email receiving via notifications-microservice inbound webhook
- Python notification client wrapper for easy integration
- No direct AWS SES SDK calls
- Gradual migration path (app by app)

### Implementation Strategy

**Phase 1: Extend notifications-microservice** (Agent 1):

1. Add AWS SES SDK dependency (`@aws-sdk/client-ses`)
2. Extend email service with AWS SES sending support
3. Add provider selection logic (SendGrid/SES/auto)
4. Create inbound email entity and service
5. Create inbound email controller with SNS webhook endpoint
6. Update DTO to support `emailProvider` parameter
7. Update environment variables and documentation

**Phase 2: Create Foundation** (Agent 2):

1. Create Python notification client for Django apps
2. Add environment variables for notification service URL
3. Refactor `ses` Django app to use notification client
4. Remove direct AWS SES calls from `ses` app

**Phase 3: Migrate Helpdesk** (Agent 3):

1. Refactor helpdesk email sending to use notification client
2. Refactor helpdesk email receiving to use notifications-microservice
3. Update webhook handlers to forward to notifications-microservice
4. Test helpdesk email flow end-to-end

**Phase 4: Migrate Other Apps** (Agent 4):

1. Refactor notifications app email sending
2. Refactor orders app email confirmations
3. Refactor education app course notifications
4. Refactor employees app teacher notifications
5. Remove all direct AWS SES dependencies
6. Update requirements.txt
7. Create migration documentation

### Technical Details

**AWS SES Integration**:

- AWS SES sending: Use `@aws-sdk/client-ses` SDK
- AWS SES receiving: AWS SES SNS webhook → notifications-microservice `/email/inbound`
- SNS message structure: `{ Type: 'Notification', Message: '{...}' }`
- SES notification in Message field (JSON string)
- Email content extraction from SES notification

**Python Notification Client**:

- HTTP client using `requests` library
- Singleton pattern for easy usage
- Error handling and retries
- Timeout configuration
- Always uses `emailProvider: 'ses'` for SpeakASAP emails

**Migration Path**:

- Gradual migration: App by app, not all at once
- Dual-write period: Can keep AWS SES credentials during migration
- Testing: Test each app after refactoring
- Rollback: Can rollback individual apps if needed

### Success Criteria

**After Migration**:

- ✅ All email sending goes through notifications-microservice
- ✅ All email receiving goes through notifications-microservice
- ✅ No direct AWS SES SDK calls remain in codebase
- ✅ Helpdesk email sending/receiving works correctly
- ✅ All Django apps send emails via notification client
- ✅ notifications-microservice supports both SendGrid and AWS SES
- ✅ Inbound email webhook works correctly
- ✅ Documentation is complete

---

## Agent Structure

The refactoring is split into **4 autonomous AI agents** working in parallel:

### Agent 1: notifications-microservice Extension

- **File**: `AGENT1_NOTIFICATIONS_MICROSERVICE.md`
- **Focus**: Add AWS SES support and inbound email handling to notifications-microservice
- **Location**: `notifications-microservice/`
- **Tasks**: 11 tasks (1.1-1.11)
- **Dependencies**: None (can start immediately)

### Agent 2: Core Infrastructure & SES App

- **File**: `AGENT2_LEGACY_SPEAKASAP.md`
- **Focus**: Create Python notification client and refactor core `ses` Django app
- **Location**: `speakasap-portal/` (legacy)
- **Tasks**: 3 tasks (2.1-2.3)
- **Dependencies**: Agent 1 Tasks 1.1-1.5

### Agent 3: Helpdesk Email Refactoring

- **File**: `AGENT3_HELPDESK_EMAIL.md`
- **Focus**: Refactor helpdesk email sending and receiving
- **Location**: `speakasap-portal/helpdesk/` (legacy)
- **Tasks**: 2 tasks (3.1-3.2)
- **Dependencies**: Agent 1 Task 1.8, Agent 2 Task 2.3

### Agent 4: Other Django Apps Email Refactoring

- **File**: `AGENT4_OTHER_APPS_EMAIL.md`
- **Focus**: Refactor email in notifications, orders, education, employees apps
- **Location**: `speakasap-portal/` (legacy)
- **Tasks**: 7 tasks (4.1-4.7)
- **Dependencies**: Agent 2 Task 2.3

---

## Execution Phases

### Phase 1: Independent Work (Parallel)

- **Agent 1**: All tasks (1.1-1.11)
- **Agent 2**: Tasks 2.1-2.2 (can start immediately)

**Status**: ✅ Can run completely in parallel

### Phase 2: Agent 2 Core Work

- **Agent 1**: Must complete Tasks 1.1-1.5
- **Agent 2**: Can start Task 2.3

**Status**: ⚠️ Agent 2 waits for Agent 1

### Phase 3: Agent 3 & Agent 4 Parallel Work

- **Agent 1**: Must complete Task 1.8 (for Agent 3)
- **Agent 2**: Must complete Task 2.3
- **Agent 3**: Can start all tasks (3.1-3.2)
- **Agent 4**: Can start all tasks (4.1-4.7)

**Status**: ⚠️ Agents 3 and 4 wait for Agent 2

---

## Key Dependencies

### Critical Path

1. **Agent 1 Tasks 1.1-1.5** → Enables Agent 2 Task 2.3
2. **Agent 2 Task 2.3** → Enables Agent 3 and Agent 4
3. **Agent 1 Task 1.8** → Enables Agent 3 Task 3.2

### Dependency Graph

```text
Agent 1 (1.1-1.5) ───┐
                     ├──> Agent 2 (2.3) ──┬──> Agent 3 (all)
Agent 1 (1.8) ───────┘                    └──> Agent 4 (all)
```

---

## Success Criteria

### Agent 1 Success

- ✅ AWS SES sending works
- ✅ Provider selection works
- ✅ Inbound email webhook works
- ✅ SendGrid sending works (if used)

### Agent 2 Success

- ✅ Notification client created and working
- ✅ ses app refactored to use notifications-microservice
- ✅ No direct AWS SES calls in ses app

### Agent 3 Success

- ✅ Helpdesk email sending via notifications-microservice
- ✅ Helpdesk email receiving via notifications-microservice
- ✅ No direct AWS SES calls in helpdesk app
- ✅ Ticket creation from emails works

### Agent 4 Success

- ✅ All email sending via notifications-microservice
- ✅ No direct AWS SES calls remain
- ✅ All email types function correctly

### Combined Success

- ✅ End-to-end email flow works
- ✅ No email delivery failures
- ✅ Documentation complete

---

## Files Modified

### Agent 1 Files

- `notifications-microservice/src/email/email.service.ts`
- `notifications-microservice/src/email/inbound-email.service.ts` (NEW)
- `notifications-microservice/src/email/inbound-email.controller.ts` (NEW)
- `notifications-microservice/src/email/entities/inbound-email.entity.ts` (NEW)
- `notifications-microservice/src/notifications/dto/send-notification.dto.ts`
- `notifications-microservice/src/notifications/entities/notification.entity.ts`
- `notifications-microservice/package.json`
- `notifications-microservice/.env.example`
- `notifications-microservice/README.md`

### Agent 2 Files

- `speakasap/shared/notifications/notification_client.py` (NEW)
- `speakasap-portal/ses/**/*.py` (legacy)
- `speakasap-portal/.env` (or legacy project `.env`)

### Agent 3 Files

- `speakasap-portal/helpdesk/**/*.py` (legacy)

### Agent 4 Files

- `speakasap-portal/notifications/**/*.py` (legacy)
- `speakasap-portal/orders/**/*.py` (legacy)
- `speakasap-portal/education/**/*.py` (legacy)
- `speakasap-portal/employees/**/*.py` (legacy)
- `speakasap-portal/requirements.txt` (legacy)
- `speakasap/docs/email_migration.md` (NEW)

---

## Communication Protocol

### Checkpoints

1. **Checkpoint 1**: Agent 1 completes Tasks 1.1-1.5 → Agent 2 can start Task 2.3
2. **Checkpoint 2**: Agent 1 completes Task 1.8 → Agent 3 can start Task 3.2
3. **Checkpoint 3**: Agent 2 completes Task 2.3 → Agent 3 and Agent 4 can start
4. **Checkpoint 4**: All agents complete → Integration testing begins

### Reporting

- Each agent reports completion of each task
- Agents report any issues or missing functionality
- Agents coordinate through `AGENT_COORDINATION.md`

---

## Important Notes

1. **CRITICAL GOAL**: **ALL email communication from speakasap.com must go through notifications-microservice.** This includes:
   - Helpdesk email sending/receiving (customer-facing, currently uses AWS SES)
   - All notifications sent to customers, managers, teachers, etc.
   - All email from ses app (core email infrastructure)
   - All email from other Django apps (notifications, orders, education, employees)
   - **NO exceptions** - every email must go through notifications-microservice

2. **No Backward Compatibility Required**: Function signatures can be changed as needed. API contracts can be updated. Refactor freely to achieve the goal. **No need to maintain old function signatures, API contracts, or existing behavior.**

3. **Notifications Microservice Requirements**:
   - Must have email capabilities (sending and receiving)
   - Must connect to AWS to send all emails
   - Must support AWS SES for sending emails
   - Must support AWS SES SNS webhook for receiving emails
   - All email communications from speakasap.com must be managed via this shared microservice

4. **Refactor Freely**: All agents can refactor code without maintaining backward compatibility. Focus on achieving the goal: **ALL email communication goes through notifications-microservice.**

5. **Gradual Migration**: Migration happens incrementally, not all at once. Each agent works on their part independently.

6. **Testing**: Test each app's email functionality after refactoring. Test in practice and fix bugs on the fly. No automated tests required.

7. **Documentation**: Document all changes made. Update README files, add migration notes, document API changes.

8. **Logging**: Use extensive logging via centralized logging microservice for all email operations.

9. **Error Handling**: Handle errors gracefully and provide meaningful error messages.

10. **Critical Path**: Helpdesk email is critical - it's customer-facing and uses AWS to send/receive messages. Ensure helpdesk email sending and receiving work correctly.

11. **Final Goal**: After migration, **NO direct AWS SES calls should remain in the codebase.** All email must go through notifications-microservice.

---

## Research Summary

### AWS SES Integration Details

**Sending Emails via AWS SES**:

- Use `@aws-sdk/client-ses` SDK (v3) for Node.js/TypeScript
- Required credentials: `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`
- Use `SendEmailCommand` for simple emails
- Use `SendRawEmailCommand` for emails with attachments or custom headers
- Support both text and HTML content

**Receiving Emails via AWS SES**:

- AWS SES sends notifications via Amazon SNS (Simple Notification Service)
- Configure SNS topic in AWS SES console to send to webhook endpoint
- SNS message structure: `{ Type: 'Notification', Message: '{...}' }`
- The `Message` field contains a JSON string with SES notification
- SES notification structure: `{ mail: {...}, receipt: {...}, content: '...' }`
- Email content is base64 encoded in `content` field
- Parse email headers, body, attachments from content

**SNS Webhook Handling**:

- Handle `SubscriptionConfirmation` type for initial SNS subscription
- Handle `Notification` type for actual email notifications
- Validate SNS message signature (optional but recommended)
- Extract SES notification from SNS Message field
- Parse email content from SES notification

### Python Notification Client Design

**Requirements**:

- HTTP client using `requests` library
- Singleton pattern for easy usage
- Error handling with retries
- Timeout configuration
- Always use `emailProvider: 'ses'` for SpeakASAP emails
- Support for attachments (if needed)
- Support for template data

**Implementation**:

- Use environment variables in .env for service URL and timeout
- Handle network errors gracefully
- Log all email operations
- Return consistent response format

### Migration Strategy

**Gradual Migration Approach**:

1. Extend notifications-microservice first (Agent 1)
2. Create Python client and refactor ses app (Agent 2)
3. Migrate helpdesk (Agent 3) - critical customer-facing functionality
4. Migrate other apps (Agent 4) - notifications, orders, education, employees

**Testing Strategy**:

- Test each app after refactoring
- Test end-to-end email flows
- Test both sending and receiving
- Test with real emails if possible
- Fix bugs on the fly

**Rollback Strategy**:

- Keep AWS SES credentials during migration
- Can rollback individual apps if needed
- Can switch back to direct AWS SES if critical issues occur

## Next Steps

1. **Review Instructions**: All agents should review their respective instruction files
2. **Start Phase 1**: Agent 1 and Agent 2 (Tasks 2.1-2.2) can start immediately
3. **Monitor Progress**: Track progress through coordination document
4. **Integration Testing**: After all agents complete, perform end-to-end testing
