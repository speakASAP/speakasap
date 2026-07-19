import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | SpeakASAP',
  description:
    'How SpeakASAP collects, uses and protects your personal data, and how to exercise your rights under the GDPR.',
};

/**
 * Structure mirrors the alfares.cz privacy policy. Content is specific to this
 * service: reusing the alfares.cz text verbatim would describe Statex business
 * automation rather than language learning, which would make the document false.
 *
 * Controller details are verified (Alfares s.r.o., IČ 27138038 — the same entity
 * named in the marathon footer and the bazos operator block). Processing purposes
 * and processors are derived from what this codebase actually integrates with:
 * auth-microservice, payments-microservice, notifications-microservice.
 *
 * Facts that cannot be derived from code are marked [MISSING: ...] per the
 * ecosystem rule against guessing. Fill them in before publishing.
 */
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 prose prose-slate">
      <h1>Privacy Policy</h1>
      <p>
        <em>Last updated: [MISSING: publication date]</em>
      </p>

      <h2>Introduction</h2>
      <p>
        This policy explains what personal data SpeakASAP collects when you use the platform, why we
        process it, and what rights you have. It applies to the SpeakASAP website and learner,
        teacher and administrator areas.
      </p>

      <h2>Data controller</h2>
      <p>
        Alfares s.r.o., IČ 27138038, DIČ CZ27138038, Cetechovice 70, 768 02, Czech Republic.
        Registered at the Regional Court in Brno, section C, insert 67892.
      </p>
      <p>
        Contact for privacy matters: <a href="mailto:contact@alfares.cz">contact@alfares.cz</a>,
        +420 774 287 541.
      </p>
      <p>[MISSING: whether a Data Protection Officer is appointed, and their contact details]</p>

      <h2>Personal data we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — name, e-mail address and credentials, handled by our
          authentication service so that you can sign in.
        </li>
        <li>
          <strong>Learning data</strong> — course enrolment, progress, assessment results and
          certifications you earn on the platform.
        </li>
        <li>
          <strong>Payment data</strong> — records of course purchases. Card details are handled by
          the payment provider and never stored by us.
        </li>
        <li>
          <strong>Technical data</strong> — data strictly necessary to keep you signed in and to
          operate the site securely.
        </li>
      </ul>

      <h2>Legal basis for processing</h2>
      <p>
        We process account, learning and payment data to perform our contract with you (Art. 6(1)(b)
        GDPR). Security and abuse prevention rely on our legitimate interest (Art. 6(1)(f) GDPR).
      </p>
      <p>[MISSING: legal basis and scope for any marketing communications, if these are sent]</p>

      <h2>How we use your data</h2>
      <p>
        To provide courses and assessments, issue certifications, process payments, send
        service-related notifications about your account and courses, and to keep the platform
        secure and working.
      </p>

      <h2>Data sharing and processors</h2>
      <p>We share data only with processors acting on our instructions:</p>
      <ul>
        <li>Authentication service — identity and sign-in</li>
        <li>Payment service — course payments</li>
        <li>Notification service — transactional e-mail</li>
      </ul>
      <p>We do not sell personal data and do not share it for advertising.</p>
      <p>[MISSING: named third-party sub-processors behind these services, e.g. payment gateway and e-mail provider]</p>

      <h2>Data security</h2>
      <p>
        Access is restricted to what each service needs, traffic is encrypted in transit, and
        credentials are stored in a dedicated secret store rather than in application code.
      </p>

      <h2>Retention</h2>
      <p>[MISSING: retention periods per data category — account, learning records, payment records]</p>
      <p>
        Payment records are kept as long as Czech accounting and tax law requires.{' '}
        [MISSING: confirm the applicable statutory period]
      </p>

      <h2>Your rights</h2>
      <p>
        Under the GDPR you may request access to your data, correction, erasure, restriction of
        processing, portability, and you may object to processing based on legitimate interest.
        Where processing relies on consent, you may withdraw it at any time without affecting
        processing carried out before withdrawal.
      </p>

      <h2>Exercising your rights</h2>
      <p>
        Write to <a href="mailto:contact@alfares.cz">contact@alfares.cz</a>. We respond within one
        month, as required by the GDPR.
      </p>
      <p>
        You may also lodge a complaint with the Czech supervisory authority, Úřad pro ochranu
        osobních údajů (<a href="https://uoou.gov.cz">uoou.gov.cz</a>).
      </p>

      <h2>Cookies and storage</h2>
      <p>
        This site stores only what is strictly necessary to sign you in and keep the site working.
        We run no analytics, no marketing cookies and no cross-site tracking. Because nothing
        optional is stored, the consent notice discloses this rather than offering switches that
        would change nothing.
      </p>

      <h2>Children&rsquo;s privacy</h2>
      <p>[MISSING: minimum age for using the platform, and how parental consent is handled if minors may enrol]</p>

      <h2>International transfers</h2>
      <p>[MISSING: whether data leaves the EEA, and the transfer safeguard relied on if it does]</p>

      <h2>Data breaches</h2>
      <p>
        If a breach is likely to result in a risk to your rights, we notify the supervisory
        authority within 72 hours and inform affected users where the law requires it.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We publish changes on this page and update the date above. Material changes are announced
        before they take effect.
      </p>

      <h2>Contact</h2>
      <p>
        Alfares s.r.o., Cetechovice 70, 768 02, Czech Republic —{' '}
        <a href="mailto:contact@alfares.cz">contact@alfares.cz</a>
      </p>
    </main>
  );
}
