import React from 'react';

export const Popover = ({ id, children }) => (
  <wa-popover for={id} style={{ zIndex: 9999 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{children}</div>
  </wa-popover>
);

export const LabeledInput = ({ id, label, value, onChange, placeholder, error, touched }) => {
  // Strip any suffix (like -0, -1) to use the base popover ID
  const baseId = id.replace(/-\d+$/, '');
  return (
    <label>
      {label || (id.charAt(0).toUpperCase() + id.slice(1))}:
      <wa-input
        placeholder={placeholder}
        value={value}
        onInput={onChange}
        onChange={onChange}
        with-clear
        invalid={!!error && touched}
      >
        <wa-icon id={`popover__${baseId}`} variant="regular" name="circle-question" slot="end" style={{ cursor: 'pointer' }} />
      </wa-input>
      {error && touched && <span className="error-text">{error}</span>}
    </label>
  );
};

export const LabeledSelect = ({ id, label, value, onChange, children, error, touched }) => {
  // Strip any suffix (like -0, -1) to use the base popover ID
  const baseId = id.replace(/-\d+$/, '');
  return (
    <label>
      {label || (id.charAt(0).toUpperCase() + id.slice(1))}:
        <wa-select
          value={value}
          onChange={onChange}
          onInput={onChange}
        >
          <wa-icon id={`popover__${baseId}`} variant="regular" name="circle-question" slot="end" style={{ cursor: 'pointer' }}></wa-icon>
          {children}
        </wa-select>
      {error && touched && <span className="error-text">{error}</span>}
    </label>
  );
};
