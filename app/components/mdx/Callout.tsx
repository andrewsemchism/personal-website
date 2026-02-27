import { ReactNode } from 'react';

type CalloutVariant = 'info' | 'warning' | 'tip';

interface CalloutProps {
  variant?: CalloutVariant;
  children: ReactNode;
}

const config: Record<CalloutVariant, { icon: string; border: string; bg: string; text: string }> = {
  info: {
    icon: 'ℹ',
    border: 'border-[#7796cb]',
    bg: 'bg-[#7796cb]/10',
    text: 'text-[#7796cb]',
  },
  warning: {
    icon: '⚠',
    border: 'border-yellow-400',
    bg: 'bg-yellow-400/10',
    text: 'text-yellow-400',
  },
  tip: {
    icon: '✓',
    border: 'border-green-400',
    bg: 'bg-green-400/10',
    text: 'text-green-400',
  },
};

export default function Callout({ variant = 'info', children }: CalloutProps) {
  const { icon, border, bg, text } = config[variant];
  return (
    <div className={`flex gap-3 border-l-4 ${border} ${bg} rounded-r px-4 py-3 my-4`}>
      <span className={`${text} font-mono font-bold text-lg leading-6 select-none`}>{icon}</span>
      <div className="text-[#888e9e] text-sm leading-6">{children}</div>
    </div>
  );
}
