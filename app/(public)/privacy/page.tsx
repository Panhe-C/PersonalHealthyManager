import { getPolicyMetadata } from "@/src/legal/policyMetadata";

export const metadata = { title: "隐私说明 · Healthy Body Manager" };
// The policy metadata comes from HBM_* env vars that only exist at runtime
// (Docker builds run without them), so this page must render per request.
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  const meta = getPolicyMetadata();

  return (
    <article className="policy-doc">
      <h1>隐私说明</h1>
      <p className="policy-meta">最后更新：{meta.effectiveDate}</p>

      <h2>处理的数据</h2>
      <p>
        Healthy Body Manager 是个人健康与训练管理工具。根据用户主动填写、授权或连接的功能，系统可能处理：
      </p>
      <ul>
        <li>账户信息：邮箱、时区、密码的不可逆哈希和登录会话；</li>
        <li>身体与偏好：身高、体重、体脂、生日、性别、静息心率、训练经验、伤病、饮食和训练偏好；</li>
        <li>健康与运动：活动、睡眠、恢复、心率、HRV、训练负荷及相关来源标识；</li>
        <li>计划与反馈：目标、训练计划、清单完成情况、主观用力程度、备注和调整记录；</li>
        <li>日历与饮食：空闲时段、重要事件摘要、待确认的训练日历草稿和餐食菜单；</li>
        <li>教练功能：对话、摘要、用户明确保存的记忆和模型建议；</li>
        <li>运行配置：已脱敏的连接状态、推送令牌、自动任务状态和通知投递记录。</li>
      </ul>
      <p>系统不会在导出文件中包含密码哈希、会话令牌或第三方服务的明文密钥。</p>

      <h2>使用目的</h2>
      <p>
        这些数据用于身份验证、跨设备访问、生成训练与营养建议、同步用户选择的数据源、写入用户明确确认的日历事件、发送用户启用的提醒，以及诊断服务运行状态。健康建议用于个人计划辅助，<strong>不构成医疗诊断或治疗建议</strong>。
      </p>

      <h2>数据来源与第三方</h2>
      <ul>
        <li>Apple HealthKit：仅在 iOS 用户授权后读取所选健康类型；HealthKit 权限可随时在 iOS 设置中撤回。</li>
        <li>COROS 或其他数据连接：仅在用户配置并启用连接后同步。</li>
        <li>
          飞书日历：日历写回通过部署者本机的飞书登录完成，目标日历由部署者指定。当前仅服务部署者指定的单个账号；其他账号的日历写回不可用。读取取决于用户授予的权限；训练事件写入前需要用户确认。
        </li>
        <li>餐食菜单：仅在用户配置并启用餐食 MCP 连接后拉取；未配置时不展示菜单，只保留通用饮食方案。</li>
        <li>模型服务商：用户启用教练模型后，完成请求所需的上下文可能发送给用户配置的模型服务商。具体保存与训练政策由该服务商决定。</li>
        <li>Expo 推送服务与 Apple Push Notification service：仅在用户启用通知并注册设备后处理推送令牌和通知投递。</li>
      </ul>
      <p>不会出售个人数据，也不会将健康数据用于广告画像。</p>

      <h2>保存、安全与跨境</h2>
      <p>
        服务端数据保存到部署者配置的数据库；开发环境默认使用本地 SQLite。密钥通过环境变量或加密设置保存，网络公开部署必须使用 HTTPS。用户手动创建的数据库备份独立于在线账户，删除账户不会自动删除这些备份。
      </p>
      <p>
        第三方服务可能在其运营地区处理数据。本部署的运营主体为 <strong>{meta.operatorName}</strong>，部署地域为 <strong>{meta.deploymentRegion}</strong>。涉及跨境传输时，数据可能在你所在地以外的地区处理；正式发布前，运营者应根据实际部署地域和所选服务商补充跨境处理说明与保存期限。
      </p>

      <h2>用户控制</h2>
      <p>用户可以在应用内：</p>
      <ul>
        <li>查看和修改个人资料、目标、连接与通知设置；</li>
        <li>撤回系统级 HealthKit 或通知权限；</li>
        <li>导出个人数据的 JSON 副本；</li>
        <li>使用当前密码永久删除服务端账户及其关联数据。</li>
      </ul>
      <p>
        删除账户不会自动删除已生成的本地备份，也不会撤销或删除此前写入第三方日历的事件；这些内容需在相应位置单独处理。具体步骤见数据导出与删除说明。
      </p>

      <h2>联系方式</h2>
      <ul>
        <li>运营主体：{meta.operatorName}</li>
        <li>隐私联系邮箱：<a href={`mailto:${meta.privacyEmail}`}>{meta.privacyEmail}</a></li>
        <li>公开隐私政策地址：{meta.publicBaseUrl}/privacy</li>
      </ul>
    </article>
  );
}
