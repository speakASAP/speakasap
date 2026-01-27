# SpeakASAP Refactoring Roadmap

**Created**: 2025-01-XX  
**Last Updated**: 2025-01-29  
**Status**: Planning Phase - Comprehensive Analysis Complete - Marathon Service Separated - Analytics Out of Scope - Monitoring Out of Scope - Testing Out of Scope - Telegram Bot in Shared Service - AI-Teacher Core Feature Added - Platform Extension: Dual-Purpose Marketplace (Teachers + Learners)  
**Domain**: Language Learning E-Learning Platform (<https://speakasap.com>)  
**Legacy Project**: `/Users/sergiystashok/Documents/GitHub/speakasap-portal`  
**Target Project**: `/Users/sergiystashok/Documents/GitHub/statex.cz/speakasap`

---

## Executive Summary

This roadmap outlines the complete refactoring strategy for migrating the legacy Django monolith (`speakasap-portal`) into a modern microservices architecture integrated with the statex.cz ecosystem. The refactoring will transform speakasap.com into a cutting-edge, scalable platform using modern technologies and shared microservices. **AI-teacher is a core feature** that will be integrated into the education process, providing AI-powered chat, personal learning roadmaps, and pronunciation training.

**Platform Vision**: The refactored platform will be extended to serve as a **dual-purpose language learning marketplace**:

- **For Teachers**: A platform where language teachers can offer their teaching services, create courses, manage students, and build their teaching business
- **For Learners**: A platform where people can learn languages through multiple pathways:
  - **AI-powered learning**: Self-paced learning with AI-teacher (chat, personal roadmaps, pronunciation training)
  - **Human teacher learning**: Learn with professional human teachers through live lessons, courses, and personalized instruction
- **Goal**: Build an attractive, modern platform that attracts both teachers and learners, providing flexible learning options and teaching opportunities

**Current State**: Legacy Django monolith with 40+ Django apps  
**Target State**: Modern microservices architecture (10 speakasap microservices) using NestJS, Next.js, and shared statex.cz infrastructure. **helpdesk-microservice** will be built separately as a shared microservice for the entire ecosystem.  
**Port Range**: 42xx (speakasap application)  
**Note**: `marathon` app will be extracted as a **separate marathon-service** (outside speakasap) for all kinds of fast learning programs, not just language learning  
**Note**: Analytics is **out of scope** - obsolete features (`big_brother`, `actions`) will not be refactored, analytics will be created from scratch later  
**Note**: Monitoring is **out of scope** - will be built as a separate shared monitoring microservice in the shared environment, not part of speakasap refactoring  
**Note**: Testing is **out of scope** - we test in practice and fix bugs on the fly. No automated tests, unit tests, integration tests, or load tests will be created.

### Key Findings

1. **Microservices Decomposition**: The platform will be split into **10 speakasap microservices** (8 backend + 2 frontend) based on domain-driven design principles. Additionally, `marathon` app will be extracted as a **separate marathon-service** for all kinds of fast learning (not just language learning). **Analytics is out of scope** - obsolete features will not be refactored, analytics will be created from scratch later. **helpdesk-microservice** will be built separately from scratch as a shared microservice for the entire statex.cz ecosystem (current `helpdesk` app is obsolete and out of scope). **Testing is out of scope** - we test in practice and fix bugs on the fly. No automated tests will be created. **Testing is out of scope** - we test in practice and fix bugs on the fly. No automated tests will be created.
2. **Shared Microservices Integration**: Will leverage **8 critical shared microservices** from statex.cz ecosystem:
   - auth-microservice (authentication)
   - database-server (PostgreSQL + Redis)
   - logging-microservice (centralized logging)
   - notifications-microservice (multi-channel notifications)
   - payments-microservice (payment processing)
   - **ai-microservice (CRITICAL - AI-teacher is core feature for education platform)**: AI-powered chat, personal roadmaps, pronunciation training, real-time assistance, personalized recommendations
   - nginx-microservice (reverse proxy and SSL)
   - helpdesk-microservice (customer support with AI) - **Note**: Will be built separately from scratch, current `helpdesk` app is obsolete
3. **Technology Migration**: From Django/Python to NestJS/Next.js/TypeScript for modern, type-safe development
4. **Manageable Parts**: Services organized by business domains (User, Course, Education, Content, Assessment, Certification, Payment, Notification, Salary, Financial). **Analytics is out of scope** - will be created from scratch later. **Helpdesk is out of scope** - will be built separately as shared microservice. **Testing is out of scope** - we test in practice and fix bugs on the fly.
5. **Migration Strategy**: Strangler Fig pattern - gradual migration with dual-write period for zero downtime
6. **Testing Strategy**: Testing is **out of scope** - we test in practice and fix bugs on the fly. No automated tests, unit tests, integration tests, or load tests will be created during refactoring.
7. **Platform Extension**: The platform will be extended to serve as a **dual-purpose language learning marketplace**:
   - **For Teachers**: Platform for language teachers to offer services, create courses, manage students, and build teaching businesses
   - **For Learners**: Platform for learning languages through AI-powered self-paced learning (AI-teacher) or with human teachers (live lessons, courses, personalized instruction)
   - **Goal**: Build an attractive, modern platform that attracts both teachers and learners with flexible learning and teaching options

### Direct Answers to Refactoring Questions

#### 1. Which Manageable Parts and Microservices Should SpeakASAP Be Split Into?

The legacy Django monolith (40+ apps) will be decomposed into **10 speakasap microservices**:

**Backend Microservices (8 services)**:

1. **speakasap-user-service** (4207) - User & identity management (students, teachers, employees, profiles). Supports both learners and teachers on the platform.
2. **speakasap-course-service** (4205) - Course products, pricing, offers (product catalog for courses)
3. **speakasap-education-service** (4206) - Course catalog, structure, lessons, homework, progress tracking, groups (includes all functionality from obsolete `courses` app). **AI-teacher is core feature**: AI-powered chat, personal roadmaps, pronunciation training. Supports both AI-powered self-paced learning and human teacher-led courses/lessons.
4. **speakasap-content-service** (4201) - Learning content (grammar, phonetics, dictionary, songs)
5. **speakasap-assessment-service** (4203) - Tests and assessments
6. **speakasap-certification-service** (4202) - Certificates, achievements, gamification
7. **speakasap-payment-service** (4208) - Orders, payments, subscriptions, discounts
8. **speakasap-notification-service** (4209) - Notifications, email campaigns (Telegram bot handled by shared notifications-microservice)
9. **speakasap-salary-service** (4212) - Staff salary management and teacher payments. Handles payments to teachers for their teaching services on the platform.
10. **speakasap-financial-service** (4213) - Business financial analytics and billing categories

**Note**: Analytics is **out of scope** for this refactoring. The `big_brother` and `actions` apps are obsolete and not used. Analytics will be created from scratch later as a separate project.  
**Note**: Testing is **out of scope** - we test in practice and fix bugs on the fly. No automated tests, unit tests, integration tests, or load tests will be created.

**Note**: Helpdesk is **out of scope** for this refactoring. The current `helpdesk` app is obsolete. A new **helpdesk-microservice** will be built from scratch as a separate shared microservice for the entire statex.cz ecosystem (not part of speakasap refactoring).

**Frontend Services (2 services)**:

1. **speakasap-api-gateway** (4210) - Request routing, authentication, rate limiting
2. **speakasap-frontend** (4211) - **Learner portal** (for students learning with AI or human teachers), **Teacher portal** (for teachers offering their services and managing courses/students), admin dashboard, public website

**Port Range**: 42xx (speakasap application)

#### 2. Which Existing Microservices Should Be Used in New SpeakASAP?

The new SpeakASAP platform will integrate with **7 critical shared microservices** from the statex.cz ecosystem:

| Microservice | Port | Usage | Integration Phase |
| ------------ | ---- | ----- | ----------------- |
| **auth-microservice** | 3370 | User authentication, JWT tokens, social auth | Phase 3 (User Service) |
| **database-server** | 5432/6379 | PostgreSQL + Redis for all services | Phase 1 (Foundation) |
| **logging-microservice** | 3367 | Centralized logging for all services | Phase 1 (Foundation) |
| **notifications-microservice** | 3368 | Email, Telegram, WhatsApp notifications | Phase 4 (Notification Service) |
| **payments-microservice** | 3468 | Payment processing (PayPal, Stripe, PayU, etc.) | Phase 4 (Payment Service) |
| **ai-microservice** | 3380 | AI-powered features (translations, content generation) | Phase 1 (Content), Phase 3 (Course) |
| **nginx-microservice** | 80/443 | Reverse proxy, SSL, blue/green deployment | Phase 1 (Foundation) |

**Why NOT Use Some Microservices**:

- **catalog-microservice** (3200): Courses are education-specific, not traditional e-commerce products
- **warehouse-microservice** (3201): SpeakASAP is digital-only (no physical inventory)
- **suppliers-microservice** (3202): No supplier integration needed for digital courses
- **orders-microservice** (3203): Digital course orders don't need physical fulfillment

#### 3. What Will Be Manageable Parts and Roadmap for Full SpeakASAP Refactor?

**Manageable Parts** (organized by business domain):

- **User Domain**: User service, authentication integration
- **Education Domain**: Course service, Education service (with AI-teacher core feature), Content service
- **Assessment Domain**: Assessment service, Certification service
- **E-commerce Domain**: Payment service, Financial service
- **Communication Domain**: Notification service
- **Support Domain**: Out of scope - helpdesk-microservice will be built separately from scratch as shared microservice
- **Analytics Domain**: Out of scope - analytics will be created from scratch later
- **HR Domain**: Salary service
- **Infrastructure**: API Gateway, Frontend

**Complete Roadmap**:

- **Phase 1**: Foundation & Infrastructure - Content services
- **Phase 2**: Independent Services - Certification, Assessment
- **Phase 3**: Core Education Services - Course, Education, User services
- **Phase 4**: Payment & E-commerce - Payment, Notification, Salary, Financial
- **Phase 5**: Frontend & API Gateway
- **Phase 6**: Integration
- **Phase 7**: Migration & Decommissioning

See detailed roadmap in Section 5 below.

---

## 0. Platform Vision and Extension Strategy

### 0.1 Dual-Purpose Language Learning Marketplace

The refactored speakasap.com platform will be **extended beyond the current functionality** to serve as a comprehensive **dual-purpose language learning marketplace** that attracts both teachers and learners.

#### For Teachers: Platform for Language Teaching

The platform will provide a complete ecosystem for **language teachers** who want to offer their teaching services:

- **Teacher Onboarding**: Easy registration and profile creation for teachers
- **Course Creation Tools**: Tools for teachers to create and manage their own courses
- **Student Management**: Dashboard for teachers to manage their students, track progress, schedule lessons
- **Teaching Tools**: Features for conducting live lessons, assigning homework, providing feedback
- **Business Management**: Tools to manage teaching schedules, pricing, availability
- **Payment Integration**: Secure payment processing for teacher services (handled by speakasap-salary-service)
- **Reputation System**: Build teaching reputation through student reviews and ratings
- **Marketing Support**: Tools to promote teaching services and attract students

#### For Learners: Flexible Learning Pathways

The platform will offer **multiple learning pathways** for people who want to learn languages:

**Pathway 1: AI-Powered Self-Paced Learning**

- **AI-Teacher (Core Feature)**: Learn independently with AI-powered assistance
  - AI-powered chat for language practice and Q&A
  - AI-generated personal learning roadmaps tailored to individual goals
  - AI-powered pronunciation training with real-time feedback
  - Real-time AI assistance during lessons
  - Personalized AI learning recommendations
- **Self-Paced Courses**: Access to structured courses with AI support
- **Flexible Scheduling**: Learn at your own pace, anytime, anywhere

**Pathway 2: Human Teacher Learning**

- **Live Lessons**: Schedule and attend live lessons with professional human teachers
- **Teacher-Led Courses**: Enroll in courses created and taught by human teachers
- **Personalized Instruction**: One-on-one or small group lessons with personalized attention
- **Teacher Selection**: Choose teachers based on expertise, reviews, availability, and teaching style
- **Interactive Learning**: Real-time interaction, feedback, and guidance from human teachers

**Pathway 3: Hybrid Learning**

- **Combined Approach**: Mix AI-powered learning with human teacher sessions
- **Flexible Combination**: Use AI for practice and human teachers for complex topics or conversation practice
- **Adaptive Learning**: Platform adapts recommendations based on learning style and progress

### 0.2 Platform Attractiveness Strategy

The goal is to build an **attractive, modern platform** that draws both teachers and learners:

**For Teachers - Attraction Factors**:

- Modern, intuitive teacher portal with powerful tools
- Fair payment structure and timely payments
- Large learner base to connect with
- Marketing and promotion support
- Flexible teaching options (live lessons, courses, or both)
- Reputation building through reviews and ratings
- Easy-to-use course creation and management tools

**For Learners - Attraction Factors**:

- Choice between AI-powered learning or human teachers (or both)
- Modern, user-friendly interface
- Flexible learning options (self-paced or scheduled)
- Quality teachers with verified credentials
- Affordable pricing options
- Progress tracking and gamification
- Mobile-friendly platform
- AI-powered personalization

### 0.3 Technical Implementation

The platform extension will leverage the existing microservices architecture:

- **speakasap-user-service**: Manages both learner and teacher profiles, roles, and permissions
- **speakasap-education-service**: Supports both AI-powered courses and human teacher-led courses/lessons
- **speakasap-salary-service**: Handles payments to teachers for their services
- **speakasap-payment-service**: Processes payments from learners for courses and lessons
- **speakasap-frontend**: Separate portals for learners and teachers with role-based access
- **ai-microservice**: Powers the AI-teacher features for self-paced learning
- **speakasap-notification-service**: Sends notifications to both teachers and learners

### 0.4 Migration and Extension Approach

The platform extension will be implemented **during the refactoring process**:

1. **Phase 1-3**: Build core infrastructure and services that support both learners and teachers
2. **Phase 4**: Add payment and salary services that enable the marketplace model
3. **Phase 5**: Build separate learner and teacher portals in the frontend
4. **Phase 6-7**: Integrate all features and ensure smooth operation for both user types

This extension transforms speakasap.com from a traditional e-learning platform into a **modern language learning marketplace** that serves both sides of the education ecosystem.

---

## 1. Legacy Project Analysis

### 1.1 Current Architecture

**Technology Stack**:

- Django (Python) - Monolithic application
- PostgreSQL - Database
- RabbitMQ - Message queue
- Celery - Background tasks

**Business Domains Identified** (from Django apps):

#### Core User & Identity Management

- `students` - Student profiles, registration, status tracking
- `employees` - Teachers and staff management
- `social_auth` - **OBSOLETE** Social authentication (Google, Facebook, etc.) - Replaced by auth-microservice
- `cabinet` - User dashboard/cabinet

#### Course & Education Management

- `education` - Course catalog, course structure, lessons, homework, lesson records, groups (includes all functionality from obsolete `courses` app)
- `course_materials` - Course content and materials
- `seven` / `seven_test` - Special course types
- `mini` - Mini courses
- `native` - Native speaker courses

**Note**: `marathon` - Marathon courses (intensive programs) will be extracted as a **separate marathon service** for all kinds of fast learning, not just language learning. This will be a standalone service outside of the speakasap application.

#### Content & Learning Resources

- `grammar` - Grammar lessons
- `phonetics` - Phonetics lessons
- `dictionary` - Dictionary/translations
- `songs` - Song-based learning
- `language` - Language definitions
- `language_tests` - Language proficiency tests
- `user_tests` - User test results
- `teacher_tests` - **OBSOLETE** Teacher assessments - No longer needed

#### E-commerce & Payments

- `products` - Course products, pricing
- `offers` - Special offers and promotions
- `orders` - Order management (PayPal, WebPay, invoices, Android)
- `pricing` - Pricing rules
- `discount` - Discount codes and campaigns
- `subscription` - Subscription management

#### Certification & Achievements

- `certificates` - Course completion certificates
- `education_certificates` - Education certificates
- `quests` - Gamification quests
- `user_quest` - User quest progress
- `reviews` - Student reviews

#### Communication & Support

- `notifications` - Notification system
- `helpdesk` - **OBSOLETE** Support tickets - **OUT OF SCOPE** - Will be replaced by new helpdesk-microservice built from scratch
- `telegram` - Telegram bot integration (handled by shared notifications-microservice, not speakasap-specific)
- `ses` - Email service (AWS SES)

#### Administration & Analytics

- `administrator` - Admin panel
- `big_brother` - **OBSOLETE** Monitoring/analytics - **OUT OF SCOPE** - Not used, analytics will be created from scratch later
- `actions` - User actions tracking
- `flow` - Workflow management

#### Financial & HR

- `expenses` - Expense tracking and salary management
- `administrator/salary` - Staff salary payments and calculations (<https://speakasap.com/administrator/salary/>)
- `administrator/billing/categories` - Billing categories and financial analytics (<https://speakasap.com/administrator/billing/categories/>)

#### Infrastructure & Miscellaneous

- `delivery` - **OBSOLETE** Email marketing lists - No longer needed
- `investors` - **OBSOLETE** Investor management - No longer needed
- `books` - Book products management
- `news` - **OBSOLETE** News/blog (part of speakasap site) - No longer needed
- `partner` - **OBSOLETE** Partner marketing program management - No longer needed
- `redirecter` - URL redirection service
- `localization` - Multi-language support
- `flow` - Workflow management
- `course_parser` - **OBSOLETE** Currency rates parsing - No longer needed
- `rest` - REST API endpoints
- `inspinia` - Admin UI framework
- `fancy_cache` - Caching utilities

### 1.2 Current Architecture Problems

- **Monolithic Structure**: All functionality in single Django app
- **Tight Coupling**: Business domains tightly integrated
- **Legacy Technology**: Old Django patterns, outdated dependencies
- **No Microservice Integration**: Not using shared microservices
- **Scalability Issues**: Cannot scale individual components
- **Maintenance Burden**: Large codebase, difficult to maintain
- **Technology Debt**: Old patterns, hard to extend
- **Direct Payment Processing**: Local payment handling instead of using payments-microservice
- **Local Email Service**: AWS SES integration instead of notifications-microservice
- **No Centralized Logging**: Logs scattered across application
- **No Centralized Authentication**: Django auth instead of auth-microservice

### 1.3 Out-of-Scope Features (Obsolete - Not to be Refactored)

The following features are **obsolete and out of scope** for the refactoring. They will **not be migrated** to the new microservices architecture:

1. **`delivery`** - Email marketing features (obsolete, no longer needed)
2. **`partner`** - Partner marketing program management (obsolete, no longer needed)
3. **`big_brother`** - Monitoring/analytics - **OUT OF SCOPE** - Obsolete, not used, analytics will be created from scratch later
4. **`course_parser`** - Currency rates parser (obsolete, no longer needed)
5. **`investors`** - Investor management (obsolete, no longer needed)
6. **`teacher_tests`** - Teacher assessments (obsolete, no longer needed)
7. **`news`** - News/blog (obsolete, no longer needed)
8. **`orders.android`** - Android payment integration (obsolete, replaced by payments-microservice unified API)
9. **`social_auth`** - Social authentication (obsolete, replaced by auth-microservice which handles social auth)
10. **`helpdesk`** - Support tickets (obsolete, will be replaced by new helpdesk-microservice built from scratch)

**Note**: These features will remain in the legacy system but will not be part of the new microservices architecture. They are marked as obsolete and should not be included in any migration plans.

**Special Note for Helpdesk**: The current `helpdesk` app is obsolete and out of scope. A new **helpdesk-microservice** will be built from scratch as a separate shared microservice for the entire statex.cz ecosystem. It will not migrate data from the legacy `helpdesk` app.

### 1.4 Complete Django Apps Inventory

**Total Django Apps**: 40+ applications (verified from `portal/settings.py` INSTALLED_APPS)

**Verification Date**: 2025-01-29  
**Source**: `/Users/sergiystashok/Documents/GitHub/speakasap-portal/portal/settings.py`

**Note**: See Section 1.3 for out-of-scope/obsolete features that will not be refactored.

#### Verified INSTALLED_APPS from Legacy Project

The following apps are confirmed to exist in the legacy project's `INSTALLED_APPS`:

**Core Django Apps**:

- `django.contrib.admin`, `django.contrib.auth`, `django.contrib.contenttypes`, `django.contrib.sessions`, `django.contrib.messages`, `django.contrib.staticfiles`, `django.contrib.sites`, `django.contrib.humanize`

**Third-Party Packages**:

- `widget_tweaks`, `django_hosts`, `bootstrap3`, `bootstrap_datepicker`, `django_tables2`, `formtools`, `ckeditor`, `sorl.thumbnail`, `compressor`, `django_celery_results`, `django_celery_beat`, `djcelery_email`, `rest_framework`, `rest_framework.authtoken`, `rest_framework_swagger`, `social_django`, `djorm_pgfulltext`, `django_extensions`, `django_filters`

**Business Domain Apps** (verified):

- `speakasap_site` - Public website
- `portal` - Core portal application (middleware, utilities, core logic)
- `course_materials` - Course content and materials
- `actions` - User actions tracking
- `helpdesk` - **OBSOLETE** Support tickets - **OUT OF SCOPE** - Will be replaced by new helpdesk-microservice built from scratch
- `course_parser` - **OBSOLETE** Currency rates parser - No longer needed
- `language` - Language definitions
- `students` - Student profiles and registration
- `courses` - obsolete. Replaced by education (with `courses.apps.CoursesApp` and `courses.apps.CoursesHomeworkApp`) - Course catalog, structure, and homework
- `courses.questionaries` - Course questionnaires
- `notifications` - Notification system
- `employees` - Teachers and staff management
- `cabinet` - User dashboard/cabinet
- `products` - Course products and pricing
- `offers` - Special offers and promotions
- `orders` (with `orders.cs`, `orders.paypal`, `orders.invoice`, `orders.android`) - Order management and payment integrations
  - **Note**: `orders.android` is **OBSOLETE** - Replaced by payments-microservice unified API
- `discount` - Discount codes and campaigns
- `seven` / `seven_test` - Special course types
- `marathon` - Marathon courses (intensive programs) - **Will be extracted as separate marathon-service (see Section 2.2)**
- `phonetics` - Phonetics lessons
- `grammar` - Grammar lessons
- `songs` - Song-based learning
- `redirecter` - URL redirection service
- `administrator` - Admin panel
- `reviews` - Student reviews
- `investors` - **OBSOLETE** Investor management - No longer needed
- `expenses` - Expense tracking and salary management
- `dictionary` - Dictionary/translations
- `certificates` - Course completion certificates
- `books` - Book management
- `user_quest` - User quest progress
- `rest` - REST API endpoints
- `delivery` - **OBSOLETE** Email marketing - No longer needed
- `language_tests` - Language proficiency tests
- `teacher_tests` - **OBSOLETE** Teacher assessments - No longer needed
- `social_auth` - **OBSOLETE** Social authentication (Google, Facebook) - Replaced by auth-microservice
- `ses` - Email service (AWS SES)
- `flow` - Workflow management
- `big_brother` - **OBSOLETE** Monitoring/analytics - **OUT OF SCOPE** - Not used, analytics will be created from scratch later
- `quests` - Gamification quests
- `user_tests` - User test results
- `localization` - Multi-language support
- `education` - Lessons, homework, lesson records, groups
- `education_certificates` - Education certificates
- `inspinia` - Admin UI framework
- `fancy_cache` - Caching utilities

**Additional Directories Found** (may be modules or utilities, not Django apps):

- `telegram/` - Telegram bot integration (handled by shared notifications-microservice, not speakasap-specific)
- `partner/` - **OBSOLETE** Partner management - No longer needed
- `subscription/` - Subscription management (likely part of orders)
- `mini/` - Mini courses (likely part of courses app)
- `native/` - Native speaker courses (likely part of courses app)
- `news/` - **OBSOLETE** News/blog - No longer needed
- `openai-bot/` - AI bot integration (may be new feature)
- `service_notifications/` - Service notifications (likely part of notifications)
- `countries/` - Country management (likely utility)
- `basic/` - Basic utilities (likely utility)
- `group/` - Group management (likely part of education)

**Note**: These directories should be verified during Phase 1 (Foundation) to ensure complete migration coverage. They may be Django apps not listed in INSTALLED_APPS, or they may be utility modules.

### 1.5 Additional Analysis Notes

#### Core Portal App (`portal`)

The `portal` app contains core infrastructure logic including:

- Middleware (LanguageMiddleware, PageVisitMiddleware, XsSharing)
- Context processors
- Core utilities and helpers
- URL routing and host configuration

**Migration Strategy**: Core portal logic should be distributed across appropriate microservices:

- Middleware → API Gateway (routing, authentication)
- Context processors → Frontend (data preparation)
- Utilities → Shared libraries or service-specific implementations
- URL routing → API Gateway

#### Course Sub-Apps

The obsolete `courses` app (replaced by `education` app) has multiple sub-apps:

- `courses.apps.CoursesApp` - Main course catalog
- `courses.apps.CoursesHomeworkApp` - Homework management
- `courses.questionaries` - Questionnaires and surveys

**Migration Strategy**: All course-related functionality from obsolete `courses` app is now in `education` app and should be consolidated into `speakasap-education-service`:

- Course catalog → speakasap-education-service
- Course structure → speakasap-education-service
- Homework → speakasap-education-service
- Questionnaires → speakasap-education-service

#### Order Payment Integrations

The `orders` app has multiple payment integration sub-apps:

- `orders.cs` - Czech payment integration (WebPay)
- `orders.paypal` - PayPal integration
- `orders.invoice` - Invoice generation
- `orders.android` - **OBSOLETE** Android payment integration - Replaced by payments-microservice unified API

**Migration Strategy**: All payment processing should migrate to `payments-microservice`:

- Remove direct payment integrations from speakasap-payment-service
- Use payments-microservice unified API for all payment methods
- Invoice generation remains in speakasap-payment-service (business logic)

#### Complete App List with Microservice Mapping

| Django App | Purpose | Target Microservice | Notes |
| ---------- | ------- | ------------------- | ----- |
| `portal` | Core portal application (middleware, utilities) | All services | Core infrastructure logic distributed across services |
| `students` | Student profiles, registration, status tracking | speakasap-user-service | Core user management |
| `employees` | Teachers and staff management | speakasap-user-service, speakasap-salary-service | Split: profiles → user-service, contracts → salary-service |
| `social_auth` | **OBSOLETE** Social authentication (Google, Facebook) | **OUT OF SCOPE** | Replaced by auth-microservice (handles social auth) |
| `cabinet` | User dashboard/cabinet | speakasap-frontend | Frontend component |
| `education` | Course catalog, course structure (includes obsolete `courses` app) | speakasap-education-service | Core course catalog and education management |
| `course_materials` | Course content and materials | speakasap-course-service | Course content |
| `education` | Lessons, homework, lesson records, groups | speakasap-education-service | Core education delivery |
| `marathon` | Marathon courses (intensive programs) | **marathon-service** (separate) | **Separate service for all kinds of fast learning** - not speakasap-specific |
| `seven` / `seven_test` | Special course types | speakasap-education-service | Special course type (part of course catalog) |
| `mini` | Mini courses | speakasap-education-service | Special course type (part of course catalog) |
| `native` | Native speaker courses | speakasap-education-service | Special course type (part of course catalog) |
| `grammar` | Grammar lessons | speakasap-content-service | Learning content |
| `phonetics` | Phonetics lessons | speakasap-content-service | Learning content |
| `dictionary` | Dictionary/translations | speakasap-content-service | Learning content (AI-enhanced) |
| `songs` | Song-based learning | speakasap-content-service | Learning content |
| `language` | Language definitions | speakasap-content-service | Learning content |
| `language_tests` | Language proficiency tests | speakasap-assessment-service | Testing |
| `user_tests` | User test results | speakasap-assessment-service | Testing |
| `teacher_tests` | **OBSOLETE** Teacher assessments | **OUT OF SCOPE** | No longer needed |
| `products` | Course products, pricing | speakasap-course-service, speakasap-financial-service | Split: products → course-service, billing categories → financial-service |
| `offers` | Special offers and promotions | speakasap-course-service | Course promotions |
| `orders` | Order management (PayPal, WebPay, invoices, Android) | speakasap-payment-service | E-commerce (migrate to payments-microservice) |
| `orders.cs` | Czech payment integration | speakasap-payment-service | Migrate to payments-microservice |
| `orders.paypal` | PayPal integration | speakasap-payment-service | Migrate to payments-microservice |
| `orders.invoice` | Invoice generation | speakasap-payment-service | Keep in payment-service |
| `orders.android` | **OBSOLETE** Android payment integration | **OUT OF SCOPE** | Replaced by payments-microservice unified API |
| `pricing` | Pricing rules | speakasap-course-service | Course pricing |
| `discount` | Discount codes and campaigns | speakasap-payment-service | E-commerce |
| `subscription` | Subscription management | speakasap-payment-service | E-commerce |
| `certificates` | Course completion certificates | speakasap-certification-service | Certificate generation |
| `education_certificates` | Education certificates | speakasap-certification-service | Certificate generation |
| `quests` | Gamification quests | speakasap-certification-service | Gamification |
| `user_quest` | User quest progress | speakasap-certification-service | Gamification |
| `reviews` | Student reviews | speakasap-certification-service | Reviews/achievements |
| `notifications` | Notification system | speakasap-notification-service | Notification management |
| `helpdesk` | **OBSOLETE** Support tickets | **OUT OF SCOPE** | Will be replaced by new helpdesk-microservice built from scratch (separate shared microservice) |
| `telegram` | Telegram bot integration | **notifications-microservice** (shared) | Communication channel - handled by shared notifications-microservice, not speakasap-specific |
| `ses` | Email service (AWS SES) | notifications-microservice | Migrate to shared notifications-microservice |
| `administrator` | Admin panel | speakasap-frontend | Admin UI component |
| `big_brother` | **OBSOLETE** Monitoring/analytics | **OUT OF SCOPE** | Not used, analytics will be created from scratch later |
| `actions` | **OBSOLETE** User actions tracking | **OUT OF SCOPE** | Not used, analytics will be created from scratch later |
| `expenses` | Expense tracking and salary management | speakasap-salary-service, speakasap-financial-service | Split: salary expenses → salary-service, other expenses → financial-service |
| `delivery` | **OBSOLETE** Email marketing | **OUT OF SCOPE** | No longer needed |
| `investors` | **OBSOLETE** Investor management | **OUT OF SCOPE** | No longer needed |
| `books` | Book management | speakasap-content-service | Content resource |
| `news` | **OBSOLETE** News/blog | **OUT OF SCOPE** | No longer needed |
| `redirecter` | URL redirection service | speakasap-api-gateway | Routing logic |
| `localization` | Multi-language support | All services | Infrastructure concern |
| `flow` | Workflow management | speakasap-education-service | Education workflows |
| `rest` | REST API endpoints | speakasap-api-gateway | API routing |
| `inspinia` | Admin UI framework | speakasap-frontend | Frontend framework (replace) |
| `fancy_cache` | Caching utilities | All services | Infrastructure (use Redis) |
| `speakasap_site` | Public website | speakasap-frontend | Public website |

### 1.4 Legacy Project Statistics

- **Total Django Apps**: 40+ applications
- **Technology Stack**: Django (Python), PostgreSQL, RabbitMQ, Celery
- **Frontend**: Django templates with jQuery/Bootstrap
- **API**: Django REST Framework
- **Deployment**: Docker containers
- **Current Status**: Production system at <https://speakasap.com>
- **Payment Integrations**: PayPal, WebPay (CS), Invoices, Android payments
- **Authentication**: Django auth + social_auth (Google, Facebook) - **Note**: social_auth is obsolete, replaced by auth-microservice
- **Email Service**: AWS SES (direct integration)
- **Background Jobs**: Celery with RabbitMQ

---

## 2. Microservices Decomposition Strategy

### 2.1 Decomposition Principles

The refactoring follows these key principles:

1. **Domain-Driven Design (DDD)**: Split by business domains and bounded contexts
2. **Single Responsibility**: Each service handles one business domain
3. **Data Ownership**: Each service owns its data (database per service)
4. **Loose Coupling**: Services communicate via APIs and events
5. **High Cohesion**: Related functionality grouped together
6. **Independent Deployment**: Services can be deployed independently
7. **Technology Flexibility**: Services can use different technologies if needed

### 2.2 Manageable Parts Analysis

Based on domain-driven design principles and business boundaries, the platform should be split into the following manageable microservices:

#### **Core Platform Microservices** (12 services)

1. **speakasap-user-service** (Port: 4207)
   - **Domain**: User and identity management
   - **Responsibilities**:
     - Student/Learner profiles and registration
     - Teacher profiles and registration (for teachers offering services on platform)
     - Teacher/Employee management
     - User profiles and preferences
     - Social authentication integration
     - User roles and permissions (learner, teacher, admin)
     - Teacher verification and credentials
     - Teacher availability and scheduling preferences
   - **Data Sources**: `students`, `employees`, `cabinet`
   - **Note**: `social_auth` is obsolete, replaced by auth-microservice
   - **Dependencies**: auth-microservice (authentication)

2. **speakasap-course-service** (Port: 4205)
   - **Domain**: Course products and pricing
   - **Responsibilities**:
     - Course products and pricing management
     - Special offers and promotions
     - Pricing rules and configurations
     - Product catalog for courses
   - **Data Sources**: `products`, `offers`, `pricing`
   - **Dependencies**: speakasap-education-service (for course catalog), ai-microservice (content generation)

3. **speakasap-education-service** (Port: 4206)
   - **Domain**: Course catalog, education delivery and progress
   - **Responsibilities**:
     - Course catalog management (includes all functionality from obsolete `courses` app)
     - Course structure and curriculum
     - Course materials and content
     - Course categories and languages
     - Special course types (seven, mini, native)
     - **Note**: Marathon courses are handled by separate marathon service (see Section 2.2)
     - Lesson management
     - Homework and assignments
     - Lesson records and progress
     - Group management
     - Student-course relationships
     - Learning progress tracking
     - **Dual-Purpose Platform Support**:
       - **AI-Powered Learning**: Self-paced courses with AI-teacher support
       - **Human Teacher Learning**: Teacher-led courses, live lessons, scheduled sessions
       - **Hybrid Learning**: Support for combining AI and human teacher approaches
       - Teacher-student matching and scheduling
       - Live lesson management and recording
     - **AI-Teacher Integration (Core Feature)**:
       - AI-powered chat for language practice and Q&A
       - AI-generated personal learning roadmaps
       - AI-powered pronunciation training and feedback
       - AI-teacher as core service for all education platform
       - Real-time AI assistance during lessons
       - Personalized AI learning recommendations
   - **Data Sources**: `education` (course catalog, lessons, homework, groups, student courses, course_materials, seven, mini, native)
   - **Note**: `marathon` app will be extracted as a separate marathon service (see Section 2.2)
   - **Dependencies**: speakasap-course-service (for products/pricing), speakasap-user-service, **ai-microservice (CRITICAL - AI-teacher is core feature)**

4. **speakasap-content-service** (Port: 4201)
   - **Domain**: Learning content and resources
   - **Responsibilities**:
     - Grammar lessons
     - Phonetics lessons
     - Dictionary/translations
     - Songs and media content
     - Language definitions
     - Content search and discovery
   - **Data Sources**: `grammar`, `phonetics`, `dictionary`, `songs`, `language`
   - **Dependencies**: ai-microservice (translations, content generation)

5. **speakasap-assessment-service** (Port: 4203)
   - **Domain**: Testing and assessment
   - **Responsibilities**:
     - Language tests
     - User test results
     - Teacher assessments
     - Test scoring and analytics
     - Test creation and management
   - **Data Sources**: `language_tests`, `user_tests`
   - **Note**: `teacher_tests` is obsolete, no longer needed
   - **Dependencies**: speakasap-user-service, speakasap-education-service

6. **speakasap-certification-service** (Port: 4202)
   - **Domain**: Certificates and achievements
   - **Responsibilities**:
     - Certificate generation (PDF templates)
     - Certificate templates
     - Certificate validation
     - Achievement tracking (quests)
     - Gamification system
   - **Data Sources**: `certificates`, `education_certificates`, `quests`, `user_quest`, `reviews`
   - **Dependencies**: speakasap-user-service, speakasap-education-service

7. **speakasap-payment-service** (Port: 4208)
   - **Domain**: E-commerce and payments
   - **Responsibilities**:
     - Order management
     - Payment processing (integrate with payments-microservice)
     - Pricing rules
     - Discount codes and campaigns
     - Subscription management
     - Invoice generation
   - **Data Sources**: `orders`, `discount`, `subscription`
   - **Dependencies**: payments-microservice, speakasap-user-service, speakasap-course-service, speakasap-education-service

8. **speakasap-notification-service** (Port: 4209)
   - **Domain**: Notifications and communication
   - **Responsibilities**:
     - Notification templates
     - Notification delivery (integrate with notifications-microservice)
     - Notification preferences
     - Email campaigns (SmartResponder integration)
     - **Note**: Telegram bot is handled by shared notifications-microservice, not speakasap-notification-service
   - **Data Sources**: `notifications`, `ses`, `smartresponder`
   - **Dependencies**: notifications-microservice (handles Telegram bot, email, WhatsApp)

**Note**: **helpdesk-microservice** is **out of scope** for speakasap refactoring. The current `helpdesk` app is obsolete and will not be migrated. A new **helpdesk-microservice** will be built from scratch as a separate shared microservice for the entire statex.cz ecosystem. It will be developed independently and can be used by all applications (speakasap, flipflop, allegro, etc.). This microservice will include:

- Helpdesk/ticket system
- Support workflows
- Customer service tools
- Ticket assignment and tracking
- AI-powered ticket routing and categorization
- AI-powered response suggestions
- AI-powered knowledge base integration
- Integration with auth-microservice (for user data)
- Integration with notifications-microservice (for notifications)
- Integration with ai-microservice (for AI features)

**Port**: TBD (separate shared microservice)  
**Database**: `helpdesk_db` (separate shared database)  
**Development**: Separate project, not part of speakasap refactoring

1. **speakasap-salary-service** (Port: 4212)
    - **Domain**: Staff salary management and teacher payments
    - **Production URL**: <https://speakasap.com/administrator/salary/>
    - **Responsibilities**:
      - Staff salary management and administration
      - **Teacher payment processing** (for teachers offering services on the platform marketplace)
      - Teacher payment calculations and tracking based on lessons taught, courses created, and student enrollments
      - Salary expense tracking and reporting
      - Payment schedules and history management
      - Contract-based salary calculations
      - Employee salary processing workflows
      - Integration with employees/teachers data
      - **Marketplace Support**: Handles payments to independent teachers for their teaching services
    - **Data Sources**: `expenses` (salary expenses), `employees` (contracts)
    - **Dependencies**: speakasap-user-service, speakasap-education-service (for lesson/course data), speakasap-payment-service (for payment processing)

2. **speakasap-financial-service** (Port: 4213)
    - **Domain**: Business financial analytics
    - **Production URL**: <https://speakasap.com/administrator/billing/categories/>
    - **Responsibilities**:
      - Business financial analytics and reporting
      - Billing categories management and configuration
      - Revenue tracking and reporting by category
      - Financial dashboards and visualizations
      - Expense categorization and analysis
      - Financial reporting and analytics
      - Revenue vs. expense analysis
      - Business metrics and KPIs
    - **Data Sources**: `products` (billing categories), `orders` (revenue data), `expenses` (non-salary expenses)
    - **Dependencies**: speakasap-payment-service, speakasap-salary-service

#### **Separate Marathon Service** (Outside SpeakASAP)

**marathon-service** (Port: TBD - separate from speakasap 42xx range)

- **Domain**: Fast learning programs (marathons) for all kinds of education
- **Purpose**: Separate standalone service for intensive learning programs, not limited to language learning
- **Scope**: All types of fast learning marathons (languages, skills, professional development, etc.)
- **Responsibilities**:
  - Marathon program management
  - Intensive learning course structure
  - Marathon enrollment and tracking
  - Progress monitoring for fast-paced learning
  - Marathon-specific analytics
  - Multi-domain support (not just languages)
- **Data Sources**: `marathon` (from legacy system)
- **Dependencies**:
  - auth-microservice (authentication)
  - database-server (data storage)
  - logging-microservice (logging)
  - notifications-microservice (notifications)
  - payments-microservice (if marathons require payment)
- **Integration with SpeakASAP**:
  - Can be used by speakasap for language learning marathons
  - Independent service that can serve other education platforms
  - May share user data via auth-microservice
- **Note**: This service will be developed separately from speakasap refactoring and will have its own roadmap

#### **Frontend Services** (2 services)

1. **speakasap-frontend** (Port: 4211)
   - **Technology**: Next.js (TypeScript)
   - **Responsibilities**:
     - Student portal
     - Teacher portal
     - Admin dashboard
     - Public website
     - Modern responsive UI/UX

2. **speakasap-api-gateway** (Port: 4210)
   - **Technology**: NestJS (TypeScript)
   - **Responsibilities**:
     - Request routing to all services
     - Authentication/authorization
     - Rate limiting
     - API versioning
     - Request/response logging

---

## 3. Integration with Existing Statex.cz Microservices

### 3.1 Shared Microservices to Use

The new speakasap platform will leverage the following existing shared microservices:

| Existing Microservice | Usage in SpeakASAP | Integration Points | Priority | Integration Phase |
| -------------------- | ----------------- | ----------------- | -------- | ---------------- |
| **auth-microservice** | User authentication, JWT tokens | All services for authentication | **Critical** | Phase 3 (User Service) |
| **database-server** | PostgreSQL + Redis | All services for data storage and caching | **Critical** | Phase 1 (Foundation) |
| **logging-microservice** | Centralized logging | All services for log collection | **Critical** | Phase 1 (Foundation) |
| **notifications-microservice** | Email, Telegram, WhatsApp notifications | speakasap-notification-service → notifications-microservice | **Critical** | Phase 4 (Notification Service) |
| **payments-microservice** | Payment processing (PayPal, Stripe, PayU, etc.) | speakasap-payment-service → payments-microservice | **Critical** | Phase 4 (Payment Service) |
| **ai-microservice** | AI-powered features (translations, content generation, **AI-teacher for education**) | speakasap-content-service, speakasap-education-service | **Critical** | Phase 1 (Content Service), Phase 3 (Education Service - AI-teacher core feature) |
| **nginx-microservice** | Reverse proxy, SSL, routing | All services for external access | **Critical** | Phase 1 (Foundation) |
| **helpdesk-microservice** | Customer support with AI assistance | All services for support tickets | **High** | **Out of Scope** - Will be built separately from scratch |
| **orders-microservice** | Order processing (optional - for course orders) | speakasap-payment-service → orders-microservice | **Optional** | Phase 4 (Payment Service) |

#### **Decision: Why NOT Use Some Microservices**

**catalog-microservice** (Port: 3200):

- **Decision**: NOT used
- **Reason**: Courses are not traditional e-commerce products. Course catalog is specific to education domain with unique attributes (lessons, homework, progress tracking). Course catalog is managed in speakasap-education-service (includes all functionality from obsolete `courses` app), while products and pricing are in speakasap-course-service.

**warehouse-microservice** (Port: 3201):

- **Decision**: NOT used
- **Reason**: SpeakASAP is digital-only (courses, certificates). No physical products or inventory management needed. If physical products (books, materials) are added in future, can integrate later.

**suppliers-microservice** (Port: 3202):

- **Decision**: NOT used
- **Reason**: No supplier integration needed for digital courses. Content is created internally or via AI.

#### **Why These Microservices?**

1. **auth-microservice**:
   - Eliminates need for local authentication
   - Provides JWT token management
   - Supports social authentication
   - Single sign-on capability

2. **database-server**:
   - Centralized database management
   - Shared Redis for caching
   - Consistent backup and monitoring
   - Database per service pattern

3. **logging-microservice**:
   - Unified log aggregation
   - Service-based log filtering
   - Centralized debugging
   - Compliance and audit trails

4. **notifications-microservice**:
   - Multi-channel notifications (Email, Telegram, WhatsApp)
   - Template management
   - Delivery tracking
   - Reduces email service complexity

5. **payments-microservice**:
   - Multiple payment methods (PayPal, Stripe, PayU, Fio Banka, ComGate)
   - Unified payment API
   - Webhook support
   - Refund processing

6. **ai-microservice**:
   - **AI-Teacher (Core Feature)**:
     - AI-powered chat for language practice
     - Personal learning roadmaps
     - Pronunciation training and feedback
     - Real-time AI assistance
     - Personalized learning recommendations
   - Content generation for courses
   - Translation services
   - Automated test generation
   - Content recommendations

7. **nginx-microservice**:
   - Automatic SSL certificate management
   - Blue/green deployment support
   - Load balancing
   - Request routing

8. **orders-microservice** (Optional):
   - Only if course orders should be part of unified order system
   - Integration with warehouse for physical products (if any)
   - May not be needed for digital-only course orders
   - **Decision**: NOT used initially - courses are digital-only, no physical fulfillment needed

### 3.2 Integration Details

#### **auth-microservice** (Port: 3370)

- **Purpose**: Centralized authentication
- **Integration**:
  - Replace all Django authentication with auth-microservice
  - Use JWT tokens for all service-to-service communication
  - Remove local user authentication from speakasap-user-service
  - Social auth integration via auth-microservice
  - User registration/login via auth-microservice API
  - Token validation middleware in API Gateway
- **Benefits**: Single sign-on, consistent authentication across platform
- **Migration Path**:
  1. Phase 1: Set up auth-microservice connection
  2. Phase 3: Integrate with speakasap-user-service
  3. Phase 5: Integrate with API Gateway
  4. Phase 7: Migrate all authentication traffic

#### **database-server** (PostgreSQL: 5432, Redis: 6379)

- **Purpose**: Shared database infrastructure
- **Integration**:
  - Each microservice gets its own database schema on shared PostgreSQL
  - Shared Redis for caching and session management
  - Database per service pattern for data isolation
- **Benefits**: Centralized management, backup, and monitoring

#### **logging-microservice** (Port: 3367)

- **Purpose**: Centralized logging
- **Integration**:
  - All services send logs to logging-microservice
  - Structured logging with service identification
  - Log aggregation and querying
- **Benefits**: Unified log management, easier debugging

#### **notifications-microservice** (Port: 3368)

- **Purpose**: Multi-channel notifications
- **Integration**:
  - speakasap-notification-service acts as wrapper/manager for templates and preferences
  - All notification delivery via notifications-microservice
  - **Telegram bot is part of notifications-microservice** (shared, not speakasap-specific)
  - Support for email, Telegram, WhatsApp
  - Template management in speakasap-notification-service
  - Telegram bot functionality handled directly by notifications-microservice
- **Benefits**: Consistent notification delivery, multi-channel support, shared Telegram bot for all applications

#### **payments-microservice** (Port: 3468)

- **Purpose**: Payment processing
- **Integration**:
  - speakasap-payment-service manages orders and subscriptions
  - Actual payment processing via payments-microservice
  - Support for PayPal, Stripe, PayU, Fio Banka, ComGate
  - Webhook handling for payment status updates
  - Replace legacy PayPal direct integration
  - Replace legacy WebPay integration
  - Replace legacy Android payment integration
  - Invoice generation remains in speakasap-payment-service
- **Benefits**: Unified payment processing, multiple payment methods
- **Migration Path**:
  1. Phase 1: Set up payments-microservice connection
  2. Phase 4: Create speakasap-payment-service
  3. Phase 4: Migrate payment processing logic
  4. Phase 4: Set up webhook handlers
  5. Phase 7: Decommission legacy payment integrations

#### **ai-microservice** (Port: 3380)

- **Purpose**: AI-powered features, including **AI-teacher** (core feature for education platform)
- **Integration**:
  - **AI-Teacher (Core Feature for speakasap-education-service)**:
    - AI-powered chat for language practice and Q&A
    - AI-generated personal learning roadmaps
    - AI-powered pronunciation training and feedback
    - Real-time AI assistance during lessons
    - Personalized AI learning recommendations
    - AI-teacher as core service for all education platform
  - Content generation for courses
  - Translation services for dictionary
  - Content analysis and recommendations
  - Automated test generation
- **Benefits**: Enhanced learning experience, automated content creation, **AI-teacher provides personalized education support**
- **Critical Integration**: AI-teacher is a **core feature** of speakasap-education-service and essential for the education platform

#### **nginx-microservice**

- **Purpose**: Reverse proxy and SSL management
- **Integration**:
  - All services exposed via nginx-microservice
  - Automatic SSL certificate management
  - Blue/green deployment support
  - Load balancing and routing
- **Benefits**: Secure external access, zero-downtime deployments

#### **orders-microservice** (Port: 3203) - Optional

- **Purpose**: Central order processing
- **Integration**:
  - If course orders should be part of unified order system
  - speakasap-payment-service can forward orders to orders-microservice
  - Integration with warehouse-microservice for physical products (if any)
- **Benefits**: Unified order management across all platforms
- **Note**: May not be needed if speakasap only handles digital course orders

---

## 4. Technology Stack Migration

### 4.1 From Legacy to Modern

**From**:

- Django (Python) monolith
- Django REST Framework
- Django templates
- Celery for background tasks
- Direct database access
- Local authentication

**To**:

- **Backend**: NestJS (TypeScript) - following statex.cz patterns
- **Frontend**: Next.js (TypeScript) - modern React framework
- **Database**: PostgreSQL (shared database-server)
- **Cache**: Redis (shared database-server)
- **Message Queue**: RabbitMQ (for event-driven communication)
- **Authentication**: JWT via auth-microservice
- **Payments**: payments-microservice
- **Notifications**: notifications-microservice
- **Logging**: logging-microservice
- **AI**: ai-microservice

### 4.2 Technology Benefits

- **TypeScript**: Type safety, better IDE support, fewer runtime errors
- **NestJS**: Modern Node.js framework, dependency injection, modular architecture
- **Next.js**: Server-side rendering, optimized performance, modern React
- **Microservices**: Independent scaling, technology flexibility, team autonomy
- **Shared Services**: Code reuse, consistency, reduced maintenance

---

## 5. Detailed Refactoring Roadmap

### Phase 1: Foundation & Infrastructure

**Goal**: Set up infrastructure and extract low-risk services

#### 1.1 Project Setup

- [ ] Create `speakasap` directory structure in statex.cz
- [ ] Set up Docker Compose files (blue/green deployment)
- [ ] Configure nginx-microservice integration
- [ ] Set up shared microservice connections (auth, database, logging)
- [ ] Create .env.example files
- [ ] Set up CI/CD pipeline
- [ ] Configure port allocation (42xx range)

#### 1.2 Content Service (Read-Only)

**Note**: Analytics service is **out of scope** for this refactoring. The `big_brother` and `actions` apps are obsolete and not used. Analytics will be created from scratch later as a separate project.

- [ ] Create `speakasap-content-service` (NestJS)
- [ ] Extract content models: `grammar`, `phonetics`, `dictionary`, `songs`, `language`
- [ ] Migrate content data
- [ ] Implement content API (GET endpoints)
- [ ] Set up content management interface
- [ ] Integrate with ai-microservice for translations
- [ ] Deploy

**Port**: 4201  
**Database**: `speakasap_content_db`

**Deliverables**:

- ✅ Content service running
- ✅ Infrastructure ready for next phases

---

### Phase 2: Independent Services

**Goal**: Extract services with minimal dependencies

#### 2.1 Certification Service

- [ ] Create `speakasap-certification-service` (NestJS)
- [ ] Extract models: `certificates`, `education_certificates`, `quests`, `user_quest`
- [ ] Implement certificate generation (PDF templates)
- [ ] Implement quest/gamification system
- [ ] Create certificate API
- [ ] Migrate certificate data
- [ ] Deploy

**Port**: 4202  
**Database**: `speakasap_certification_db`

#### 2.2 Assessment Service

- [ ] Create `speakasap-assessment-service` (NestJS)
- [ ] Extract models: `language_tests`, `user_tests`
- [ ] **Note**: `teacher_tests` is obsolete and out of scope - not to be migrated
- [ ] Implement test creation and management
- [ ] Implement test scoring logic
- [ ] Create assessment API
- [ ] Migrate test data
- [ ] Deploy

**Port**: 4203  
**Database**: `speakasap_assessment_db`

**Deliverables**:

- ✅ Certification service running
- ✅ Assessment service running
- ✅ 2 independent services extracted

---

### Phase 3: Core Education Services

**Goal**: Extract core education functionality

#### 3.1 Course Service

- [ ] Create `speakasap-course-service` (NestJS)
- [ ] Extract models: `products`, `offers`, `pricing`
- [ ] Implement course products and pricing API
- [ ] Implement offers and promotions management
- [ ] Integrate with education-service for course catalog
- [ ] Migrate product and pricing data
- [ ] Deploy

**Port**: 4205  
**Database**: `speakasap_course_db`

#### 3.2 Education Service

- [ ] Create `speakasap-education-service` (NestJS)
- [ ] Extract models: `education` (course catalog, lessons, homework, groups, student courses, course_materials, seven, mini, native)
- [ ] **Note**: `marathon` app will be extracted separately as marathon-service (see separate roadmap)
- [ ] Implement course catalog management (includes all functionality from obsolete `courses` app)
- [ ] Implement course structure and curriculum management
- [ ] Implement course materials management
- [ ] Implement lesson management
- [ ] Implement homework system
- [ ] Implement group management
- [ ] Implement student progress tracking
- [ ] **Integrate AI-teacher (Core Feature)**:
  - [ ] Integrate AI-powered chat for language practice and Q&A
  - [ ] Implement AI-generated personal learning roadmaps
  - [ ] Implement AI-powered pronunciation training and feedback
  - [ ] Implement real-time AI assistance during lessons
  - [ ] Implement personalized AI learning recommendations
  - [ ] Set up AI-teacher as core service for education platform
- [ ] Integrate with course-service for products/pricing
- [ ] Integrate with user-service
- [ ] Integrate with ai-microservice (CRITICAL - AI-teacher is core feature)
- [ ] Migrate education and course data
- [ ] Deploy

**Port**: 4206  
**Database**: `speakasap_education_db`

#### 3.3 User Service

- [ ] Create `speakasap-user-service` (NestJS)
- [ ] Extract models: `students`, `employees` (teachers)
- [ ] Integrate with auth-microservice (remove local auth)
- [ ] Implement user profile management
- [ ] Implement teacher management
- [ ] Implement social auth integration
- [ ] Migrate user data
- [ ] Deploy

**Port**: 4207  
**Database**: `speakasap_user_db`

**Deliverables**:

- ✅ Course service running
- ✅ Education service running with **AI-teacher integration (core feature)**
- ✅ User service running
- ✅ Core education functionality extracted
- ✅ AI-teacher providing: chat, personal roadmaps, pronunciation training

---

### Phase 4: Payment & E-commerce

**Goal**: Extract payment and order management

#### 4.1 Payment Service

- [ ] Create `speakasap-payment-service` (NestJS)
- [ ] Extract models: `orders`, `discount`, `subscription`
- [ ] Integrate with payments-microservice (remove local payment processing)
- [ ] Implement order management
- [ ] Implement discount code system
- [ ] Implement subscription management
- [ ] Implement invoice generation
- [ ] Migrate order data
- [ ] Deploy

**Port**: 4208  
**Database**: `speakasap_payment_db`

#### 4.2 Notification Service

- [ ] Create `speakasap-notification-service` (NestJS)
- [ ] Extract models: `notifications`
- [ ] Integrate with notifications-microservice
- [ ] Implement notification templates
- [ ] Implement notification preferences
- [ ] **Note**: Telegram bot is handled by shared notifications-microservice, not speakasap-notification-service
- [ ] Migrate notification data
- [ ] Deploy

**Port**: 4209  
**Database**: `speakasap_notification_db`

**Note**: **helpdesk-microservice** is **out of scope** for speakasap refactoring. The current `helpdesk` app is obsolete and will not be migrated. A new **helpdesk-microservice** will be built from scratch as a separate shared microservice for the entire statex.cz ecosystem. It will be developed independently and is not part of this refactoring plan.

#### 4.3 Salary Service

- [ ] Create `speakasap-salary-service` (NestJS)
- [ ] Extract models: `expenses` (salary expenses), `employees` (contracts)
- [ ] Implement salary calculation logic (contract-based, performance-based)
- [ ] Implement teacher payment tracking and history
- [ ] Implement salary payment schedules and automation
- [ ] Implement salary expense categorization
- [ ] Integrate with user-service for employee data
- [ ] Create salary management API (admin interface for <https://speakasap.com/administrator/salary/>)
- [ ] Implement salary reporting and analytics
- [ ] Migrate salary and expense data
- [ ] Deploy

**Port**: 4212  
**Database**: `speakasap_salary_db`
**Production URL**: <https://speakasap.com/administrator/salary/>

#### 4.5 Financial Service

- [ ] Create `speakasap-financial-service` (NestJS)
- [ ] Extract models: `products` (billing categories), `orders` (revenue data), `expenses` (non-salary)
- [ ] Implement billing categories management (admin interface for <https://speakasap.com/administrator/billing/categories/>)
- [ ] Implement financial analytics and reporting engine
- [ ] Implement revenue tracking by category and time period
- [ ] Implement expense categorization and analysis
- [ ] Create financial dashboards API with real-time metrics
- [ ] Implement revenue vs. expense analysis
- [ ] Implement business KPIs and metrics calculation
- [ ] Integrate with payment-service for revenue data
- [ ] Integrate with salary-service for salary expense data
- [ ] Migrate financial data and billing categories
- [ ] Deploy

**Port**: 4213  
**Database**: `speakasap_financial_db`
**Production URL**: <https://speakasap.com/administrator/billing/categories/>

**Deliverables**:

- ✅ Payment service running
- ✅ Notification service running
- ✅ Salary service running
- ✅ Financial service running
- ✅ E-commerce and financial functionality extracted
- **Note**: helpdesk-microservice is out of scope - will be built separately from scratch

---

### Phase 5: Frontend & API Gateway

**Goal**: Build modern frontend and API gateway

#### 5.1 API Gateway

- [ ] Create `speakasap-api-gateway` (NestJS)
- [ ] Implement request routing to all services
- [ ] Implement authentication middleware (auth-microservice)
- [ ] Implement rate limiting
- [ ] Implement API versioning
- [ ] Implement request/response logging
- [ ] Deploy

**Port**: 4210

#### 5.2 Frontend Application

- [ ] Create `speakasap-frontend` (Next.js)
- [ ] Design modern UI/UX
- [ ] Implement student portal
- [ ] Implement teacher portal
- [ ] Implement admin dashboard
- [ ] Integrate with all microservices via API Gateway
- [ ] Implement authentication flow
- [ ] Deploy

**Port**: 4211

**Deliverables**:

- ✅ API Gateway running
- ✅ Frontend application running
- ✅ Modern user interface

---

### Phase 6: Integration

**Goal**: Integrate all services

**Note**: Testing is **out of scope** for this refactoring. We test in practice and fix bugs on the fly. No automated tests, unit tests, integration tests, or load tests will be created.

#### 6.1 Service Integration

- [ ] Set up event-driven communication (RabbitMQ)
- [ ] Implement service-to-service communication
- [ ] Set up service discovery
- [ ] Implement health checks
- [ ] **Note**: Monitoring and alerting will be handled by separate shared monitoring microservice (out of scope for this refactoring)

#### 6.2 Data Migration

- [ ] Final data migration from legacy system
- [ ] Data validation and verification
- [ ] Set up data backup procedures

#### 6.3 Documentation

**Note**: Testing is **out of scope** - we test in practice and fix bugs on the fly.

- [ ] API documentation (OpenAPI/Swagger)
- [ ] Architecture documentation
- [ ] Deployment documentation
- [ ] User documentation

**Deliverables**:

- ✅ All services integrated
- ✅ Complete documentation

---

### Phase 7: Migration & Decommissioning

**Goal**: Migrate production traffic and decommission legacy system

#### 7.1 Gradual Migration

- [ ] Set up blue/green deployment
- [ ] Migrate read-only traffic first
- [ ] Migrate user authentication
- [ ] Migrate course browsing
- [ ] Migrate payment processing
- [ ] Migrate all functionality

#### 7.2 Monitoring

**Note**: Monitoring is **out of scope** for this refactoring. A separate shared monitoring microservice will be built in the shared environment to handle:

- Error rate monitoring
- Performance monitoring
- User feedback tracking
- Alerting and notifications
- Service health dashboards

For this refactoring phase:

- [ ] Set up rollback procedures
- [ ] Basic health check endpoints (for service discovery, not monitoring infrastructure)

#### 7.3 Legacy Decommissioning

- [ ] Archive legacy database
- [ ] Archive legacy codebase
- [ ] Update DNS and routing
- [ ] Decommission legacy infrastructure

**Deliverables**:

- ✅ Production traffic on new system
- ✅ Legacy system decommissioned
- ✅ Full migration complete

---

## 6. Port Allocation

Following statex.cz port allocation strategy:

**Port Range**: 42xx (speakasap application)

| Service | Port | Description |
| ------- | ---- | ----------- |
| **speakasap-content-service** | 4201 | Content management (grammar, phonetics, dictionary) |
| **speakasap-certification-service** | 4202 | Certificates and achievements |
| **speakasap-assessment-service** | 4203 | Tests and assessments |
| **speakasap-course-service** | 4205 | Course products, pricing, and offers |
| **speakasap-education-service** | 4206 | Course catalog, structure, lessons, and education (includes obsolete `courses` app) |
| **speakasap-user-service** | 4207 | User and teacher management |
| **speakasap-payment-service** | 4208 | Orders and payments |
| **speakasap-notification-service** | 4209 | Notifications |
| **speakasap-api-gateway** | 4210 | API Gateway |
| **speakasap-frontend** | 4211 | Frontend application |
| **speakasap-salary-service** | 4212 | Staff salary and payment management |
| **speakasap-financial-service** | 4213 | Business financial analytics and billing categories |

---

## 7. Database Schema Strategy

### 7.1 Database per Service

Each microservice will have its own database schema on the shared database-server:

- `speakasap_content_db`
- `speakasap_certification_db`
- `speakasap_assessment_db`
- `speakasap_course_db`
- `speakasap_education_db`
- `speakasap_user_db`
- `speakasap_payment_db`
- `speakasap_notification_db`
- `speakasap_salary_db`
- `speakasap_financial_db`

### 7.2 Data Migration

- Extract data from Django models
- Transform to new schema
- Load into microservice databases
- Validate data integrity
- Dual-write period during transition

---

## 8. Event-Driven Architecture

### 8.1 Events

Services will communicate via RabbitMQ events:

- `user.created` - New user registered
- `user.updated` - User profile updated
- `course.created` - New course created
- `course.updated` - Course updated
- `lesson.completed` - Lesson completed by student
- `order.created` - New order created
- `order.paid` - Order payment confirmed
- `certificate.issued` - Certificate issued
- `notification.sent` - Notification sent
- `salary.calculated` - Salary calculated for employee
- `salary.paid` - Salary payment processed
- `financial.report.generated` - Financial report generated

### 8.2 Event Handlers

Each service subscribes to relevant events and updates its state accordingly.

---

## 9. Success Criteria

### 9.1 Technical Success

- ✅ All services running independently
- ✅ All services using shared microservices (auth, database, logging, notifications, payments)
- ✅ Modern technology stack (NestJS, Next.js, TypeScript)
- ✅ Blue/green deployment working
- ✅ All functionality working (tested in practice, bugs fixed on the fly)
- ✅ API documentation complete
- ✅ Performance meets or exceeds legacy system

### 9.2 Business Success

- ✅ All legacy functionality preserved
- ✅ Zero downtime migration
- ✅ Improved performance and scalability
- ✅ Better maintainability
- ✅ Ready for future enhancements

---

## 13. Additional Considerations

### 13.1 Legacy Features to Preserve

- **Course Types**: Seven, Mini, Native courses - all preserved
- **Marathon Courses**: Extracted as separate marathon-service (see Section 2.2) - not part of speakasap refactoring
- **Payment Methods**: PayPal, WebPay, Invoices, Android payments - migrated to payments-microservice
- **Social Authentication**: Google, Facebook - migrated to auth-microservice
- **Telegram Bot**: Handled by shared notifications-microservice (not speakasap-specific)
- **Certificate Generation**: PDF templates - preserved in speakasap-certification-service
- **Gamification**: Quests system - preserved in speakasap-certification-service

### 13.2 Features to Enhance

- **Modern UI/UX**: Replace Django templates with Next.js
- **Mobile Responsiveness**: Modern responsive design
- **Real-time Updates**: WebSocket support for live updates
- **Advanced Analytics**: Enhanced reporting and dashboards
- **AI-Powered Features**: Content generation, translations, recommendations
- **AI-Teacher (Core Feature)**: AI-powered chat, personal roadmaps, pronunciation training - core service for education platform
- **Performance**: Better caching, CDN integration
- **Security**: Enhanced authentication, rate limiting, security headers

### 13.3 Migration Strategy Details

#### Data Migration Approach

1. **Dual-Write Period**: Write to both legacy and new systems
2. **Gradual Cutover**: Migrate features one by one
3. **Data Validation**: Verify data integrity after migration
4. **Rollback Plan**: Ability to rollback if issues occur

#### Service Extraction Order

1. **Low-Risk First**: Read-only services (content)
2. **Independent Services**: Services with minimal dependencies
3. **Core Services**: Critical business logic (courses, education, users)
4. **Integration Services**: Payment, notifications (depend on shared microservices)
5. **Frontend Last**: After all backend services are stable

### 13.4 Technology Migration Details

#### Backend Migration

- **Django Models → Prisma/TypeORM**: Database schema migration
- **Django Views → NestJS Controllers**: API endpoint migration
- **Django Admin → Custom Admin**: Admin interface rebuild
- **Celery Tasks → RabbitMQ Events**: Background job migration

#### Frontend Migration

- **Django Templates → Next.js Pages**: Page-by-page migration
- **jQuery → React**: Component-by-component migration
- **Bootstrap 3 → Modern CSS**: UI framework upgrade
- **Server-Side Rendering**: Next.js SSR for better performance

### 13.5 Integration Points Summary

| Integration Type | Source | Target | Method |
| --------------- | ------ | ------ | ------ |
| Authentication | All services | auth-microservice | JWT tokens |
| Database | All services | database-server | PostgreSQL schemas |
| Logging | All services | logging-microservice | HTTP API |
| Notifications | speakasap-notification-service | notifications-microservice | HTTP API |
| Payments | speakasap-payment-service | payments-microservice | HTTP API |
| AI Services | speakasap-content-service, speakasap-education-service (AI-teacher core feature) | ai-microservice | HTTP API |
| Events | All services | RabbitMQ | Message queue |
| External Access | All services | nginx-microservice | Reverse proxy |

---

## 14. Technical Implementation Details

### 14.1 RabbitMQ Event Structure

All events follow a consistent structure for reliable communication:

```typescript
interface BaseEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  source: string;
  version: string;
  data: Record<string, any>;
}
```

**Event Exchange Pattern**:

- Exchange: `speakasap.events`
- Routing Keys: `{domain}.{action}` (e.g., `user.created`, `course.updated`)
- Queue Naming: `{service}.{event-type}` (e.g., `user-service.user.created`)

**Event Examples**:

```typescript
// User Events
user.created: { userId, email, role, createdAt }
user.updated: { userId, changes, updatedAt }
user.deleted: { userId, deletedAt }

// Course Events
course.created: { courseId, title, language, createdAt }
course.updated: { courseId, changes, updatedAt }
course.published: { courseId, publishedAt }

// Education Events
lesson.completed: { lessonId, userId, courseId, completedAt, score }
homework.submitted: { homeworkId, userId, courseId, submittedAt }
progress.updated: { userId, courseId, progress, updatedAt }

// AI-Teacher Events (Core Feature)
ai.chat.started: { chatId, userId, courseId, lessonId, startedAt }
ai.chat.message: { chatId, userId, message, response, timestamp }
ai.roadmap.generated: { roadmapId, userId, courseId, roadmap, generatedAt }
ai.pronunciation.trained: { trainingId, userId, word, score, feedback, timestamp }
ai.assistance.requested: { requestId, userId, lessonId, context, timestamp }
ai.recommendation.generated: { recommendationId, userId, recommendations, generatedAt }

// Payment Events
order.created: { orderId, userId, amount, currency, items }
order.paid: { orderId, paymentId, paidAt, amount }
subscription.activated: { subscriptionId, userId, courseId, activatedAt }

// Certification Events
certificate.issued: { certificateId, userId, courseId, issuedAt }
quest.completed: { questId, userId, completedAt, rewards }
```

### 14.2 API Versioning Strategy

**Versioning Approach**: URL-based versioning (`/api/v1/`, `/api/v2/`)

**Version Lifecycle**:

1. **v1**: Initial API version (all legacy endpoints)
2. **v2**: Enhanced API with improvements (gradual migration)
3. **Deprecation**: Notice period before version removal
4. **Breaking Changes**: New major version required

**Version Management**:

- API Gateway handles version routing
- Services support multiple versions simultaneously
- Documentation clearly marks deprecated endpoints
- Client libraries support version selection

### 14.3 Security Considerations

**Authentication & Authorization**:

- JWT tokens from auth-microservice (expires in 24h)
- Refresh tokens for long-lived sessions
- Role-based access control (RBAC) per service
- API Gateway validates all tokens

**Data Security**:

- All sensitive data encrypted at rest
- TLS 1.3 for all service-to-service communication
- PII (Personally Identifiable Information) handling per GDPR
- Secure password storage (bcrypt via auth-microservice)

**API Security**:

- Rate limiting per user/IP (API Gateway)
- Request size limits
- Input validation and sanitization
- SQL injection prevention (ORM/parameterized queries)
- XSS prevention (frontend sanitization)

**Service-to-Service Security**:

- API keys for service authentication
- Network isolation (Docker networks)
- Service mesh for advanced security (future consideration)

### 14.4 Performance Optimization

**Caching Strategy**:

- Redis for frequently accessed data
- Cache invalidation via events
- CDN for static assets (frontend)
- Database query result caching

**Database Optimization**:

- Indexes on frequently queried fields
- Connection pooling
- Read replicas for analytics queries (future)
- Database query optimization and monitoring

**API Performance**:

- Response compression (gzip)
- Pagination for large datasets
- Field selection (GraphQL-like queries)
- Async processing for heavy operations

**Frontend Performance**:

- Next.js SSR for initial load
- Code splitting and lazy loading
- Image optimization
- Service worker for offline support (future)

### 14.5 Monitoring and Observability

**Note**: Monitoring infrastructure is **out of scope** for this refactoring. A separate shared monitoring microservice will be built in the shared environment to handle all monitoring, metrics, tracing, alerting, and dashboards.

**Logging** (handled by logging-microservice):

- Structured logging (JSON format)
- Log levels: ERROR, WARN, INFO, DEBUG
- Centralized via logging-microservice
- Log retention: 90 days

**Monitoring** (out of scope - separate shared microservice):

- Service health metrics (uptime, response time)
- Business metrics (orders, users, courses)
- Performance metrics (latency, throughput)
- Error rates and types
- Distributed tracing for request flows
- Correlation IDs across services
- Performance bottleneck identification
- Error rate thresholds
- Performance degradation alerts
- Service downtime notifications
- Business metric anomalies
- Service health dashboard
- Business metrics dashboard
- Performance monitoring dashboard
- Error tracking dashboard

**Health Checks** (basic service functionality):

- Each service will expose `/health` endpoint for basic health checks
- Used for service discovery and load balancer health checks
- Not part of monitoring infrastructure

### 14.7 Deployment Strategy

**Blue/Green Deployment**:

- Zero-downtime deployments
- Instant rollback capability
- Traffic switching via nginx-microservice
- Database migration compatibility

**Feature Flags**:

- Gradual feature rollout
- A/B testing support
- Emergency feature disable
- User segment targeting

**Database Migrations**:

- Backward-compatible migrations
- Migration rollback procedures
- Data migration scripts
- Migration validation in staging (no automated testing)

**Release Process**:

1. Development → Feature branch
2. Code review and approval
3. Staging deployment
4. Production deployment (blue/green)
5. Validation and verification (monitoring handled by separate shared monitoring microservice)
6. Traffic switch and verification
7. **Note**: Testing is done in practice - bugs are fixed on the fly. No automated tests.

### 14.8 Development Rules and Coding Standards

**Configuration Management - No Hardcoded Values**:

- **MANDATORY**: All configuration values MUST come from environment variables (`.env` files)
- **NO HARDCODED VALUES**: No hardcoded URLs, ports, API keys, credentials, or any configuration values in code
- **Single Source of Truth**: `.env` files are the single source of truth for all configuration
- **Environment Variables**: Use `process.env.VARIABLE_NAME` (Node.js/NestJS) or equivalent for all configuration
- **`.env.example` Files**: All services must have `.env.example` files with all variable names (without secret values)
- **Secret Management**: Never commit `.env` files with secrets to version control
- **Configuration Validation**: Validate all required environment variables on service startup
- **Default Values**: Provide sensible defaults in code, but allow override via environment variables

**Examples of What Must Be in .env**:

- Service URLs (database, microservices, external APIs)
- Ports and host addresses
- API keys and tokens
- Database connection strings
- JWT secrets
- Payment provider credentials
- Email service credentials
- Feature flags
- Timeout values
- Rate limits
- Any other configurable values

**Code Examples**:

```typescript
// ❌ BAD - Hardcoded values
const dbUrl = 'postgresql://user:pass@localhost:5432/db';
const apiKey = 'sk-1234567890';
const serviceUrl = 'https://api.example.com';

// ✅ GOOD - Environment variables
const dbUrl = process.env.DATABASE_URL;
const apiKey = process.env.API_KEY;
const serviceUrl = process.env.SERVICE_URL || 'https://api.example.com';
```

**Enforcement**:

- Code reviews must check for hardcoded values
- Linting rules should flag hardcoded URLs, ports, and credentials
- CI/CD pipeline should validate `.env.example` completeness
- All services must fail fast if required environment variables are missing

---

## 15. Future Enhancements

### 15.1 Potential Microservices (Future)

- **speakasap-recommendation-service**: AI-powered course recommendations
- **speakasap-video-service**: Video streaming and processing
- **speakasap-chat-service**: Real-time chat and messaging (Note: AI-teacher chat is already core feature in speakasap-education-service)
- **speakasap-mobile-api**: Mobile app backend API

### 15.2 Technology Upgrades (Future)

- **GraphQL API**: More flexible data fetching
- **gRPC**: High-performance service-to-service communication
- **Service Mesh**: Advanced traffic management and security
- **Kubernetes**: Container orchestration (if scaling beyond Docker Compose)

### 15.3 Feature Enhancements (Future)

- **Mobile Apps**: Native iOS and Android applications
- **Offline Support**: Progressive Web App (PWA) capabilities
- **Real-time Collaboration**: Live lessons and group activities
- **Advanced Analytics**: Machine learning for learning analytics
- **Multi-tenant Support**: White-label platform for partners

---
