import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useI18n } from '../i18n';

export default function CopyEmailButton() {
  const { dict } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const email = dict.hireMe.emailAddress;
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = email;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const legacyCopy = (document as unknown as { execCommand?: (commandId: string) => boolean }).execCommand;
      if (legacyCopy?.call(document, 'copy')) {
        setCopied(true);
      }
      document.body.removeChild(textarea);
    }
    window.setTimeout(() => setCopied(false), 2400);
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm sm:text-base font-bold transition-all hover:opacity-85 cursor-pointer"
      style={{
        backgroundColor: copied ? 'var(--accent-mist)' : 'var(--bg-subtle)',
        borderColor: 'var(--border-main)',
        color: copied ? '#231F1E' : 'var(--text-primary)',
      }}
    >
      {copied ? (
        <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
      ) : (
        <Copy className="h-5 w-5 shrink-0" aria-hidden="true" />
      )}
      <span>{copied ? dict.hireMe.emailCopied : dict.hireMe.copyEmail}</span>
    </button>
  );
}
