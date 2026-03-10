interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helpText?: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  helpText?: string;
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helpText?: string;
}

export function FormInput({ label, error, helpText, ...props }: InputProps) {
  return (
    <div>
      <label className="label">{label}</label>
      <input {...props} className={`input ${error ? "border-red-500 focus:ring-red-500" : ""}`} />
      {helpText && !error && <p className="mt-1 text-xs text-gray-400">{helpText}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function FormSelect({ label, error, options, helpText, ...props }: SelectProps) {
  return (
    <div>
      <label className="label">{label}</label>
      <select {...props} className={`input ${error ? "border-red-500" : ""}`}>
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helpText && !error && <p className="mt-1 text-xs text-gray-400">{helpText}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function FormTextArea({ label, error, helpText, ...props }: TextAreaProps) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea {...props} className={`input min-h-[80px] ${error ? "border-red-500" : ""}`} />
      {helpText && !error && <p className="mt-1 text-xs text-gray-400">{helpText}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
