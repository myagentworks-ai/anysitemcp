interface Props {
  stage: number;
  message: string;
}
export function AnalysisProgress({ stage, message }: Props) {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center gap-2 text-sm">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
            ${s < stage ? "bg-green-500 text-white" : s === stage ? "bg-blue-500 text-white animate-pulse" : "bg-gray-200 text-gray-400"}`}>
            {s < stage ? "✓" : s}
          </span>
          <span className={s === stage ? "text-blue-600 font-medium" : s < stage ? "text-green-600" : "text-gray-400"}>
            {s === 1 ? "API Spec Detection" : s === 2 ? "HTML Analysis" : "LLM Enrichment"}
          </span>
        </div>
      ))}
      <p className="text-xs text-gray-500 mt-1">{message}</p>
    </div>
  );
}
