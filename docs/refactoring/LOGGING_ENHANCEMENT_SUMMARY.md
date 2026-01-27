# Extensive Logging Enhancement Summary

**Date:** 2026-01-26  
**Status:** ✅ Complete  
**Scope:** Added comprehensive logging to both speakasap-portal shim layer and marathon NestJS service

---

## Overview

Extensive logging has been added throughout both codebases to provide complete visibility into:

- Request/response flow
- Shim layer decisions (enabled/disabled, fallback)
- External service calls
- Database queries
- Error conditions
- Performance metrics (latency, response sizes)

---

## SpeakASAP Portal (Shim Layer) Logging

### Files Enhanced

1. **`marathon/api_views/winners.py`**
   - Winners list endpoint
   - Winner detail endpoint
   - Random report endpoint

2. **`marathon/api_views/common.py`**
   - My marathons list endpoint
   - My marathon detail endpoint
   - Languages endpoint

3. **`marathon/api_views/auth.py`**
   - Registration endpoint

4. **`marathon/reviews/api_views.py`**
   - Reviews endpoint

### Logging Points Added

#### Entry Point Logging

- **When:** At the start of each shim method
- **What:** Method, path, query params, shim enabled status, marathon URL
- **Example:**

  ```python
  logger.info(
      'marathon shim list winners - entry',
      method=request.method,
      path=request.path,
      query_params=dict(request.GET),
      shim_enabled=shim_enabled,
      marathon_url=marathon_url if marathon_url else None,
  )
  ```

#### Fallback Decision Logging

- **When:** When shim is disabled or URL missing
- **What:** Reason for fallback (shim_disabled/no_marathon_url)
- **Example:**

  ```python
  logger.info(
      'marathon shim list winners - using legacy',
      reason='shim_disabled' if not shim_enabled else 'no_marathon_url',
  )
  ```

#### Request Forwarding Logging

- **When:** Before forwarding request to new service
- **What:** Target URL, query params, headers (API key presence)
- **Example:**

  ```python
  logger.info(
      'marathon shim list winners - forwarding request',
      target_url=url,
      query_params=dict(request.GET),
      has_api_key=bool(api_key),
  )
  ```

#### Response Received Logging

- **When:** After receiving response from new service
- **What:** Status code, latency, response size, content type
- **Example:**

  ```python
  logger.info(
      'marathon shim list winners - response received',
      path=url,
      status=response.status_code,
      latency_ms=latency_ms,
      response_size_bytes=response_size,
      content_type=response.headers.get('Content-Type'),
  )
  ```

#### Transformation Logging

- **When:** When transforming response format (e.g., pagination)
- **What:** Original format, transformed format, item counts, pagination details
- **Example:**

  ```python
  logger.info(
      'marathon shim list winners - transformation applied',
      original_format='new',
      transformed_format='drf',
      items_count=len(transformed.get('results', [])),
      total=total,
      has_next=bool(next_page),
      has_previous=bool(prev_page),
  )
  ```

#### Error Logging

- **When:** On exceptions or errors
- **What:** Error message, error type, path, latency, full stack trace
- **Example:**

  ```python
  logger.error(
      'marathon shim list winners failed',
      error=str(error),
      error_type=type(error).__name__,
      path=url,
      latency_ms=latency_ms,
      exc_info=True,
  )
  ```

#### Parameter Mapping Logging

- **When:** When mapping legacy parameters to new service format
- **What:** Legacy parameters, mapped parameters
- **Example:**

  ```python
  logger.info(
      'marathon shim random report - parameter mapping',
      legacy_step=step_id,
      legacy_marathoner=marathoner_id,
      mapped_params=params,
  )
  ```

#### Authentication Logging

- **When:** For authenticated endpoints
- **What:** User ID, authentication status, auth header presence
- **Example:**

  ```python
  logger.info(
      'marathon shim list my marathons - entry',
      user_id=user_id,
      is_authenticated=request.user.is_authenticated,
      has_auth_header=bool(auth_header),
  )
  ```

#### Sensitive Data Masking

- **When:** Logging registration requests
- **What:** Passwords and emails are masked
- **Example:**

  ```python
  request_data_safe = dict(request.data)
  if 'password' in request_data_safe:
      request_data_safe['password'] = '***'
  if 'email' in request_data_safe:
      request_data_safe['email'] = request_data_safe['email'][:3] + '***'
  ```

---

## Marathon NestJS Service Logging

### Files Enhanced

1. **Controllers:**
   - `winners/winners.controller.ts`
   - `answers/answers.controller.ts`
   - `registrations/registrations.controller.ts`
   - `reviews/reviews.controller.ts`
   - `marathons/marathons.controller.ts`
   - `me/me.controller.ts`

2. **Services:**
   - `winners/winners.service.ts`
   - `answers/answers.service.ts`

### Logging Points Added

#### Controller Entry Logging

- **When:** At the start of each controller method
- **What:** Request method, path, query params, path params, IP address
- **Example:**

  ```typescript
  this.logger.log(`Winners list request received: page=${pageNum}, limit=${limitNum}`);
  this.logger.debug(`Request details: ${JSON.stringify({
    method: req?.method,
    path: req?.path,
    query: req?.query,
    ip: req?.ip,
  })}`);
  ```

#### Service Method Logging

- **When:** At the start of service methods
- **What:** Method name, input parameters
- **Example:**

  ```typescript
  this.logger.log(`Winners list service called: page=${pageNum}, limit=${pageSize}, skip=${skip}`);
  ```

#### Database Query Logging

