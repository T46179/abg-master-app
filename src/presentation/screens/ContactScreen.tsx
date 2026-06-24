import { CircleAlert, Mail, MessageSquare, Sparkles } from "lucide-react";
import { SeoMetadata } from "../../app/seo";
import { PublicPageShell } from "../layout/PublicPageShell";

const contactTopics = [
  {
    title: "Feedback",
    description: "Something unclear, or a guide you'd like to see? I read every message.",
    Icon: MessageSquare
  },
  {
    title: "Corrections",
    description: "Spotted a clinical or factual error? Please flag it — accuracy comes first.",
    Icon: CircleAlert
  },
  {
    title: "Everything else",
    description: "Collaborations, teaching requests, or a friendly hello.",
    Icon: Sparkles
  }
] as const;

export function ContactScreen() {
  return (
    <>
      <SeoMetadata />
      <PublicPageShell pageClassName="contact-page" articleClassName="contact-page__article">
        <header className="comp-rules-page__header public-page-shell__hero contact-page__hero">
          <div className="comp-rules-page__methodology-pill">
            <span />
            <p>ABG Master · Contact</p>
          </div>
          <h1>
            Get in touch.
            <span>One inbox, one human.</span>
          </h1>
          <p>No forms, no ticketing system — just an email address. Replies usually within a few days.</p>
        </header>

        <a className="contact-page__email-card" href="mailto:hello@abgmaster.com">
          <span className="contact-page__email-label">Email</span>
          <span className="contact-page__email-address">
            <Mail aria-hidden="true" />
            <span>hello@abgmaster.com</span>
          </span>
          <span className="contact-page__email-copy">The best place to reach me. A short note with context goes a long way.</span>
        </a>

        <section className="contact-page__topics" aria-labelledby="contact-topics-heading">
          <p id="contact-topics-heading" className="contact-page__section-label">What to write about</p>
          <div className="contact-page__topic-grid">
            {contactTopics.map(({ title, description, Icon }) => (
              <article key={title} className="contact-page__topic-card">
                <Icon aria-hidden="true" />
                <h2>{title}</h2>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="contact-page__footer">
          <p>© 2026 ABG Master · Dr Thanh Truong</p>
        </footer>
      </PublicPageShell>
    </>
  );
}
