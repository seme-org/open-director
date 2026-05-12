"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clapperboard,
  LoaderCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BriefItem = {
  key: string;
  label: string;
  value: string;
};

type BriefChoice = {
  key: string;
  label: string;
  options: BriefChoiceOption[];
};

type BriefChoiceOption = {
  value: string;
  label: string;
  default?: number;
  imageUrl?: string;
};

type BriefPage =
  | { type: "input" | "fill"; title: string; items: BriefItem[] }
  | { type: "choice"; title: string; choice: BriefChoice }
  | { type: "summary"; title: string };

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function items(value: unknown): BriefItem[] {
  return Array.isArray(value)
    ? value.map(asRecord).map((item) => ({
        key: textValue(item.key),
        label: textValue(item.label, textValue(item.key)),
        value: textValue(item.value),
      }))
    : [];
}

function choices(value: unknown): BriefChoice[] {
  return Array.isArray(value)
    ? value.map(asRecord).map((choice) => ({
        key: textValue(choice.key),
        label: textValue(choice.label, textValue(choice.key)),
        options: Array.isArray(choice.options)
          ? choice.options.map(asRecord).map((option) => ({
              value: textValue(option.value),
              label: textValue(option.label, textValue(option.value)),
              default: Number(option.default) === 1 ? 1 : 0,
              imageUrl:
                textValue(option.imageUrl, textValue(option.image_url)) ||
                undefined,
            }))
          : [],
      }))
    : [];
}

export function buildModifiedDirectorBrief(
  brief: Record<string, unknown>,
  inputValues: Record<string, string>,
  fillValues: Record<string, string>,
  choiceValues: Record<string, string>,
) {
  const exam = asRecord(brief.exam);
  const updateItems = (value: unknown, values: Record<string, string>) =>
    items(value).map((item) => ({
      ...item,
      value: values[item.key] ?? item.value,
    }));
  const updateChoices = (value: unknown) =>
    choices(value).map((choice) => ({
      ...choice,
      options: choice.options.map((option) => ({
        ...option,
        default: option.value === choiceValues[choice.key] ? 1 : 0,
      })),
    }));

  return {
    ...brief,
    exam: {
      input_parameter: updateItems(exam.input_parameter, inputValues),
      fill_blank: updateItems(exam.fill_blank, fillValues),
      single_choice: updateChoices(exam.single_choice),
      multi_choice: updateChoices(exam.multi_choice),
    },
  };
}

function ArtStyleOptionContent({ option }: { option: BriefChoiceOption }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      {option.imageUrl ? (
        <span className="group/thumb relative grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={option.imageUrl}
            alt={option.label}
            className="h-full w-full rounded-md object-cover"
          />
          <span className="pointer-events-none absolute left-12 top-1/2 z-[80] hidden w-56 -translate-y-1/2 overflow-hidden rounded-lg border border-amber-200/30 bg-zinc-950 p-1 shadow-2xl group-hover/thumb:block group-focus-visible/thumb:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={option.imageUrl}
              alt=""
              className="aspect-video w-full rounded-md object-cover"
            />
            <span className="block px-2 py-1.5 text-xs font-semibold text-amber-50">
              {option.label}
            </span>
          </span>
        </span>
      ) : null}
      <span className="min-w-0 truncate">{option.label}</span>
    </span>
  );
}

function SelectedArtStyleValue({
  option,
  placeholder,
}: {
  option?: BriefChoiceOption;
  placeholder: string;
}) {
  if (!option) return <SelectValue placeholder={placeholder} />;
  return (
    <span className="flex min-w-0 items-center gap-2">
      {option.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={option.imageUrl}
          alt=""
          className="h-6 w-6 shrink-0 rounded object-cover"
        />
      ) : null}
      <span className="truncate">{option.label}</span>
    </span>
  );
}

