import { getPolicyMetadata } from "@/src/legal/policyMetadata";

export const metadata = { title: "服务条款 · Healthy Body Manager" };
// The policy metadata comes from HBM_* env vars that only exist at runtime
// (Docker builds run without them), so this page must render per request.
export const dynamic = "force-dynamic";

export default function TermsPage() {
  const meta = getPolicyMetadata();

  return (
    <article className="policy-doc">
      <h1>服务条款</h1>
      <p className="policy-meta">最后更新：{meta.effectiveDate}</p>

      <h2>1. 服务性质</h2>
      <p>
        Healthy Body Manager（以下简称"本服务"）由 {meta.operatorName} 运营，是一款个人健康与训练管理工具，提供训练计划生成、恢复与营养建议、日历与数据同步及教练对话等功能。注册并使用本服务即表示你已阅读、理解并同意本条款及<a href="/privacy">隐私说明</a>。
      </p>

      <h2>2. 非医疗用途</h2>
      <p>
        本服务提供的训练强度、恢复与营养建议<strong>不构成医疗诊断、治疗处方或专业医疗意见</strong>。您知悉并同意：本服务不能替代医生、物理治疗师、注册营养师或其他持证医疗专业人员的判断。如有伤病、慢性病、正在服药、备孕或怀孕等情况，请在执行任何建议前咨询医生。出现胸痛、晕厥、剧烈疼痛、呼吸困难等急性症状时，请立即就医，不要等待本服务的回复。
      </p>

      <h2>3. 账户与数据</h2>
      <ul>
        <li>你需要提供真实有效的邮箱地址用于注册与验证，并自行保管密码。因账户或密码保管不善造成的损失由你承担。</li>
        <li>你授权本服务处理的健康、训练、日历与饮食等数据，其处理范围与目的详见隐私说明。</li>
        <li>你可以在应用内导出个人数据副本，或使用当前密码永久删除账户及服务端关联数据；已生成的本地备份与已写入第三方日历的事件需另行处理。</li>
      </ul>

      <h2>4. 第三方连接</h2>
      <p>
        本服务可连接 Apple HealthKit、COROS、飞书日历、餐食 MCP 及你配置的模型服务商等第三方。这些连接由你主动授权并启用，相关数据由对应第三方按其隐私政策处理。你可在应用内或系统设置中随时撤回授权；撤回后相关功能将不可用。
      </p>

      <h2>5. 可用性与免责</h2>
      <p>
        本服务按"现状"提供，不保证持续可用、无错误或适合你的特定目的。计划生成、教练回复、数据同步等功能可能因模型服务商、第三方接口、网络或维护等原因失败或延迟。在适用法律允许的最大范围内，{meta.operatorName} 对因使用或无法使用本服务造成的间接或附带损失不承担责任。
      </p>

      <h2>6. 变更与终止</h2>
      <p>
        本服务与条款可能更新；条款实质性变更时，运营者将通过应用内提示或邮件告知。继续使用即视为接受变更。你可随时在应用内删除账户停止使用；运营者亦可在你违反本条款时暂停或终止账户。
      </p>

      <h2>7. 联系方式</h2>
      <ul>
        <li>运营主体：{meta.operatorName}</li>
        <li>联系邮箱：<a href={`mailto:${meta.privacyEmail}`}>{meta.privacyEmail}</a></li>
        <li>公开服务条款地址：{meta.publicBaseUrl}/terms</li>
      </ul>
    </article>
  );
}
