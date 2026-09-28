import { api } from "@stateofpixel/backend/api";
import { useMutation } from "convex/react";
import { facts } from "./docs/facts";
import { RadioSetting, Section } from "./Settings";

type ImageStore = "convex" | "blobs";

const OPTIONS: { value: ImageStore; label: string; detail: string }[] = [
  {
    value: "convex",
    label: "Convex",
    detail: `Images up to ${facts.imageSize}`,
  },
  {
    value: "blobs",
    label: "Netlify Blobs",
    detail: `Images up to ${facts.blobImageSize}`,
  },
];

export function ImageStorage({
  login,
  value,
}: {
  login: string;
  value: ImageStore;
}) {
  const setImageStore = useMutation(api.accounts.setImageStore);
  return (
    <Section title="Storage">
      <RadioSetting
        label="Image storage"
        hint="Applies to new uploads. Stored images stay where they are."
        value={value}
        options={OPTIONS}
        onSave={(imageStore) => setImageStore({ login, imageStore })}
      />
    </Section>
  );
}