- **When:** Before and after database queries
- **What:** Query filters, result counts, latency
- **Example:**

  ```typescript
  this.logger.debug(`Winners list filters: ${JSON.stringify(medalFilter)}`);
  const dbStartTime = Date.now();
  const [total, winners] = await Promise.all([...]);
  const dbLatency = Date.now() - dbStartTime;
  this.logger.log(`Winners database query completed: total=${total}, found=${winners.length}, latency=${dbLatency}ms`);
  ```

#### External Service Call Logging

- **When:** Before and after external service calls (auth service)
- **What:** Service URL, user ID, response status, latency
- **Example:**

  ```typescript
  this.logger.debug(`Fetching user info from auth service: userId=${userId}, url=${url}`);
  const startTime = Date.now();
  const response = await fetch(url, {...});
  const latency = Date.now() - startTime;
  this.logger.debug(`User info fetched successfully: userId=${userId}, name=${name}, latency=${latency}ms`);
  ```

#### Response Generation Logging

- **When:** After generating response
- **What:** Response details, item counts, pagination info
- **Example:**

  ```typescript
  this.logger.log(`Winners list response: total=${result.total}, items=${result.items.length}, page=${result.page}`);
  ```

#### Error Logging

- **When:** On exceptions or errors
- **What:** Error message, stack trace, context (user ID, IDs)
- **Example:**

  ```typescript
  this.logger.error(
    `Winners list failed: ${error instanceof Error ? error.message : String(error)}`,
    error instanceof Error ? error.stack : undefined,
  );
  ```

#### Business Logic Logging

- **When:** During business logic processing
- **What:** Processing steps, decisions, intermediate results
- **Example:**

  ```typescript
  this.logger.debug(`Fetching user info for ${winners.length} winners`);
  this.logger.debug(`Selected random submission: index=${randomIndex} of ${submissions.length}`);
  ```

#### Sensitive Data Masking

- **When:** Logging registration requests
- **What:** Passwords and emails are masked
- **Example:**

  ```typescript
  const payloadSafe = { ...payload };
  if (payloadSafe.password) {
    payloadSafe.password = '***';
  }
  if (payloadSafe.email) {
    payloadSafe.email = payloadSafe.email.substring(0, 3) + '***';
  }
  ```

---

## Log Levels Used

### Info Level (`logger.info`)

- Request entry points
- Response completion
- Fallback decisions
- Successful operations
- Parameter mappings

### Debug Level (`logger.debug`)

- Detailed request information
- Database query filters
- Intermediate processing steps
- Header information
- Response parsing details

### Warn Level (`logger.warn`)

- Fallback to legacy due to server errors
- Missing data (not found)
- Auth service errors
- Non-critical issues

### Error Level (`logger.error`)

- Exceptions
- Failed operations
- Critical errors
- Includes stack traces (`exc_info=True` or stack parameter)

---

## Performance Metrics Logged

### Latency Tracking

- **Shim Layer:** Request forwarding latency (ms)
- **Marathon Service:** Database query latency, external service call latency
- **Both:** End-to-end request processing time

### Response Size Tracking

- Response content size in bytes
- Item counts (lists, arrays)

### Database Query Metrics

- Query result counts
- Query execution time
- Filter conditions

---

## Security Considerations

### Sensitive Data Masking

- **Passwords:** Always masked as `***`
- **Emails:** Partially masked (first 3 chars + `***`)
- **Auth Tokens:** Not logged (only presence indicated)

### User Privacy

- User IDs logged for authenticated requests (needed for debugging)
- Personal information (names, emails) logged only when necessary for debugging

---

## Logging Patterns

### Consistent Naming

- **Shim Layer:** `marathon shim [endpoint] - [action]`
  - Examples: `marathon shim list winners - entry`, `marathon shim list winners - response received`
- **Marathon Service:** `[Service/Controller] [action]: [details]`
  - Examples: `Winners list request received`, `Winners database query completed`

### Structured Logging

- All logs include relevant context (IDs, parameters, status codes)
- JSON serialization for complex objects in debug logs
- Consistent field names across similar operations

---

## Benefits

1. **Complete Visibility:** Every request and response is logged with full context
2. **Performance Monitoring:** Latency tracking for all operations
3. **Debugging:** Detailed logs help identify issues quickly
4. **Audit Trail:** Full record of all API calls and transformations
5. **Fallback Tracking:** Clear visibility into when and why fallbacks occur
6. **Security:** Sensitive data is masked appropriately

---

## Usage Examples

### Monitoring Shim Activity

```bash
# Check if shim is being used
grep "marathon shim.*entry" /path/to/logs

# Monitor fallbacks
grep "falling back to legacy" /path/to/logs

# Track response times
grep "latency_ms" /path/to/logs | awk '{print $NF}'
```

### Monitoring Marathon Service

```bash
# Check request activity
grep "request received" /path/to/logs

# Monitor database performance
grep "database query completed" /path/to/logs

# Track errors
grep "failed:" /path/to/logs
```

---

## Files Modified

### SpeakASAP Portal

- `marathon/api_views/winners.py` - Enhanced with extensive logging
- `marathon/api_views/common.py` - Enhanced with extensive logging
- `marathon/api_views/auth.py` - Enhanced with extensive logging
- `marathon/reviews/api_views.py` - Enhanced with extensive logging

### Marathon Service

- `src/winners/winners.controller.ts` - Added controller logging
- `src/winners/winners.service.ts` - Enhanced service logging
- `src/answers/answers.controller.ts` - Added controller logging
- `src/answers/answers.service.ts` - Enhanced service logging
- `src/registrations/registrations.controller.ts` - Added controller logging
- `src/reviews/reviews.controller.ts` - Added controller logging
- `src/marathons/marathons.controller.ts` - Added controller logging
- `src/me/me.controller.ts` - Added controller logging

---

**Status:** ✅ Complete - All logging enhancements implemented and ready for production use
