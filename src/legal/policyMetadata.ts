/**
 * Public policy metadata, sourced from deployment environment so the same code
 * serves every installation without hardcoding an operator. Every field has a
 * visible fallback so local development and previews still render; production
 * deployments set the real values and `release:check` flags the placeholders.
 */
export interface PolicyMetadata {
  operatorName: string;
  privacyEmail: string;
  effectiveDate: string;
  deploymentRegion: string;
  publicBaseUrl: string;
}

export function getPolicyMetadata(): PolicyMetadata {
  return {
    operatorName: process.env.HBM_OPERATOR_NAME?.trim() || "待填写（运营主体）",
    privacyEmail: process.env.HBM_PRIVACY_EMAIL?.trim() || "privacy@example.com",
    effectiveDate: process.env.HBM_POLICY_EFFECTIVE_DATE?.trim() || "2026-08-01",
    deploymentRegion: process.env.HBM_DEPLOYMENT_REGION?.trim() || "待填写（部署地域）",
    publicBaseUrl: process.env.HBM_PUBLIC_BASE_URL?.trim() || "https://hbm.example.com"
  };
}

export function isPolicyMetadataConfigured(meta: PolicyMetadata): boolean {
  return (
    Boolean(process.env.HBM_OPERATOR_NAME?.trim()) &&
    Boolean(process.env.HBM_PRIVACY_EMAIL?.trim()) &&
    Boolean(process.env.HBM_POLICY_EFFECTIVE_DATE?.trim()) &&
    Boolean(process.env.HBM_DEPLOYMENT_REGION?.trim())
  );
}
