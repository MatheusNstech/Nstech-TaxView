import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemePreference } from '../context/ThemeContext'

const labels: Record<ThemePreference, string> = {
  light: 'Tema claro',
  dark: 'Tema escuro',
  system: 'Tema do sistema',
}

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, cycleTheme } = useTheme()

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <button
      type="button"
      className={['btn-ghost !p-2', className].filter(Boolean).join(' ')}
      aria-label={labels[theme]}
      title={`${labels[theme]} — clique para alternar`}
      onClick={cycleTheme}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  )
}
