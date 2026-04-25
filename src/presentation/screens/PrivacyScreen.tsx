import { Link } from "react-router-dom";
import { SeoMetadata } from "../../app/seo";
import { Surface } from "../primitives/Surface";

const lastUpdated = "25 April 2026";

export function PrivacyScreen() {
  return (
    <main className="privacy-page">
      <SeoMetadata />

      <section className="privacy-page__hero">
        <Link className="privacy-page__back" to="/">
          Back to ABG Master
        </Link>
        <div>
          <span className="privacy-page__eyebrow">Privacy notice</span>
          <h1>How ABG Master handles data</h1>
          <p>
            ABG Master is an Australian-made educational app for practising blood gas interpretation. This notice
            explains what the app collects, why it is used, and where it may be processed.
          </p>
          <p className="privacy-page__updated">Last updated: {lastUpdated}</p>
        </div>
      </section>

      <section className="privacy-page__content" aria-label="Privacy notice details">
        <Surface className="privacy-page__panel">
          <h2>Summary</h2>
			  <ul>
				<li>ABG Master is for education only. Do not enter real patient information.</li>
				<li>ABG Master does not ask for, and is not designed to collect, real patient information.</li>
				<li>Protected practice cases are delivered as needed rather than sending the full case library to your browser.</li>
				<li>Practice attempts are submitted through protected server functions, not direct browser writes.</li>
				<li>Some progress and pending practice data is stored in your browser to help with interrupted connectivity.</li>
				<li>Update-signup emails are used only for ABG Master updates unless this notice changes.</li>
			  </ul>
        </Surface>

        <Surface className="privacy-page__panel">
          <h2>Information collected</h2>
          <p>Depending on how you use the app, ABG Master may process:</p>
			  <ul>
				<li>Your email address if you ask to be notified about updates.</li>
				<li>Anonymous session identifiers that help the app recognise your session and save progress.</li>
				<li>Learning progress, preferences, unlocked levels, and practice results.</li>
				<li>Practice answers and timing when you submit a protected practice case.</li>
				<li>Technical diagnostics, such as errors, browser details, URLs, and performance context.</li>
				<li>Product analytics events, such as page views or feature interactions, if analytics are enabled.</li>
			  </ul>
			  <p>
				ABG Master does not ask for, and is not designed to collect, real patient information.
			  </p>
        </Surface>

        <Surface className="privacy-page__panel">
          <h2>Browser storage</h2>
			  <p>
				ABG Master uses browser storage for progress, preferences, information needed to start protected practice sessions,
				a small number of issued practice case slots, and pending submissions. This helps the app recover from brief
				connection interruptions. Clearing browser storage may remove local progress, preferences, or unsent practice data.
			  </p>
        </Surface>

        <Surface className="privacy-page__panel">
          <h2>Services used</h2>
          <p>ABG Master may use these service providers to operate the app:</p>
			  <ul>
				<li>Supabase for authentication, protected practice delivery, progress storage, and submissions.</li>
				<li>Formspark or submit-form.com for update-signup email collection.</li>
				<li>Sentry for error monitoring and reliability diagnostics.</li>
				<li>PostHog for product analytics, such as understanding which pages and features are used, if configured.</li>
				<li>Google Forms when you choose to submit optional feedback.</li>
			  </ul>
			  <p>
				These providers may process data outside Australia. ABG Master aims to share only what is needed to run,
				improve, and secure the app.
			  </p>
        </Surface>

        <Surface className="privacy-page__panel">
          <h2>How information is used</h2>
          <ul>
            <li>To load the app and keep practice available during short connectivity interruptions.</li>
            <li>To save learning progress and show personalised practice state.</li>
            <li>To score submitted practice cases and apply progress updates.</li>
            <li>To send product updates to people who explicitly request them.</li>
            <li>To diagnose reliability issues, prevent abuse, and understand which features are useful.</li>
          </ul>
        </Surface>

        <Surface className="privacy-page__panel">
          <h2>What not to enter</h2>
          <p>
            ABG Master is not a clinical system. Do not enter patient names, medical record numbers, dates of birth,
            contact details, or any other real patient information into feedback forms, signup forms, or practice flows.
          </p>
        </Surface>

        <Surface className="privacy-page__panel">
		  <h2>Your choices</h2>	
			  <ul>
				<li>You can choose not to join the update list.</li>
				<li>You can clear browser storage to remove local app data from your device.</li>
				<li>You can request access, correction, or deletion of personal information connected to your email address.</li>
			  </ul>
			  <p>
				During the public beta, privacy requests can be sent through the feedback link in the app. A dedicated privacy
				contact will be added before a wider public launch.
			  </p>
        </Surface>

        <Surface className="privacy-page__panel">
          <h2>Educational use only</h2>
          <p>
            ABG Master is for training and education. It is not medical advice, clinical decision support, or a
            substitute for professional judgement.
          </p>
        </Surface>
      </section>
    </main>
  );
}
