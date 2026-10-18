import { ImageSquareIcon, UploadSimpleIcon } from "@phosphor-icons/react/ssr";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type DragEvent, useEffect, useState } from "react";
import { PublicPage, SECTION } from "../components/landing/sections";
import { AuthButton } from "../components/SignIn";
import { buttonClass, LeadCopy, Spinner } from "../components/ui";
import { useViewerSettings, Viewer } from "../components/Viewer";
import {
  diffImages,
  type ImageDiff,
  type PickedImage,
  pickImage,
} from "../lib/imageDiff";
import { PAGES, pageLinks, pageMeta, pageUrl, SITE_URL } from "../lib/pageMeta";

export const Route = createFileRoute("/image-diff")({
  head: () => ({
    meta: [
      { title: `${PAGES.imageDiff.title} / stateofpixel` },
      ...pageMeta(PAGES.imageDiff),
    ],
    links: pageLinks(PAGES.imageDiff),
    scripts: [
      { type: "application/ld+json", children: webApplicationJsonLd() },
    ],
  }),
  component: ImageDiffPage,
});

function webApplicationJsonLd() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Image diff",
    url: pageUrl(PAGES.imageDiff.path),
    description: PAGES.imageDiff.description,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: "stateofpixel", url: SITE_URL },
  });
}

const DOTTED = "border-dotted border-field-border/50";

const NOTES: [string, string][] = [
  [
    "The images stay in your browser.",
    "Nothing is uploaded. The page reads the pixels of both files and compares them on your device.",
  ],
  [
    "Compared with pixelmatch.",
    "At a threshold of 0.1, with anti-aliased pixels ignored. The stateofpixel CLI uses odiff, and pixelmatch when odiff cannot run.",
  ],
  [
    "Different sizes still compare.",
    "Both images are placed at the top left corner, and the area only one of them covers counts as changed.",
  ],
  [
    "PNG, JPEG, WebP and GIF.",
    "Any image your browser can open. For a GIF, the first frame is compared.",
  ],
];

type Side = "base" | "next";

function ImageDiffPage() {
  const [images, setImages] = useState<Record<Side, PickedImage | null>>({
    base: null,
    next: null,
  });
  const [diff, setDiff] = useState<ImageDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const settings = useViewerSettings();

  const pick = async (side: Side, file: File) => {
    setError(null);
    try {
      const image = await pickImage(file);
      setImages((current) => {
        if (current[side]) {
          URL.revokeObjectURL(current[side].url);
        }
        return { ...current, [side]: image };
      });
    } catch {
      setError(`Could not open ${file.name}. Pick a PNG, JPEG, WebP or GIF.`);
    }
  };

  const pickSamples = () =>
    Promise.all([
      sampleFile("header-base").then((file) => pick("base", file)),
      sampleFile("header-new").then((file) => pick("next", file)),
    ]);

  useEffect(() => {
    const { base, next } = images;
    setDiff(null);
    if (base === null || next === null) {
      return;
    }
    let current = true;
    let result: ImageDiff | null = null;
    diffImages(base, next).then(
      (value) => {
        result = value;
        if (current) {
          setDiff(value);
        } else if (value.diffImage) {
          URL.revokeObjectURL(value.diffImage.url);
        }
      },
      () => current && setError("Could not compare these images."),
    );
    return () => {
      current = false;
      if (result?.diffImage) {
        URL.revokeObjectURL(result.diffImage.url);
      }
    };
  }, [images]);

  const { base, next } = images;
  return (
    <PublicPage>
      <section className={`${SECTION} pb-12`}>
        <LeadCopy as="h1" title="Image diff." className="max-w-[720px]">
          Compare two screenshots and see every pixel that changed. The images
          never leave your browser.
        </LeadCopy>
        <div className="mt-12 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <DropSlot
            label="Baseline"
            image={base}
            onPick={(file) => pick("base", file)}
          />
          <DropSlot
            label="New"
            image={next}
            onPick={(file) => pick("next", file)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={pickSamples}
            data-umami-event="Image diff samples"
            className={buttonClass("ghost")}
          >
            <ImageSquareIcon size={16} />
            Try two sample screenshots
          </button>
          {error && (
            <p role="alert" className="text-sm text-failed">
              {error}
            </p>
          )}
        </div>
        <div className="mt-6 flex h-[75vh] min-h-[480px] flex-col overflow-hidden rounded-lg bg-surface ring-1 ring-border">
          {base === null || next === null ? (
            <p className="m-auto px-4 text-center text-sm text-muted">
              Pick a baseline and a new image to compare them.
            </p>
          ) : diff === null ? (
            <p className="m-auto flex items-center gap-2 text-sm text-muted">
              <Spinner size={16} />
              Comparing
            </p>
          ) : (
            <Viewer
              snapshot={{
                name: next.name,
                diffStatus: diff.diffPixels === 0 ? "unchanged" : "changed",
                diffRatio: diff.diffRatio,
                diffPixels: diff.diffPixels,
                image: next,
                baselineImage: base,
                diffImage: diff.diffImage,
              }}
              settings={settings}
              baselineLabel={`Baseline, ${base.name}`}
              newLabel={`New, ${next.name}`}
              navigation={null}
              headings={false}
            />
          )}
        </div>
      </section>

      <section className={SECTION}>
        <LeadCopy title="How it compares." className="max-w-[720px]">
          The same viewer as the stateofpixel review page, without an account.
        </LeadCopy>
        <ul className={`mt-12 border-t ${DOTTED}`}>
          {NOTES.map(([title, text]) => (
            <li
              key={title}
              className={`grid grid-cols-[minmax(0,420px)_1fr] gap-x-8 border-b ${DOTTED} py-5 max-md:grid-cols-1`}
            >
              <span className="text-xl font-semibold tracking-[-0.025em]">
                {title}
              </span>
              <span className="text-sm text-muted md:pt-1.5">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border bg-bg">
        <div className={SECTION}>
          <LeadCopy
            title="Do this on every pull request."
            className="max-w-[720px]"
          >
            Your CI takes the screenshots. stateofpixel compares them with the
            approved ones and sets a GitHub check that waits until someone
            approves each change.
          </LeadCopy>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <AuthButton label="Start free with GitHub" />
            <Link to="/" className={buttonClass("ghost")}>
              See how it works
            </Link>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}

async function sampleFile(name: string) {
  const response = await fetch(`/demo/${name}.png`);
  return new File([await response.blob()], `${name}.png`, {
    type: "image/png",
  });
}

function DropSlot({
  label,
  image,
  onPick,
}: {
  label: string;
  image: PickedImage | null;
  onPick: (file: File) => void;
}) {
  const [over, setOver] = useState(false);
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      onPick(file);
    }
  };
  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`flex min-h-24 cursor-pointer items-center gap-4 rounded-md border px-5 py-4 transition-colors duration-100 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus ${
        over ? "border-link bg-hover" : `${DOTTED} bg-surface hover:bg-hover`
      }`}
    >
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onPick(file);
          }
          event.target.value = "";
        }}
      />
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted">
        <UploadSimpleIcon size={16} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-medium">{label}</span>
        {image === null ? (
          <span className="text-sm text-muted">
            Drop an image here, or click to pick one
          </span>
        ) : (
          <span className="flex min-w-0 gap-2 text-sm text-muted">
            <span className="truncate">{image.name}</span>
            <span className="shrink-0 tabular-nums">
              {image.width}x{image.height}
            </span>
          </span>
        )}
      </span>
    </label>
  );
}
