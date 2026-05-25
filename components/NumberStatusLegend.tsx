"use client";

import { translations, Lang } from "@/lib/i18n/translations";

type Props = {
  lang?: Lang;
};

export default function NumberStatusLegend({ lang = "en" }: Props) {
  const txt = translations[lang] || translations.en;

  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          {txt.numberStatusGuide}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs lg:grid-cols-3">
        <LegendItem
          boxClass="border border-gray-300 bg-white"
          wrapperClass="border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          titleClass="text-gray-800 dark:text-white"
          descClass="text-gray-500 dark:text-slate-400"
          title={txt.availableLegend}
          desc={txt.availableLegendDesc}
        />

        <LegendItem
          boxClass="bg-blue-600"
          wrapperClass="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40"
          titleClass="text-blue-800 dark:text-blue-100"
          descClass="text-blue-600 dark:text-blue-300"
          title={txt.selectedLegend}
          desc={txt.selectedLegendDesc}
        />

        <LegendItem
          boxClass="bg-green-600"
          wrapperClass="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40 col-span-2 lg:col-span-1"
          titleClass="text-green-800 dark:text-green-100"
          descClass="text-green-700 dark:text-green-300"
          title={txt.reservedClosedLegend || txt.takenLegend}
          desc={txt.reservedClosedLegendDesc || txt.takenLegendDesc}
        />
      </div>
    </div>
  );
}

function LegendItem({
  boxClass,
  wrapperClass,
  titleClass,
  descClass,
  title,
  desc,
}: {
  boxClass: string;
  wrapperClass: string;
  titleClass: string;
  descClass: string;
  title: string;
  desc: string;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${wrapperClass}`}>
      <span className={`h-4 w-4 rounded-md ${boxClass}`} />
      <div>
        <div className={`font-bold ${titleClass}`}>{title}</div>
        <div className={descClass}>{desc}</div>
      </div>
    </div>
  );
}
