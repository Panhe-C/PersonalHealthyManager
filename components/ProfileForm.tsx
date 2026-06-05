"use client";

import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";

type ProfileFormProps = {
  initialProfile?: {
    heightCm: number;
    weightKg: number;
    bodyFatPercent?: number;
    sex: string;
    restingHeartRateBpm?: number;
    trainingExperience: string;
    injuries: string[];
    dietaryPreferences: string[];
    trainingPreferences: string[];
  } | null;
};

export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => {
      const value = String(form.get(name) ?? "").trim();
      return value ? Number(value) : undefined;
    };
    const list = (name: string) =>
      String(form.get(name) ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    const payload = {
      heightCm: Number(form.get("heightCm")),
      weightKg: Number(form.get("weightKg")),
      bodyFatPercent: optionalNumber("bodyFatPercent"),
      sex: String(form.get("sex")),
      restingHeartRateBpm: optionalNumber("restingHeartRateBpm"),
      trainingExperience: String(form.get("trainingExperience")),
      injuries: list("injuries"),
      dietaryPreferences: list("dietaryPreferences"),
      trainingPreferences: list("trainingPreferences")
    };
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setMessage(response.ok ? "Profile saved" : "Profile could not be saved");
  }

  return (
    <form className="surface panel profile-form" onSubmit={submit}>
      <fieldset className="form-section">
        <legend>Body measurements</legend>
        <div className="grid form-grid">
          <label className="field">
            Height (cm)
            <input name="heightCm" type="number" min="80" max="250" defaultValue={initialProfile?.heightCm} required />
          </label>
          <label className="field">
            Weight (kg)
            <input name="weightKg" type="number" min="25" max="300" step="0.1" defaultValue={initialProfile?.weightKg} required />
          </label>
          <label className="field">
            Body fat (%)
            <input name="bodyFatPercent" type="number" min="2" max="70" step="0.1" defaultValue={initialProfile?.bodyFatPercent} />
          </label>
          <label className="field">
            Resting heart rate
            <input
              name="restingHeartRateBpm"
              type="number"
              min="30"
              max="130"
              defaultValue={initialProfile?.restingHeartRateBpm}
            />
          </label>
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend>Training background</legend>
        <div className="grid form-grid">
          <label className="field">
            Sex
            <select name="sex" defaultValue={initialProfile?.sex ?? "male"}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="field">
            Training experience
            <select name="trainingExperience" defaultValue={initialProfile?.trainingExperience ?? "intermediate"}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend>Preferences and restrictions</legend>
        <div className="grid form-grid">
          <label className="field field-span">
            Injuries or restrictions
            <input name="injuries" defaultValue={initialProfile?.injuries.join(", ")} placeholder="left knee sensitivity, shoulder restriction" />
          </label>
          <label className="field field-span">
            Dietary preferences
            <input name="dietaryPreferences" defaultValue={initialProfile?.dietaryPreferences.join(", ")} placeholder="high protein, no dairy" />
          </label>
          <label className="field field-span">
            Training preferences
            <input name="trainingPreferences" defaultValue={initialProfile?.trainingPreferences.join(", ")} placeholder="morning runs, indoor strength" />
          </label>
        </div>
      </fieldset>
      <div className="toolbar">
        <ActionButton type="submit">
          <Save aria-hidden="true" size={16} /> Save profile
        </ActionButton>
        {message ? <span className={message === "Profile saved" ? "message" : "message message-error"}>{message}</span> : null}
      </div>
    </form>
  );
}
