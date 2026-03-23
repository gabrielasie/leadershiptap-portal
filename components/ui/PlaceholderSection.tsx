interface PlaceholderSectionProps {
  icon: React.ReactNode
  title: string
  message: string
}

export default function PlaceholderSection({ icon, title, message }: PlaceholderSectionProps) {
  return (
    <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 flex flex-col items-center text-center">
      <div className="text-slate-300 [&>svg]:h-8 [&>svg]:w-8 mb-3">{icon}</div>
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <p className="text-sm text-slate-400 mt-1">{message}</p>
    </div>
  )
}
