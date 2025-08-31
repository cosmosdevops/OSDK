import React, { useEffect, useRef } from 'react';
import { Popover, LabeledInput } from './uiUtils';

const BASE_FIELDS = [
  {
    key: 'group', placeholder: 'e.g. apps',
    help: '<p>The <b>group</b> is the API group for this CRD, e.g. <b>apps</b>, <b>batch</b>, or <b>custom</b>. It determines the API endpoint path.</p>'
  },
  {
    key: 'version', placeholder: 'e.g. v1alpha1',
    help: '<p>The <b>version</b> is the API version for this CRD, e.g. <b>v1</b>, <b>v1alpha1</b>, or <b>v1beta1</b>. It is used for versioning your CRDs.</p>'
  },
  {
    key: 'kind', placeholder: 'e.g. Widget',
    help: '<p>The <b>Kind</b> is the resource type name, e.g. <b>Widget</b>, <b>ReplicaSet</b>, or <b>MyResource</b>. It should be singular and in PascalCase.</p>'
  },
  {
    key: 'plural', placeholder: 'e.g. widgets',
    help: '<p>The <b>plural</b> is the plural name for this CRD, e.g. <b>widgets</b>, <b>replicasets</b>. It is used in the API endpoint path.</p>'
  },
];

const SWITCH_FIELDS = [
  {
    key: 'controller', label: 'Controller',
    help: '<p>Enable to scaffold a <b>controller</b> for this CRD.</p>'
  },
  {
    key: 'status', label: 'Status',
    help: '<p>Enable to add a <b>status subresource</b> to this CRD. This allows the controller to update status information separately from the spec.</p>'
  },
];

function SwitchWrapper({ checked, onChange, ...rest }) {
  const ref = useRef(null);
  // Sync after each render when checked changes
  useEffect(() => {
    if (ref.current && ref.current.checked !== checked) {
      ref.current.checked = checked;
    }
  }, [checked]);
  // Extra animation frame to catch custom element upgrade timing
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (ref.current && ref.current.checked !== checked) {
        ref.current.checked = checked;
      }
    });
    return () => cancelAnimationFrame(id);
  }, []); // run once
  return <wa-switch ref={ref} checked={checked} onChange={onChange} {...rest} />;
}

function CRDBasicInfo({ 
  group, setGroup, version, setVersion, kind, setKind, plural, setPlural,
  controller, setController, status, setStatus,
  errors, touched, setTouched 
}) {
  const valueMap = { group, version, kind, plural };
  const setterMap = { group: setGroup, version: setVersion, kind: setKind, plural: setPlural };
  const switchValueMap = { controller, status };
  const switchSetterMap = { controller: setController, status: setStatus };

  const onBaseChange = key => e => {
    let value = e.target.value;
    if (key === 'kind' && value.length > 0) {
      value = value.charAt(0).toUpperCase() + value.slice(1);
    }
    setterMap[key](value);
    setTouched(t => ({ ...t, [key]: true }));
  };

  const onSwitchToggle = key => e => switchSetterMap[key](e.target.checked);

  return (
    <div>
      {/* Pop-overs for all fields */}
      {[...BASE_FIELDS, ...SWITCH_FIELDS].map(f => (
        <Popover key={f.key} id={`popover__${f.key}`}>
          <p dangerouslySetInnerHTML={{ __html: f.help }} />
        </Popover>
      ))}

      <h2>CRD Details</h2>

      {/* Text fields */}
      {BASE_FIELDS.map(f => (
        <LabeledInput
          key={f.key}
          id={f.key}
          placeholder={f.placeholder}
          value={valueMap[f.key]}
          onChange={onBaseChange(f.key)}
          error={errors[f.key]}
          touched={touched[f.key]}
        />
      ))}

      {/* Switches */}
      {SWITCH_FIELDS.filter(sw => sw.key !== 'namespaced').map(sw => (
        <div key={sw.key}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <SwitchWrapper
            checked={!!switchValueMap[sw.key]}
            onChange={onSwitchToggle(sw.key)}
          />
          <span>{sw.label}</span>
          <span style={{ flex: 1 }} />
          <wa-icon id={`popover__${sw.key}`} variant="regular" name="circle-question"
            slot="end"
            style={{ marginLeft: '0.5rem', verticalAlign: 'middle', cursor: 'pointer' }} />
        </div>
      ))}
    </div>
  );
}

export default CRDBasicInfo;
