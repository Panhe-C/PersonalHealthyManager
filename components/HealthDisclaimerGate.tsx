"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

/**
 * One-time health disclaimer acknowledgment. Renders nothing once the user
 * has acknowledged (server-set flag), otherwise overlays a modal that must be
 * dismissed with the "我已知悉" button — clicking it records the acknowledgment
 * so the modal never reappears. The standing footnote next to each reply
 * remains regardless.
 */
export function HealthDisclaimerGate({
  initiallyAcknowledged
}: {
  initiallyAcknowledged: boolean;
}) {
  const [acknowledged, setAcknowledged] = useState(initiallyAcknowledged);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAcknowledged(initiallyAcknowledged);
  }, [initiallyAcknowledged]);

  if (acknowledged) return null;

  async function accept() {
    setSubmitting(true);
    try {
      await fetch("/api/onboarding/acknowledge-disclaimer", { method: "POST" });
      setAcknowledged(true);
    } catch {
      // Leave the modal up so the user can retry; the standing footnote is
      // already visible, so a transient network failure is not harmful.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="disclaimer-gate" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
      <div className="surface disclaimer-gate-card">
        <span className="brand-mark" aria-hidden="true">
          <ShieldAlert size={18} />
        </span>
        <h2 id="disclaimer-title">健康免责声明</h2>
        <p>
          健康身体管家会根据你的恢复、训练和饮食数据给出建议，但这些建议<b>不构成医疗诊断或治疗处方</b>。
        </p>
        <p>
          如你有伤病、慢性病、正在服药或备孕等情况，请在执行建议前咨询医生。出现胸痛、晕厥、剧烈疼痛等急性症状时请立即就医，不要等待应用回复。
        </p>
        <button className="button login-submit" type="button" onClick={accept} disabled={submitting}>
          {submitting ? "保存中…" : "我已知悉，开始使用"}
        </button>
      </div>
    </div>
  );
}
