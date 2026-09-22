import Constants from "expo-constants";
import { resolveRegistrationEnabled } from "./registrationPolicy";

export const REGISTRATION_ENABLED = resolveRegistrationEnabled(
  Constants.expoConfig?.extra?.registrationEnabled,
);
