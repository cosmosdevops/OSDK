import React from 'react';
import { Popover, LabeledInput } from './uiUtils';

const FIELDS = [
  {
    key: 'domain',
    placeholder: 'e.g. example.com',
    help: 'The domain is the root DNS name for your operator, e.g. <b>example.com</b>. It is used as the API group root for your CRDs.'
  },
  {
    key: 'repo',
    placeholder: 'e.g. github.com/org/repo',
    help: 'The repository is the source code location for your operator, e.g. <b>github.com/org/repo</b>. This is used for project scaffolding and documentation.'
  },
  {
    key: 'projectName',
    placeholder: 'e.g. myoperator',
    help: 'The project name is the name of your operator project, e.g. <b>myoperator</b>. It will be used for folder and binary names.'
  }
];

function GeneralInfo({ domain, setDomain, repo, setRepo, projectName, setProjectName, namespaced, setNamespaced, namespaces = '', setNamespaces = () => {}, errors, touched, setTouched }) {
  const valueMap = { domain, repo, projectName };
  const setterMap = { domain: setDomain, repo: setRepo, projectName: setProjectName };
  const onChange = key => e => {
    setterMap[key](e.target.value);
    setTouched(t => ({ ...t, [key]: true }));
  };

  return (
    <div>
      {FIELDS.map(f => (
        <Popover key={f.key} id={`popover__${f.key}`}>
          <p dangerouslySetInnerHTML={{ __html: f.help }} />
        </Popover>
      ))}
      <h2>General Information</h2>
      {FIELDS.map(f => (
        <LabeledInput
          key={f.key}
          id={f.key}
          placeholder={f.placeholder}
          value={valueMap[f.key]}
          onChange={onChange(f.key)}
          error={errors[f.key]}
          touched={touched[f.key]}
        />
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <label htmlFor="namespaced" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <wa-switch
            id="namespaced"
            checked={namespaced}
            onChange={e => setNamespaced(e.target.checked)}
          />
          <span>Namespaced</span>
        </label>
        <wa-icon id="popover__namespaced" variant="regular" name="circle-question" slot="end" style={{ marginLeft: '0.5rem', verticalAlign: 'middle', cursor: 'pointer' }} />
        <Popover id="popover__namespaced">
          <p>If enabled, the operator will watch the provided <b>namespaces</b>; otherwise, the operator will watch at a <b>cluster-scope</b>.</p>
        </Popover>
      </div>
      {namespaced && (
        <>
          <Popover id="popover__namespaces">
            <p>Comma-separated list of namespaces to watch. Only resources in these namespaces will be watched.</p>
          </Popover>
          <LabeledInput
            id="namespaces"
            placeholder="Comma-separated namespaces (e.g. ns1,ns2,ns3)"
            value={namespaces}
            onChange={e => setNamespaces(e.target.value)}
            help="Optional: Specify namespaces to watch"
          />
        </>
      )}
    </div>
  );
}

export default GeneralInfo;
