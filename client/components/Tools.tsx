import { useState } from "react";
import type { Lang } from "../../shared/api";

const TAGS: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

/** Reads text aloud with the browser's own voices (helpful for low-vision and low-literacy readers); hidden if unsupported. */
export function ReadAloud({ text, lang }: { text: string; lang: Lang }) {
  const [speaking, setSpeaking] = useState(false);
  if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return null;
  function toggle() {
    speechSynthesis.cancel();
    if (speaking) {
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = TAGS[lang];
    utterance.onend = () => setSpeaking(false);
    setSpeaking(true);
    speechSynthesis.speak(utterance);
  }
  return (
    <button type="button" className="ghost" aria-pressed={speaking} onClick={toggle}>
      {speaking ? "Stop reading" : "Read aloud"}
    </button>
  );
}

/** Shares the plan summary with the phone's share sheet, or copies it so it can be pasted into WhatsApp. */
export function ShareButton({ text }: { text: string }) {
  const [note, setNote] = useState("");
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "AirWise plan", text });
        setNote("Shared.");
      } else {
        await navigator.clipboard.writeText(text);
        setNote("Plan copied — paste it into WhatsApp or a message.");
      }
    } catch {
      setNote("Sharing was cancelled or isn’t available here.");
    }
  }
  return (
    <>
      <button type="button" className="ghost" onClick={() => void share()}>
        Share this plan
      </button>
      <span role="status" className="hint">
        {note}
      </span>
    </>
  );
}
