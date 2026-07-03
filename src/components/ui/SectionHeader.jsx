export default function SectionHeader({ eyebrow, title, aside, titleTag = 'h3' }) {
  const Title = titleTag;

  return (
    <div className="panel-heading">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <Title className="section-title">{title}</Title>
      </div>
      {aside ? aside : null}
    </div>
  );
}
