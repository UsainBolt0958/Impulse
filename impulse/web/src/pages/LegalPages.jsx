import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';
import Footer from '@/components/Footer';
import ThemeToggle from '@/components/ThemeToggle';

const CONTACT_EMAIL = 'impulsepreps@gmail.com';
const ACCOUNT_DELETION_EMAIL = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Delete my Impulse account and data')}`;
const LAST_UPDATED = '10 November 2026';

function Section({ title, children }) {
  return (
    <section className="mt-9">
      <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">
        {children}
      </div>
    </section>
  );
}

function LegalPages() {
  const isPrivacy = useLocation().pathname === '/privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms & Conditions';

  return (
    <>
      <Helmet>
        <title>{title} - Impulse</title>
        <meta
          name="description"
          content={isPrivacy
            ? 'How Impulse collects, uses, stores, and protects personal information.'
            : 'Terms and conditions for using the Impulse study and practice-test service.'}
        />
      </Helmet>
      <main className="min-h-screen">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
            <Link to="/" className="text-lg font-black uppercase tracking-[0.2em] text-foreground">
              Impulse
            </Link>
            <nav aria-label="Legal documents" className="flex items-center gap-4 text-sm">
              <Link
                to="/privacy"
                aria-current={isPrivacy ? 'page' : undefined}
                className={isPrivacy ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'}
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                aria-current={!isPrivacy ? 'page' : undefined}
                className={!isPrivacy ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'}
              >
                Terms
              </Link>
              <ThemeToggle />
            </nav>
          </div>

          <article className="py-8 sm:py-12">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Last updated: {LAST_UPDATED}
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-5xl">{title}</h1>

            {isPrivacy ? <PrivacyPolicy /> : <TermsConditions />}
          </article>
        </div>
        <Footer />
      </main>
    </>
  );
}

function PrivacyPolicy() {
  return (
    <>
      <p className="mt-6 text-base leading-7 text-muted-foreground sm:text-lg">
        This policy describes how Impulse handles information when you use its study, question-practice,
        test-series, profile, friends, notebook, and payment features. Impulse is operated by Yash Bharati
        as an education-technology service based in Dharwad, Karnataka 580001, India. Privacy and data
        requests can be sent to <a className="font-semibold text-foreground underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      <p className="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
        This document explains the product as currently implemented. It is not legal advice. Privacy
        requirements depend on your circumstances and the laws that apply; the operator should have this
        policy reviewed and keep it aligned with actual hosting, provider settings, and operating practices.
      </p>

      <Section title="1. Information we handle">
        <p><strong className="text-foreground">Account and sign-in information.</strong> When you choose Google sign-in, Google and our authentication provider (Supabase) process the sign-in. Impulse receives an account identifier and may receive your Google email address, name, and profile-picture URL, depending on your Google account and permissions. Impulse stores a display name, username, avatar URL, and account identifier for your profile. Your email is not shown to other learners by the friends feature.</p>
        <p><strong className="text-foreground">Study and account data.</strong> Depending on the features you use, this may include questions solved or marked, answers and attempt history, test and exam sessions, scores and performance summaries, custom-test results, notebooks and saved question references, activity dates, profile-stat visibility choices, and app preferences such as theme and text size. These records support progress, sync, review, and personalized features.</p>
        <p><strong className="text-foreground">Friends and profile information.</strong> We process usernames, display names, avatar URLs, friend searches, connection requests, accepted connections, and the profile statistics you choose to show. Friends can search for usernames and see profile details and statistics made available through the profile and its visibility controls. Do not put anything in a profile or notebook that you do not want stored or, where a feature makes it visible, shared with connected users.</p>
        <p><strong className="text-foreground">Pro applications and historical payment information.</strong> If you apply for Pro, we store your name, Google account email, and phone number in Supabase for application review and follow-up. Checkout is not currently available in the app; payment arrangements are handled separately after we contact you. We retain historical payment and order records for administrative reference. Impulse does not receive or store your UPI PIN or bank credentials.</p>
        <p><strong className="text-foreground">Device storage and service activity.</strong> The app uses browser local storage for sign-in/session support, study state, test recovery, preferences, and a random client-session identifier used with API requests. The server uses limited session cookies for certain test and administrator functions. The API also maintains operational metrics such as route groups, request and response sizes, status codes, latency, and active-session counts. The app's own metrics implementation uses rolling in-memory windows of up to 7 days for request summaries and up to 30 days for daily/active-user summaries; a server restart may reset this in-memory data. These are service-health and usage metrics, not advertising profiles.</p>
        <p><strong className="text-foreground">Support and communications.</strong> If you contact us, we receive the email address, message, and any information you choose to include so we can respond and handle the request.</p>
      </Section>

      <Section title="2. How we use information">
        <ul className="list-disc space-y-2 pl-6">
          <li>To create and secure accounts, authenticate users, and maintain profiles.</li>
          <li>To provide practice questions, tests, saved work, progress history, analysis, profile, and friend features.</li>
          <li>To synchronize study data between your browser and your account, and to restore eligible test sessions.</li>
          <li>To review Pro applications, contact applicants, manage memberships, and retain historical payment records.</li>
          <li>To measure reliability and capacity, diagnose failures, protect the service, and detect abuse or payment fraud.</li>
          <li>To respond to support, privacy, safety, and legal requests and to comply with applicable law.</li>
        </ul>
        <p>We do not currently sell personal information or use it for targeted advertising. We do not use study data to make decisions about school admission, employment, credit, or other eligibility.</p>
      </Section>

      <Section title="3. Where information is stored and who processes it">
        <p><strong className="text-foreground">Supabase.</strong> The app uses Supabase for authentication and, when configured, account profiles, synchronized user data, study attempts, friendships, billing records, and service content. Supabase processes information under its own service terms and privacy documentation.</p>
        <p><strong className="text-foreground">Google.</strong> Google processes information when you use Google sign-in. Your use of Google is also subject to Google's terms and privacy policy.</p>
        <p><strong className="text-foreground">Payment services.</strong> The app currently has no integrated payment gateway or in-app checkout. If a payment method is arranged separately after a Pro application, the relevant provider's terms and privacy practices apply to that transaction.</p>
        <p><strong className="text-foreground">Infrastructure providers.</strong> The website, API, database, and storage must run on hosting and network providers. Those providers may process connection data (such as IP address, browser/device information, and request logs) to deliver and secure their infrastructure. Provider locations, retention, and subprocessors depend on the deployment configuration. Information may be processed outside your state or country, including outside India, subject to provider safeguards and applicable law.</p>
        <p>We do not disclose account information to third parties for their independent marketing. We may disclose information to a provider acting for the service, when you direct us to, to protect people or the service, or when lawfully required. If the service or its operator is reorganized or transferred, information may be transferred with it subject to applicable safeguards.</p>
      </Section>

      <Section title="4. Browser storage and cookies">
        <p>Impulse stores essential app state in your browser, including saved work, session recovery data, display preferences, and a random client-session identifier. The app also uses limited cookies for server-managed test/admin sessions. These mechanisms help provide features, maintain security, and keep work from being lost. Clearing browser storage may remove unsynchronized local work or sign you out.</p>
        <p>The current app does not implement an advertising-cookie or third-party analytics-cookie program. The Google sign-in flow, hosting provider, or other third parties may use their own technologies when you visit or use their services; those providers explain their own practices.</p>
      </Section>

      <Section title="5. Sharing and profile visibility">
        <p>Your account email is not exposed through friend search. The friends feature uses usernames to find profiles and lets users request and accept connections. Your display name, username, avatar, and available profile information can be visible to connected users. Some profile statistics have visibility controls; changing a setting affects future display but cannot retrieve information already viewed or copied by another person.</p>
        <p>Study data is used for your account features and is not intended to be a public feed. Do not treat a visibility control as a security boundary for information you choose to share or as a way to control copies made by other users.</p>
      </Section>

      <Section title="6. Retention and deletion">
        <p>Account, profile, and study records are kept while needed to provide your account and features. There is currently no in-app account-deletion control. To request account closure or deletion, email us from the address associated with the account. Include your Impulse username and the account email so we can identify and verify the account. If you are a parent or legal guardian making a request for a minor, say so in the email; we may ask for reasonable information to verify your authority. Do not send passwords, UPI PINs, or identity documents unless we specifically explain a lawful need for them.</p>
        <p>
          <a
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground underline-offset-4 hover:underline"
            href={ACCOUNT_DELETION_EMAIL}
          >
            Email to request account deletion
          </a>
        </p>
        <p>The email opens a message addressed to <a className="font-semibold text-foreground underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the subject “Delete my Impulse account and data.” You can also send the request manually with that subject. We will review verified requests and process them as soon as reasonably practicable, subject to applicable law and operational constraints. We do not currently promise a fixed completion deadline.</p>
        <p>Some information may need to be retained after a deletion request to meet legal, accounting, payment-reconciliation, security, or dispute-resolution obligations. In particular, payment-order records are linked to user accounts in the current database design. Backups, hosting logs, and provider-held copies may remain until their normal deletion or rotation cycle. We do not currently publish a fixed number of days for completion of deletion requests; contact us if you need an update on a request.</p>
        <p>Operational metrics are held in memory with the rolling periods described above. Local browser data remains on your device until it is cleared or removed by the app. You can clear browser storage through your browser settings, but unsynchronized data may be lost.</p>
      </Section>

      <Section title="7. Security">
        <p>We use access controls and technical safeguards present in the service, including authenticated access to account data and payment verification with the provider. No website, network transmission, or storage system can be guaranteed completely secure. Use a secure Google account and device, do not share sign-in access, and contact us promptly if you believe your account is being misused.</p>
      </Section>

      <Section title="8. Children and guardians">
        <p>Impulse is an educational service that may be used by learners of different ages. The app does not currently ask for a user's age or provide an in-app parental-consent workflow. If you are under 18, use the service only with the permission and supervision of a parent or legal guardian. A parent or guardian should review this policy and may contact us to ask questions or request access restriction or deletion.</p>
        <p>This notice does not replace any verifiable parental-consent or other obligation imposed by applicable law. We do not ask users to submit sensitive personal information in study notes or profile fields. If you believe a minor's information has been provided without appropriate permission, contact us at <a className="font-semibold text-foreground underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </Section>

      <Section title="9. Your choices and requests">
        <p>You can edit your display name and username, manage profile-stat visibility, remove local browser data, and stop using the service. You may request access, correction, deletion, or other rights available under applicable law by emailing <a className="font-semibold text-foreground underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We may ask for information reasonably needed to verify that the request concerns your account. We will respond in accordance with applicable law; legal retention duties and other lawful exceptions may apply.</p>
        <p>You can withdraw Google access through your Google account settings, and you can sign out of Impulse. Withdrawing access or signing out does not itself delete records already stored with Impulse or its providers; contact us for an account/data deletion request.</p>
      </Section>

      <Section title="10. Changes and contact">
        <p>We may update this policy when the service or applicable requirements change. We will post the revised version here and update the “Last updated” date. Material changes may also be announced in the service. Continuing to use the service after an update means the updated notice applies to future use, subject to any consent required by law.</p>
        <p>For a privacy question, request, or complaint, contact Yash Bharati, the operator based in Dharwad, Karnataka 580001, India, at <a className="font-semibold text-foreground underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Please include “Privacy request” in the subject and avoid sending passwords, UPI PINs, or unnecessary sensitive information.</p>
      </Section>
    </>
  );
}

function TermsConditions() {
  return (
    <>
      <p className="mt-6 text-base leading-7 text-muted-foreground sm:text-lg">
        These Terms &amp; Conditions apply to your access to and use of Impulse, an education-technology
        service operated by Yash Bharati, based in Dharwad, Karnataka 580001, India. By accessing or using the service, you agree to these
        terms. If you do not agree, do not use the service. If you are under 18, a parent or legal guardian
        must give permission and supervise your use.
      </p>
      <Section title="1. The service">
        <p>Impulse offers study and exam-preparation tools, which may include question practice, previous-paper browsing, test series, custom tests, test and performance analysis, notes/notebooks, calendars, saved questions, profiles, and friend connections. Features, content, prices, and availability may change. Some features require a Google-authenticated account and a username.</p>
        <p>Impulse is an independent practice service. It is not an official service of the National Testing Agency, the Indian Institutes of Technology, or any examination authority, and it does not claim their endorsement. Names and marks of third parties belong to their respective owners.</p>
      </Section>

      <Section title="2. Eligibility, accounts, and guardians">
        <ul className="list-disc space-y-2 pl-6">
          <li>Provide accurate account details, choose a username you are entitled to use, and keep your sign-in credentials and device secure.</li>
          <li>You are responsible for activity under your account and for promptly notifying us of suspected unauthorized use.</li>
          <li>Do not impersonate another person, use a username that violates another person's rights, or create accounts to evade a restriction.</li>
          <li>If you are under 18, obtain a parent or legal guardian's permission before creating or using an account. The app currently has no age-verification or in-app parental-consent feature, so a guardian must supervise use and contact us for help.</li>
        </ul>
        <p>We may suspend or restrict an account where reasonably necessary for security, suspected fraud, legal compliance, serious misuse, or protection of users. Where appropriate and lawful, we will try to explain the reason and allow you to contact us.</p>
      </Section>

      <Section title="3. Acceptable use">
        <p>Use Impulse lawfully and for personal learning and practice. You must not:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Break the law, infringe another person's rights, harass or threaten users, or use the service to exploit or endanger a minor.</li>
          <li>Attempt to bypass authentication, access another user's account or data, interfere with service security, or probe systems without permission.</li>
          <li>Use bots, scraping, or automated requests in a way that disrupts the service, extracts content at scale, or circumvents access controls.</li>
          <li>Upload or transmit malware, spam, unlawful material, or information you do not have permission to share.</li>
          <li>Copy, redistribute, resell, or commercially exploit the service or its content except as permitted by law or with the rights holder's permission.</li>
          <li>Use Impulse to cheat in an active examination or represent practice results as official results.</li>
        </ul>
      </Section>

      <Section title="4. Learning content and results">
        <p>Questions, explanations, answer keys, test content, and analytics are provided for practice and informational purposes. We aim to make them useful, but do not warrant that every question, solution, translation, score, or analysis is complete, error-free, current, or suitable for a particular examination. You should verify important material with authoritative sources.</p>
        <p>Impulse does not guarantee a score, admission, rank, scholarship, or other academic outcome. Practice scores and progress metrics are estimates based on the content and answers available in the service, not official examination results or professional advice.</p>
        <p>Past papers, third-party marks, and other materials may belong to examination authorities or other rights holders. Their presence does not transfer ownership or grant permission to republish them outside the service. If you believe content infringes your rights, contact us with enough detail to identify it.</p>
      </Section>

      <Section title="5. Your information and social features">
        <p>You retain rights you have in information you enter, such as notebook notes or profile details. You permit Impulse to store and process that information as needed to provide the features you use, keep the service secure, and operate the service, as described in the <Link className="font-semibold text-foreground underline" to="/privacy">Privacy Policy</Link>.</p>
        <p>Friend search and accepted connections expose selected profile details and, depending on your settings, study statistics to other users. You are responsible for what you choose to display. Do not use another user's profile or study information outside the feature's intended learning/social context.</p>
      </Section>

      <Section title="6. Prices, orders, and payment">
        <p>Basic is free. Pro is an annual membership; the current price is shown on the plans page and may be updated by an administrator. To request Pro, submit an application with your name and phone number; we will contact you to arrange checkout. In-app checkout is currently unavailable, and applying does not itself activate a paid membership.</p>
        <p>An administrator activates Pro only after checkout is confirmed. Membership lasts one year from approval and does not automatically renew. Any payment method, amount, and applicable provider terms will be provided separately before payment.</p>
      </Section>

      <Section title="7. Refunds and payment issues">
        <p>If you have a question about a separately arranged payment or Pro activation, contact <a className="font-semibold text-foreground underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Do not send your UPI PIN, password, OTP, or full bank credentials.</p>
        <p>Any payment processing and bank transfers arranged outside the app are handled by the selected third-party provider and your bank.</p>
      </Section>

      <Section title="8. Ownership and permitted use">
        <p>Impulse and its software, visual design, branding, and original content are owned by or licensed to the operator and protected by applicable intellectual-property laws. These terms give you a limited, personal, non-exclusive, non-transferable, revocable right to use the service for learning while it is available. They do not give you ownership of the service or third-party materials.</p>
        <p>You may not remove ownership notices, reverse engineer or copy the service except where the law permits, or use Impulse branding in a way that suggests endorsement. Any license to third-party content remains subject to its owner's terms.</p>
      </Section>

      <Section title="9. Availability, changes, and termination">
        <p>We work to keep Impulse available but do not promise uninterrupted access, permanent availability of a feature, or that locally saved work will synchronize successfully at all times. Maintenance, outages, security events, provider failures, or product changes may limit access. Keep your own copy of any information that is important to you.</p>
        <p>You may stop using the service at any time and may request account deletion as described in the <Link className="font-semibold text-foreground underline" to="/privacy">Privacy Policy</Link>. We may suspend or discontinue the service, or modify access, as permitted by law. Accrued payment obligations and clauses that by their nature should continue will survive termination.</p>
      </Section>

      <Section title="10. Disclaimers and liability">
        <p>To the extent permitted by law, the service is provided “as is” and “as available,” without a promise that it will be uninterrupted, error-free, or fit for every purpose. Nothing in these terms excludes a warranty, consumer protection, or liability that cannot lawfully be excluded.</p>
        <p>To the extent permitted by law, the operator is not responsible for indirect or consequential loss, loss caused by third-party networks or payment providers, or loss of unsynchronized local data. This does not exclude responsibility for fraud, wilful misconduct, or any other liability that applicable law does not allow to be excluded or limited.</p>
      </Section>

      <Section title="11. Changes to these terms">
        <p>We may update these terms as the service or law changes. The revised terms will be posted here with a new “Last updated” date. For a material change, we may provide notice in the service. Where law requires renewed consent, we will seek it. Continued use after an effective update constitutes acceptance only to the extent permitted by applicable law.</p>
      </Section>

      <Section title="12. Governing law and contact">
        <p>These terms are governed by the laws of India, subject to applicable consumer-protection and other mandatory laws. Courts of competent jurisdiction in India may hear disputes, without limiting any non-waivable right to bring a claim before another forum under applicable law.</p>
        <p>Questions, complaints, or legal notices may be sent to Yash Bharati, based in Dharwad, Karnataka 580001, India, at <a className="font-semibold text-foreground underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Please include enough information to identify your account or order, but do not send passwords, UPI PINs, or unnecessary sensitive information.</p>
      </Section>
    </>
  );
}

export default LegalPages;
