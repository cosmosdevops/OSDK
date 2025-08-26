import React, { useState } from 'react';
import Properties from './Properties';
import { Popover, LabeledInput } from './uiUtils';

/* ---------- Field meta-data -------------------------------------------- */

const BASE_FIELDS = [
  { key:'group',   placeholder:'e.g. apps',
    help:'<p>The <b>group</b> is the API group for this CRD, e.g. <b>apps</b>, <b>batch</b>, or <b>custom</b>. It determines the API endpoint path.</p>' },
  { key:'version', placeholder:'e.g. v1alpha1',
    help:'<p>The <b>version</b> is the API version for this CRD, e.g. <b>v1</b>, <b>v1alpha1</b>, or <b>v1beta1</b>. It is used for versioning your CRDs.</p>' },
  { key:'kind',    placeholder:'e.g. Widget',
    help:'<p>The <b>Kind</b> is the resource type name, e.g. <b>Widget</b>, <b>ReplicaSet</b>, or <b>MyResource</b>. It should be singular and in PascalCase.</p>' },
  { key:'plural',  placeholder:'e.g. widgets',
    help:'<p>The <b>plural</b> is the plural name for this CRD, e.g. <b>widgets</b>, <b>replicasets</b>. It is used in the API endpoint path.</p>' },
];

const SWITCH_FIELDS = [
  { key:'controller', label:'Controller',
    help:'<p>Enable to scaffold a <b>controller</b> for this CRD.</p>' },
  { key:'status', label:'Status',
    help:'<p>Enable to add a <b>status subresource</b> to this CRD. This allows the controller to update status information separately from the spec.</p>' },
];

const RBAC_FIELDS = [
  { key:'deployments', label:'Deployments',
    help:'<p>Grant permissions to manage <b>Deployments</b> in the apps API group.</p>' },
  { key:'events', label:'Events',
    help:'<p>Grant permissions to create and patch <b>Events</b> for logging and monitoring.</p>' },
  { key:'routes', label:'Routes (OpenShift)',
    help:'<p>Grant permissions to manage <b>Routes</b> in OpenShift environments.</p>' },
  { key:'configmaps', label:'ConfigMaps',
    help:'<p>Grant permissions to manage <b>ConfigMaps</b> for configuration data.</p>' },
  { key:'secrets', label:'Secrets',
    help:'<p>Grant permissions to manage <b>Secrets</b> for sensitive data.</p>' },
  { key:'services', label:'Services',
    help:'<p>Grant permissions to manage <b>Services</b> for network access.</p>' },
  { key:'ingresses', label:'Ingresses',
    help:'<p>Grant permissions to manage <b>Ingresses</b> for external access.</p>' },
];

const RBAC_PRESETS = {
  deployments: { group: 'apps', resources: 'deployments', verbs: 'get;list;watch;create;update;patch;delete' },
  events: { group: '', resources: 'events', verbs: 'create;patch' },
  routes: { group: 'route.openshift.io', resources: 'routes', verbs: 'get;list;watch;create;update;patch;delete' },
  configmaps: { group: '', resources: 'configmaps', verbs: 'get;list;watch;create;update;patch;delete' },
  secrets: { group: '', resources: 'secrets', verbs: 'get;list;watch;create;update;patch;delete' },
  services: { group: '', resources: 'services', verbs: 'get;list;watch;create;update;patch;delete' },
  ingresses: { group: 'networking.k8s.io', resources: 'ingresses', verbs: 'get;list;watch;create;update;patch;delete' },
};

/* Validation options by property type */
const VALIDATION_TYPES = {
  string : ['minLength','maxLength','pattern','enum','format','default','example','type'],
  integer: ['minimum','maximum','multipleOf','enum','format','default','example','type'],
  array  : ['minItems','maxItems','uniqueItems','itemsEnum','itemsPattern','itemsFormat',
            'default','example','type'],
  object : ['minProperties','maxProperties','default','example','type'],
  common : ['required','optional'],
};

/* ---------- Main component -------------------------------------------- */

