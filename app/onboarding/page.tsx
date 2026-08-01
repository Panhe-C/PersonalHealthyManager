import Link from "next/link";
import { CheckCircle2, Circle, Compass, Dumbbell, Target, CalendarCheck2, Sparkles, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser } from "@/src/auth/session";
import { HealthDisclaimer } from "@/components/HealthDisclaimer";
import { completeOnboarding, getOnboardingState, onboardingIsComplete } from "@/src/services/onboardingService";

export default async function OnboardingPage() {
  const user = await requireUser();
  const state = await getOnboardingState(user.id);

  // Already done — visiting /onboarding directly is a no-op, send them to the plan.
  if (onboardingIsComplete(state)) {
    redirect("/plan");
  }

  const steps = [
    {
      key: "bodyProfile" as const,
      icon: Dumbbell,
      title: "填写身体资料",
      hint: "身高、体重、训练经验和偏好。计划引擎据此安排强度。",
      href: "/profile",
      cta: "去填写身体资料",
      done: state.steps.bodyProfile
    },
    {
      key: "goal" as const,
      icon: Target,
      title: "添加一个目标",
      hint: "至少一个进行中的目标。最高优先级的目标会主导本周计划。",
      href: "/goals",
      cta: "去添加目标",
      done: state.steps.goal
    },
    {
      key: "calendarSnapshot" as const,
      icon: CalendarCheck2,
      title: "同步本周日程",
      hint: "导入日历或使用示例数据，让计划避开你的忙碌时段。",
      href: "/plan",
      cta: "去计划页同步日程",
      done: state.steps.calendarSnapshot
    },
    {
      key: "plan" as const,
      icon: Sparkles,
      title: "生成本周计划",
      hint: "前两步完成后即可生成。可在计划页随时重新生成。",
      href: "/plan",
      cta: "去计划页生成",
      done: state.steps.plan
    }
  ];

  const allDone = steps.every((step) => step.done);

  async function finish(formData: FormData) {
    "use server";
    const acknowledge = formData.get("acknowledge") === "true";
    await completeOnboarding(user.id);
    if (acknowledge) {
      const { acknowledgeHealthDisclaimer } = await import("@/src/services/onboardingService");
      await acknowledgeHealthDisclaimer(user.id);
    }
    redirect("/plan");
  }

  return (
    <main className="login-shell">
      <div className="login-layout login-layout-single">
        <section className="surface login-card onboarding-card">
          <div className="login-brand">
            <span className="brand-mark">
              <Compass aria-hidden="true" size={18} />
            </span>
            <div>
              <span className="eyebrow">新手引导</span>
              <h1>四步开始使用</h1>
              <p className="page-subtitle">
                按顺序完成后即可生成本周计划。每一步都可以跳过，稍后在对应页面继续。
              </p>
            </div>
          </div>

          <ol className="onboarding-steps">
            {steps.map((step, index) => (
              <li key={step.key} className={step.done ? "onboarding-step onboarding-step-done" : "onboarding-step"}>
                <span className="onboarding-step-icon" aria-hidden="true">
                  {step.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </span>
                <div className="onboarding-step-body">
                  <div className="onboarding-step-title">
                    <step.icon size={15} aria-hidden="true" />
                    <strong>{index + 1}. {step.title}</strong>
                  </div>
                  <p className="onboarding-step-hint">{step.hint}</p>
                </div>
                {step.done ? (
                  <span className="onboarding-step-status">已完成</span>
                ) : (
                  <Link className="button button-secondary onboarding-step-cta" href={step.href}>
                    {step.cta}
                  </Link>
                )}
              </li>
            ))}
          </ol>

          <div className="onboarding-disclaimer">
            <HealthDisclaimer variant="callout" />
          </div>

          <form action={finish}>
            <input type="hidden" name="acknowledge" value="true" />
            <button type="submit" className="button login-submit">
              {allDone ? "我已完成，进入计划" : "稍后再说，先看看"}
            </button>
          </form>

          <p className="auth-alt">
            <Link href="/plan">直接去计划页</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
