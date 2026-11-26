import type { Analysis } from "../../shared/analysis";
import type { AskResponse, Lang } from "../../shared/api";
import { compareModes } from "../../shared/commute";
import { shareText } from "../../shared/share";
import type { Windows } from "../../shared/windows";
import { AskBox, Explainer, Myths } from "./Assistant";
import CommuteTable from "./Commute";
import RoomCard from "./Indoor";
import { ActionsList, DailyPlan, ExposureCard, RiskCard } from "./Results";

interface Props {
  a: Analysis;
  windows: Windows | null;
  brief: { text: string; language: Lang } | null;
  answer: AskResponse | null;
  busy: "air" | "brief" | "ask" | null;
  onExplain: (language: Lang) => void;
  onAsk: (question: string) => void;
}

/** Everything shown once today's AQI is known. */
export default function ResultsColumn({ a, windows, brief, answer, busy, onExplain, onAsk }: Props) {
  const modes = compareModes(a.profile);
  return (
    <>
      <Explainer
        summary={a.summary}
        shareText={shareText(a, window.location.origin)}
        busy={busy === "brief"}
        brief={brief}
        onExplain={onExplain}
      />
      <RiskCard risk={a.risk} />
      <ExposureCard a={a} />
      <ActionsList actions={a.actions} />
      {modes && <CommuteTable rows={modes} />}
      <RoomCard />
      <DailyPlan plan={a.plan} windows={windows} />
      <AskBox busy={busy === "ask"} answer={answer} onAsk={onAsk} />
      <Myths />
    </>
  );
}
