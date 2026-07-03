import { Children, cloneElement, isValidElement, useMemo, useState } from 'react';

export default function FormField({
  id,
  label,
  required = false,
  optional = false,
  hint = '',
  requiredHint = 'Required field',
  error = '',
  className = '',
  children,
}) {
  const [touched, setTouched] = useState(false);

  const fieldError = useMemo(() => {
    if (error) return error;
    if (!required || !touched) return '';
    const child = Children.toArray(children)[0];
    if (!isValidElement(child)) return '';
    const value = child.props?.value;
    if (typeof value === 'string' && value.trim().length === 0) return 'This field is required.';
    if (value === undefined || value === null || value === '') return 'This field is required.';
    return '';
  }, [children, error, required, touched]);

  const displayHint = fieldError
    ? ''
    : hint || (required ? requiredHint : '');

  const describedBy = fieldError
    ? `${id || 'field'}-error`
    : displayHint
    ? `${id || 'field'}-hint`
    : undefined;

  const enhancedChild = useMemo(() => {
    const child = Children.toArray(children)[0];
    if (!isValidElement(child)) return children;

    const originalOnBlur = child.props?.onBlur;

    return cloneElement(child, {
      id: child.props?.id || id,
      'aria-invalid': fieldError ? 'true' : undefined,
      'aria-describedby': describedBy,
      onBlur: (event) => {
        setTouched(true);
        if (typeof originalOnBlur === 'function') {
          originalOnBlur(event);
        }
      },
    });
  }, [children, describedBy, fieldError, id]);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label ? (
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span>{label}</span>
          {required ? <span className="text-[10px] uppercase font-bold tracking-wider text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">Required</span> : null}
          {!required && optional ? <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Optional</span> : null}
        </label>
      ) : null}
      {enhancedChild}
      {fieldError ? (
        <p id={`${id || 'field'}-error`} role="alert" className="text-xs font-medium text-rose-500">{fieldError}</p>
      ) : displayHint ? (
        <p id={`${id || 'field'}-hint`} aria-live="polite" className="text-xs text-slate-500">{displayHint}</p>
      ) : null}
    </div>
  );
}
