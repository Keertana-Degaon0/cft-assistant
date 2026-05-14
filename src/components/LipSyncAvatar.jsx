import aiBotCropped from "../assets/ai-bot-cropped.jpeg";

function LipSyncAvatar({ mode, viseme = "rest", subtitle, theme = "default", compact = false }) {
  return (
    <section
      className={`avatar-card avatar-card--${mode} ${compact ? "avatar-card--compact" : ""}`}
      aria-label="Robot voice assistant"
    >
      <div className={`avatar-stage avatar-stage--robot ${compact ? "avatar-stage--compact" : ""}`}>
        <div
          className={`robot-visual robot-visual--${mode} robot-visual--${viseme} robot-visual--theme-${theme} ${
            compact ? "robot-visual--compact" : ""
          }`}
          aria-hidden="true"
        >
          <div className="robot-visual__portrait-frame">
            <img className="robot-visual__portrait-image robot-visual__portrait-image--photo" src={aiBotCropped} alt="" />
          </div>
        </div>
      </div>
      {subtitle ? <p className="avatar-card__subtitle">{subtitle}</p> : null}
    </section>
  );
}

export default LipSyncAvatar;