export function DirectorBriefCard({
  brief,
  busy,
  onConfirm,
}: {
  brief: Record<string, unknown>;
  busy: boolean;
  onConfirm: (brief: Record<string, unknown>) => void;
}) {
  const exam = asRecord(brief.exam);
  const inputItems = useMemo(
    () => items(exam.input_parameter),
    [exam.input_parameter],
  );
  const fillItems = useMemo(() => items(exam.fill_blank), [exam.fill_blank]);
  const singleChoices = useMemo(
    () => choices(exam.single_choice),
    [exam.single_choice],
  );
  const multiChoices = useMemo(
    () => choices(exam.multi_choice),
    [exam.multi_choice],
  );
  const [inputValues, setInputValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(inputItems.map((item) => [item.key, item.value])),
  );
  const [fillValues, setFillValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fillItems.map((item) => [item.key, item.value])),
  );
  const [choiceValues, setChoiceValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [...singleChoices, ...multiChoices].map((choice) => [
        choice.key,
        choice.options.find((option) => option.default === 1)?.value ??
          choice.options[0]?.value ??
          "",
      ]),
    ),
  );
  const pages = useMemo<BriefPage[]>(() => {
    const result: BriefPage[] = [];
    if (inputItems.length)
      result.push({ type: "input", title: "创作参数", items: inputItems });
    if (fillItems.length)
      result.push({ type: "fill", title: "创作补充", items: fillItems });
    for (const choice of [...singleChoices, ...multiChoices])
      result.push({ type: "choice", title: choice.label, choice });
    return result.length ? result : [{ type: "summary", title: "导演简报" }];
  }, [fillItems, inputItems, multiChoices, singleChoices]);
  const [page, setPage] = useState(0);
  const currentPage = pages[Math.min(page, pages.length - 1)];
  const isLastPage = page >= pages.length - 1;
  const modifiedBrief = buildModifiedDirectorBrief(
    brief,
    inputValues,
    fillValues,
    choiceValues,
  );

  return (
    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] text-left shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-center gap-2 border-b border-white/[0.08] bg-black/20 px-4 py-3">
        <Clapperboard className="h-4 w-4 text-amber-100" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
          {textValue(brief.title, "Director Brief")}
        </p>
      </div>
      <div className="px-5 py-4">
        <h3 className="text-lg font-semibold text-white">
          {textValue(brief.project_name, "新视频")}
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          请确认导演简报，确认后继续生成故事梗概、角色、美术风格、场景和分镜。
        </p>
        <div className="mt-4 min-h-36 rounded-xl bg-black/20 p-4">
          <p className="text-sm font-semibold text-amber-100">
            {currentPage.title}
          </p>
          <div className="mt-3 space-y-3">
            {(currentPage.type === "input" || currentPage.type === "fill") &&
              currentPage.items?.map((item) => {
                const values =
                  currentPage.type === "input" ? inputValues : fillValues;
                const setValues =
                  currentPage.type === "input" ? setInputValues : setFillValues;
                return (
                  <label
                    key={item.key}
                    className="block rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2"
                  >
                    <span className="text-xs text-slate-500">{item.label}</span>
                    <input
                      value={values[item.key] ?? ""}
                      onChange={(event) =>
                        setValues((previous) => ({
                          ...previous,
                          [item.key]: event.target.value,
                        }))
                      }
                      disabled={busy}
                      className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-black/20 px-3 text-sm font-medium text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-amber-200/40"
                      placeholder="输入内容"
                    />
                  </label>
                );
              })}
            {currentPage.type === "choice"
              ? (() => {
                  const selectedOption = currentPage.choice.options.find(
                    (option) =>
                      option.value === choiceValues[currentPage.choice.key],
                  );
                  const isArtStyleChoice =
                    currentPage.choice.key === "art_style";
                  return (
                    <Select
                      value={choiceValues[currentPage.choice.key] ?? ""}
                      onValueChange={(value) =>
                        setChoiceValues((previous) => ({
                          ...previous,
                          [currentPage.choice.key]: value,
                        }))
                      }
                      disabled={busy}
                    >
                      <SelectTrigger className="h-10 border-amber-200/25 bg-white/[0.04] text-slate-100">
                        {isArtStyleChoice ? (
                          <SelectedArtStyleValue
                            option={selectedOption}
                            placeholder={currentPage.choice.label}
                          />
                        ) : (
                          <SelectValue placeholder={currentPage.choice.label} />
                        )}
                      </SelectTrigger>
                      <SelectContent
                        className={
                          isArtStyleChoice ? "overflow-visible" : undefined
                        }
                      >
                        {currentPage.choice.options.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className={
                              isArtStyleChoice ? "py-2 pl-8 pr-3" : undefined
                            }
                          >
                            {isArtStyleChoice ? (
                              <ArtStyleOptionContent option={option} />
                            ) : (
                              option.label
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()
              : null}
            {currentPage.type === "summary" ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2">
                <p className="text-xs text-slate-500">项目</p>
                <p className="mt-1 text-sm font-medium text-slate-100">
                  {textValue(
                    brief.project_name,
                    textValue(brief.title, "新项目"),
                  )}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] px-5 py-3">
        <button
          type="button"
          onClick={() => onConfirm(modifiedBrief)}
          disabled={busy}
          className="inline-flex h-9 shrink-0 items-center rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 text-xs font-medium text-slate-200 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
        >
          全部接受
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            disabled={page === 0 || busy}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="上一页"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-1.5">
            {pages.map((item, index) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setPage(index)}
                className={`h-2 w-2 rounded-full transition ${index === page ? "bg-amber-100" : "bg-white/25 hover:bg-white/40"}`}
                aria-label={item.title}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setPage((value) => Math.min(pages.length - 1, value + 1))
            }
            disabled={isLastPage || busy}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="下一页"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={
            isLastPage
              ? () => onConfirm(modifiedBrief)
              : () => setPage((value) => Math.min(pages.length - 1, value + 1))
          }
          disabled={busy}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-amber-200/25 bg-amber-300/[0.14] px-3 text-xs font-semibold text-amber-50 transition hover:bg-amber-300/[0.22] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : isLastPage ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
          {isLastPage ? "确认" : "下一页"}
        </button>
      </div>
    </div>
  );
}
