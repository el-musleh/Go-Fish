interface OptionGenerationStateProps {
  title?: string;
  description?: string;
  detail?: string;
}

function GenerationPanel({ position }: { position: 'left' | 'center' | 'right' }) {
  return (
    <div className={`gf-generation-state__panel gf-generation-state__panel--${position}`}>
      <span className="gf-generation-state__panel-pill" />
      <span className="gf-generation-state__panel-line gf-generation-state__panel-line--accent" />
      <span className="gf-generation-state__panel-line" />
      <span className="gf-generation-state__panel-line gf-generation-state__panel-line--short" />
    </div>
  );
}

export default function OptionGenerationState({
  title = 'Generating options',
  description = "Go Fish is comparing everyone's availability, taste, and timing.",
  detail = 'You will be taken to the shortlist automatically as soon as it is ready.',
}: OptionGenerationStateProps) {
  return (
    <section className="gf-card gf-generation-state" role="status" aria-live="polite">
      <div className="gf-generation-state__copy">
        <p className="gf-generation-state__eyebrow">In progress</p>
        <h3 className="gf-card-title gf-generation-state__title">{title}</h3>
        <p className="gf-muted gf-generation-state__description">{description}</p>
        <p className="gf-generation-state__detail">{detail}</p>
      </div>

      <div className="gf-generation-state__visual" aria-hidden="true">
        <div className="gf-generation-state__glow" />
        <div className="gf-generation-state__stream" />
        <div className="gf-generation-state__core" />

        <span className="gf-generation-state__ripple gf-generation-state__ripple--one" />
        <span className="gf-generation-state__ripple gf-generation-state__ripple--two" />
        <span className="gf-generation-state__ripple gf-generation-state__ripple--three" />

        <span className="gf-generation-state__node gf-generation-state__node--one" />
        <span className="gf-generation-state__node gf-generation-state__node--two" />
        <span className="gf-generation-state__node gf-generation-state__node--three" />
        <span className="gf-generation-state__node gf-generation-state__node--four" />

        <GenerationPanel position="left" />
        <GenerationPanel position="center" />
        <GenerationPanel position="right" />
      </div>
    </section>
  );
}
