interface ErrorNoticeProps {
  title: string;
  message: string;
}

// Shown when a page cannot load its data, instead of silently rendering empty/zero values
export function ErrorNotice({ title, message }: ErrorNoticeProps) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}
