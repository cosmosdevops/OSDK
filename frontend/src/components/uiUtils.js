import React from 'react';

export const Popover = ({ id, children }) => (
  <wa-popover for={id}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{children}</div>
  </wa-popover>
);

export const LabeledInput = ({ id, value, onChange, placeholder, error, touched }) => (
  <label>
    {id.charAt(0).toUpperCase() + id.slice(1)}:
    <wa-input
      placeholder={placeholder}
      value={value}
      onInput={onChange}
      onChange={onChange}
      with-clear
      invalid={!!error && touched}
    >
      <wa-icon id={`popover__${id}`} variant="regular" name="circle-question" slot="end" />
    </wa-input>
    {error && touched && <span className="error-text">{error}</span>}
  </label>
);
