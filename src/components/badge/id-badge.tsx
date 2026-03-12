/**
 * Small badge for displaying technical identifiers (stop_id, route_id, etc.).
 */
export function IdBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block w-fit rounded bg-[#e0e0e0] px-1.5 py-px text-[10px] leading-[1.4] text-[#666] dark:bg-gray-700 dark:text-gray-400">
      {children}
    </span>
  );
}