function CRDDetails({
  /* text-field state */
  group, setGroup, version, setVersion, kind, setKind, plural, setPlural,
  /* switch state */
  controller, setController, status, setStatus,
  /* rbac state */
  rbac, setRbac, addRbacPermission, updateRbacPermission, removeRbacPermission,
  /* misc props */
  addNewCRD, switchCRD, crdList, currentCRDIndex,
  properties, addProperty, updateProperty, removeProperty,
  errors, touched, setTouched,
}) {
  const valueMap       = { group, version, kind, plural };
  const setterMap      = { group: setGroup, version: setVersion, kind: setKind, plural: setPlural };
  const switchValueMap = { controller, status };
  const switchSetterMap= { controller: setController, status: setStatus };

  const [showRbac, setShowRbac] = useState(false);

  const onBaseChange   = key => e => {
    let value = e.target.value;
    if (key === 'kind' && value.length > 0) {
      value = value.charAt(0).toUpperCase() + value.slice(1);
    }
    setterMap[key](value);
    setTouched(t => ({ ...t, [key]: true }));
  };

  const onSwitchToggle = key => e => switchSetterMap[key](e.target.checked);

  /* -- pop-overs for all fields ---------------------- */
  const popovers = [...BASE_FIELDS, ...SWITCH_FIELDS].map(f => (
    <Popover key={f.key} id={`popover__${f.key}`}>
      <p dangerouslySetInnerHTML={{ __html: f.help }} />
    </Popover>
  ));

  /* ------------------------------- UI ---------------------------------- */
  return (
    <div>
      {popovers}

      <h2>CRD Details</h2>

      {/* Toolbar ---------------------------------------------------------- */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <wa-button variant="brand" appearance="filled" size="small" onClick={addNewCRD}>
          Add New CRD
        </wa-button>

        <select onChange={e => switchCRD(e.target.value)} value={currentCRDIndex}>
          {crdList.map((crd, i) => (
            <option key={i} value={i}>{`CRD ${i + 1}: ${crd.kind || 'Unnamed'}`}</option>
          ))}
        </select>
      </div>

      {/* Text fields ------------------------------------------------------ */}
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

      {/* Switches --------------------------------------------------------- */}
      {SWITCH_FIELDS.filter(sw => sw.key !== 'namespaced').map(sw => (
        <div key={sw.key}
             style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <wa-switch
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

      {/* RBAC Permissions ------------------------------------------------ */}
      <div style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>RBAC Permissions</h3>
          <wa-button 
            variant="brand" 
            appearance="filled" 
            size="small"
            onClick={() => setShowRbac(!showRbac)}
            style={{ marginLeft: 'auto' }}
          >
            {showRbac ? 'Hide' : 'Configure'}
          </wa-button>
        </div>
        <p style={{ fontSize: '0.9rem', color: '#868686ff', marginBottom: '1rem' }}>
          Configure Kubernetes resources your controller needs to manage.
        </p>
        
        {showRbac && (
          <div style={{ paddingLeft: '1rem', borderLeft: '3px solid #e0e0e0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0 }}>Permissions</h4>
              <wa-button 
                variant="brand" 
                appearance="filled" 
                size="small"
                onClick={addRbacPermission}
                style={{ marginLeft: 'auto' }}
              >
                Add Permission
              </wa-button>
            </div>
            
            {rbac?.map((permission, idx) => (
              <div key={idx} style={{
                marginBottom: '1.5rem',
                padding: '0.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '6px'
              }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <select
                    value={permission.preset || ''}
                    onChange={e => {
                      if (e.target.value) {
                        const preset = RBAC_PRESETS[e.target.value];
                        updateRbacPermission(idx, 'group', preset.group);
                        updateRbacPermission(idx, 'resources', preset.resources);
                        updateRbacPermission(idx, 'verbs', preset.verbs);
                        updateRbacPermission(idx, 'preset', e.target.value);
                      } else {
                        // Clear fields when selecting "Custom Permission"
                        updateRbacPermission(idx, 'group', '');
                        updateRbacPermission(idx, 'resources', '');
                        updateRbacPermission(idx, 'verbs', '');
                        updateRbacPermission(idx, 'preset', '');
                      }
                    }}
                    style={{ flex: 1 }}
                  >
                    <option value="">Custom Permission</option>
                    {RBAC_FIELDS.map(field => (
                      <option key={field.key} value={field.key}>{field.label}</option>
                    ))}
                  </select>
                  <wa-button 
                    variant="danger" 
                    size="small"
                    onClick={() => removeRbacPermission(idx)}
                  >
                    Remove
                  </wa-button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '0.5rem' }}>
                  <wa-input
                    placeholder="API Group (e.g. apps)"
                    value={permission.group || ''}
                    onInput={e => updateRbacPermission(idx, 'group', e.target.value)}
                  />
                  <wa-input
                    placeholder="Resources (e.g. deployments)"
                    value={permission.resources || ''}
                    onInput={e => updateRbacPermission(idx, 'resources', e.target.value)}
                  />
                  <wa-input
                    placeholder="Verbs (e.g. get;list;watch;create;update;patch;delete)"
                    value={permission.verbs || ''}
                    onInput={e => updateRbacPermission(idx, 'verbs', e.target.value)}
                  />
                </div>
              </div>
            ))}
            
            {rbac?.length === 0 && (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem', 
                color: '#666',
                fontStyle: 'italic'
              }}>
                No RBAC permissions configured. Click "Add Permission" to get started.
              </div>
            )}
          </div>
        )}
      </div>

      <Properties
        properties={properties}
        addProperty={addProperty}
        updateProperty={updateProperty}
        removeProperty={removeProperty}
        errors={errors}
        touched={touched}
        setTouched={setTouched}
      />
    </div>
  );
}

export default CRDDetails;