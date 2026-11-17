import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal";
import { EqualHousingLogo } from "@/components/equal-housing";
import { getHouse } from "@/lib/content";

export const metadata: Metadata = {
  title: "Fair housing and accessibility",
  description: "Respite for the Weary follows federal and Virginia fair housing law. How to ask for a reasonable accommodation, and how to reach us if this website is hard to use.",
};

export default async function FairHousingPage() {
  const { phone, phoneHref } = await getHouse();
  const call = (
    <a href={phoneHref} className="mono font-medium text-ink underline underline-offset-4">
      {phone}
    </a>
  );
  return (
    <LegalPage
      title="Fair housing and accessibility"
      updated="November 17, 2026"
      intro="Everyone is welcome to ask about a room here. This page sets out the law we follow, how to ask for changes you need, and what to do if you think we got it wrong."
    >
      <div className="flex items-center gap-4 rounded-2xl bg-paper p-5 ring-1 ring-line [--eho-bg:var(--paper)]">
        <EqualHousingLogo className="h-12 w-12 shrink-0 text-ink" />
        <p className="text-[0.98rem] leading-snug text-ink/80">
          <strong className="font-semibold text-ink">Equal Housing Opportunity.</strong> We follow the federal Fair Housing Act and the Virginia Fair Housing Law.
        </p>
      </div>

      <LegalSection title="Our commitment">
        <p>
          We do not turn anyone away, set different terms, or treat anyone differently because of race, color, religion, national origin, sex, sexual orientation, gender
          identity, disability, familial status, elderliness, source of funds or military status.
        </p>
        <p>
          <strong>Source of funds</strong> means we accept rent paid through VA benefits, SSI or SSDI, housing vouchers and other assistance programs, the same as rent paid
          any other way.
        </p>
      </LegalSection>

      <LegalSection title="Who our houses are for">
        <p>
          We describe our houses as homes for veterans, people in recovery and independent seniors because that is the support we are set up to give. It is not a rule
          about who can apply. Telling us which of these fits you is optional, and it never decides who gets a room.
        </p>
        <p>Every house is drug and alcohol free. That rule is the same for everyone who lives in them.</p>
      </LegalSection>

      <LegalSection title="Asking for an accommodation">
        <p>
          If you have a disability, you can ask us to change a rule, policy or way of doing things, or to make a physical change to your room, so the home works for you.
          This is called a reasonable accommodation or modification.
        </p>
        <ul>
          <li>Ask in any way that suits you: call {call}, tell us in person, or write it in your room request. There is no special form.</li>
          <li>You don&apos;t need to share a diagnosis. If the need isn&apos;t obvious, we may ask for a short note from someone who knows about it, such as a doctor or caseworker.</li>
          <li>We will answer quickly and talk through other options if what you asked for isn&apos;t possible.</li>
          <li>Some rooms are on the ground floor with no stairs. If you need one, tell us and we will place you there whenever one is open.</li>
          <li>Assistance animals, including service and support animals, are welcome with an approved request, whatever the pet rules say.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Using this website">
        <p>
          We want this site to work for everyone, including people using a screen reader, a keyboard, a phone or larger text. We aim to meet the Web Content
          Accessibility Guidelines (WCAG 2.2) at level AA.
        </p>
        <p>If any part of the site is hard to use, call {call} and we will help you by phone, and fix the page.</p>
      </LegalSection>

      <LegalSection title="If you think you were treated unfairly">
        <p>Please tell us first, so we can put it right. You also have the right to file a complaint with either of these, at no cost:</p>
        <ul>
          <li>
            <strong>U.S. Department of Housing and Urban Development (HUD):</strong>{" "}
            <a href="tel:+18006699777" className="mono underline underline-offset-4">1-800-669-9777</a>, or online at{" "}
            <a href="https://www.hud.gov/fairhousing" className="underline underline-offset-4" rel="noopener">hud.gov/fairhousing</a>.
          </li>
          <li>
            <strong>Virginia Fair Housing Office:</strong>{" "}
            <a href="tel:+18885513247" className="mono underline underline-offset-4">1-888-551-3247</a>, or online at{" "}
            <a href="https://www.dpor.virginia.gov/FairHousing" className="underline underline-offset-4" rel="noopener">dpor.virginia.gov/FairHousing</a>.
          </li>
        </ul>
        <p>We will never punish or retaliate against anyone who asks for an accommodation or makes a complaint.</p>
      </LegalSection>
    </LegalPage>
  );
}
