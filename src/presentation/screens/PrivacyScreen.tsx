import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { SeoMetadata } from "../../app/seo";
import externalLinkIcon from "../../assets/icons/external_link.svg";

const lastUpdated = "14 June 2026";

export function PrivacyScreen() {
  return (
    <main className="comp-rules-page privacy-page">
      <SeoMetadata />

      <article className="comp-rules-page__article privacy-page__article">
        <header className="comp-rules-page__header privacy-page__hero">
          <Link className="privacy-page__back" to="/dashboard">
            <ArrowLeft aria-hidden="true" />
            Back to ABG Master
          </Link>
          <div className="comp-rules-page__methodology-pill">
            <span />
            <p>ABG Master · Privacy notice</p>
          </div>
          <h1>How ABG Master handles data</h1>
          <p className="privacy-page__updated">Last updated {lastUpdated}</p>
          <p>
            ABG Master is an Australian-made educational app for practising blood gas interpretation. This notice
            explains what the app collects, why it is used, and where it may be processed.
          </p>
        </header>

        <section className="comp-rules-page__takeaway privacy-page__summary">
          <div className="comp-rules-page__section-label">
            <ShieldCheck aria-hidden="true" />
            <span>At a glance</span>
          </div>
          <div className="comp-rules-page__card privacy-page__panel">
            <h2>Summary</h2>
            <ul>
              <li>ABG Master is for education only. It is not a clinical system.</li>
              <li>ABG Master does not ask for, and is not designed to collect, real patient information.</li>
              <li>Some teaching cases may be manually written or adapted from clinical patterns, but they are changed so they are not intended to identify real patients.</li>
              <li>When completing practice cases, ABG Master may store your progress, answers, timing, and unlocked levels.</li>
              <li>Some information is stored in your browser so the app can remember your progress and recover from brief connection interruptions.</li>
              <li>Update-signup emails are used only for ABG Master updates unless this notice changes.</li>
            </ul>
          </div>
        </section>

        <section className="privacy-page__content" aria-label="Privacy notice details">
          <section className="comp-rules-page__section privacy-page__section">
            <h2>Information collected</h2>
            <div className="comp-rules-page__card privacy-page__panel">
              <p>Depending on how you use the app, ABG Master may process:</p>
              <ul>
                <li>Your email address, if you choose to join the update list.</li>
                <li>A temporary session ID so the app can recognise your current session and save progress.</li>
                <li>Your learning progress, preferences, unlocked levels, practice results, answers, and timing.</li>
                <li>Basic technical information, such as browser details, page URLs, errors, and performance information.</li>
                <li>Product analytics, such as page views and feature interactions, if analytics are enabled.</li>
                <li>With your permission, recordings of how you use the app and heatmaps showing which parts are used.</li>
              </ul>
            </div>
          </section>

          <section className="comp-rules-page__section privacy-page__section">
            <h2>Teaching cases</h2>
            <div className="comp-rules-page__card privacy-page__panel">
              <p>
                ABG Master includes generated and manually created teaching cases. Some cases may be inspired by
                real clinical scenarios, but they are written for education and have been modified so that they do not identify real patients.
              </p>
            </div>
          </section>

          <section className="comp-rules-page__section privacy-page__section">
            <h2>Information stored in your browser</h2>
            <div className="comp-rules-page__card privacy-page__panel">
              <p>
                ABG Master stores some information on your device so the app can remember your progress,
                preferences, current practice state, and any practice answers that have not finished submitting.
              </p>
              <p>
                This helps the app recover if your connection briefly drops out. If you clear your browser
                storage, you may lose local progress, preferences, or unsent practice data.
              </p>
            </div>
          </section>

          <section className="comp-rules-page__section privacy-page__section">
            <h2>Services ABG Master uses</h2>
            <div className="comp-rules-page__card privacy-page__panel">
              <p>ABG Master uses a small number of services to run the app, collect optional feedback, monitor errors, and understand which parts of the app are useful.</p>
              <ul>
                <li>Supabase, to manage saved practice, progress, case delivery, and submitted answers.</li>
                <li>Formspark or submit-form.com, to collect email addresses from people who join the update list.</li>
                <li>Sentry, to help detect errors and improve reliability.</li>
                <li>PostHog, to understand app usage such as page views and feature interactions, if analytics are enabled.</li>
                <li>Google Forms, if you choose to submit optional feedback.</li>
              </ul>
              <p>
                ABG Master uses Microsoft Clarity to help us understand how people use the app. Clarity may collect
                usage information such as clicks, scrolling, page views, device/browser information, heatmaps, and
                session recordings.
              </p>
              <p>
                We use this information to improve the app, identify confusing screens, fix usability issues, and
                monitor site performance. This data is collected using cookies and similar technologies.
              </p>
              <p>
                Microsoft may also process this data in accordance with the{" "}
                <a
                  className="comp-rules-page__inline-icon-link"
                  href="https://www.microsoft.com/en-ca/privacy/privacystatement"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Microsoft Privacy Statement
                  <img src={externalLinkIcon} alt="" aria-hidden="true" />
                </a>
                .
              </p>
              <p>
                Some of these services may store or process information outside Australia. ABG Master only aims
                to share the information needed to run, improve, and secure the app.
              </p>
            </div>
          </section>

          <section className="comp-rules-page__section privacy-page__section">
            <h2>How information is used</h2>
            <div className="comp-rules-page__card privacy-page__panel">
              <ul>
                <li>To load the app and keep practice working if your connection briefly drops out.</li>
                <li>To save your progress, preferences, unlocked levels, and practice results.</li>
                <li>To check submitted answers and update your learning progress.</li>
                <li>To send ABG Master updates if you choose to join the update list.</li>
                <li>To fix errors, prevent misuse, improve reliability, and understand which features are helpful.</li>
              </ul>
            </div>
          </section>

          <section className="comp-rules-page__section privacy-page__section">
            <h2>Your choices</h2>
            <div className="comp-rules-page__card privacy-page__panel">
              <ul>
                <li>You do not have to join the update list.</li>
                <li>You can clear your browser storage to remove local app data from your device.</li>
                <li>You can allow, decline, or change Microsoft Clarity analytics from the analytics choices in the app footer.</li>
                <li>You can ask to access, correct, or delete personal information connected to your email address.</li>
              </ul>
              <p>
                During the public beta, privacy requests can be sent through the feedback link in the app. A dedicated privacy
                contact will be added before a wider public launch.
              </p>
            </div>
          </section>

          <section className="comp-rules-page__section privacy-page__section">
            <h2>Educational use only</h2>
            <div className="comp-rules-page__card privacy-page__panel">
              <p>
                ABG Master is for training and education. It is not medical advice, clinical decision support, or a
                substitute for professional judgement.
              </p>
            </div>
          </section>
        </section>

        <footer className="comp-rules-page__footer">
          ABG Master · Educational tool. Not a substitute for clinical judgement.
        </footer>
      </article>
    </main>
  );
}
