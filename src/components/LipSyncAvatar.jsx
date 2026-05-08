import standingHumanoidRobot from "../assets/standing-humanoid-robot.png";
import robotMouthClosed from "../assets/robot-mouth-closed.png";
import robotMouthSmall from "../assets/robot-mouth-small.png";
import robotMouthMedium from "../assets/robot-mouth-medium.png";
import robotMouthRound from "../assets/robot-mouth-round.png";

function getRobotFrame(mode, viseme) {
  if (mode !== "speaking") {
    return robotMouthClosed;
  }

  if (viseme === "open" || viseme === "round") {
    return robotMouthRound;
  }

  if (viseme === "wide" || viseme === "smile") {
    return robotMouthMedium;
  }

  if (viseme === "fv") {
    return robotMouthSmall;
  }

  if (viseme === "bmp" || viseme === "rest") {
    return robotMouthClosed;
  }

  return robotMouthMedium;
}

function LipSyncAvatar({ mode, viseme = "rest", subtitle, theme = "default", compact = false }) {
  const robotFrame = getRobotFrame(mode, viseme);

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
            <img className="robot-visual__portrait-image" src={robotFrame} alt="" />
            <div className="robot-visual__chest-core">
              <span className="robot-visual__chest-ring"></span>
              <span className="robot-visual__chest-dot"></span>
            </div>
            <div className="robot-visual__chest-eq">
              <span className="robot-visual__eq-bar"></span>
              <span className="robot-visual__eq-bar"></span>
              <span className="robot-visual__eq-bar"></span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LipSyncAvatar;
