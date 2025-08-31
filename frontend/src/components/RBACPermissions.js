import React, { useState } from 'react';

const RBAC_FIELDS = [
  {
    key: 'deployments', label: 'Deployments',
    help: '<p>Grant permissions to manage <b>Deployments</b> in the apps API group.</p>'
  },
  {
    key: 'events', label: 'Events',
    help: '<p>Grant permissions to create and patch <b>Events</b> for logging and monitoring.</p>'
  },
  {
    key: 'routes', label: 'Routes (OpenShift)',
    help: '<p>Grant permissions to manage <b>Routes</b> in OpenShift environments.</p>'
  },
  {
    key: 'configmaps', label: 'ConfigMaps',
    help: '<p>Grant permissions to manage <b>ConfigMaps</b> for configuration data.</p>'
  },
  {
    key: 'secrets', label: 'Secrets',
    help: '<p>Grant permissions to manage <b>Secrets</b> for sensitive data.</p>'
  },
  {
    key: 'services', label: 'Services',
    help: '<p>Grant permissions to manage <b>Services</b> for network access.</p>'
  },
  {
    key: 'ingresses', label: 'Ingresses',
    help: '<p>Grant permissions to manage <b>Ingresses</b> for external access.</p>'
  },
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

function RBACPermissions({ 
  rbac, addRbacPermission, updateRbacPermission, removeRbacPermission 
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5; // Show 5 permissions per page
  
  // Calculate pagination
  const totalPages = Math.ceil(rbac.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, rbac.length);
  const paginatedRbac = rbac.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>RBAC Permissions</h3>
      </div>
      <p style={{ fontSize: '0.9rem', color: '#868686ff', marginBottom: '1rem' }}>
        Configure permissions for Kubernetes resources your controller needs to manage.
      </p>

      <div className="wa-stack" style={{ paddingLeft: '1rem', borderLeft: '3px solid #e0e0e0' }}>
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

        {rbac?.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#666',
            fontStyle: 'italic'
          }}>
            No RBAC permissions configured. Click "Add Permission" to get started.
          </div>
        ) : (
          <>
            {paginatedRbac.map((permission, displayIdx) => {
              const actualIdx = startIndex + displayIdx; // Get the actual index in the full array
              return (
                <div key={actualIdx} style={{
                  marginBottom: '1.5rem',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px'
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <wa-select
                      value={permission.preset || ''}
                      onChange={e => {
                        if (e.target.value) {
                          const preset = RBAC_PRESETS[e.target.value];
                          updateRbacPermission(actualIdx, 'group', preset.group);
                          updateRbacPermission(actualIdx, 'resources', preset.resources);
                          updateRbacPermission(actualIdx, 'verbs', preset.verbs);
                          updateRbacPermission(actualIdx, 'preset', e.target.value);
                        } else {
                          // Clear fields when selecting "Custom Permission"
                          updateRbacPermission(actualIdx, 'group', '');
                          updateRbacPermission(actualIdx, 'resources', '');
                          updateRbacPermission(actualIdx, 'verbs', '');
                          updateRbacPermission(actualIdx, 'preset', '');
                        }
                      }}
                      style={{ flex: 1 }}
                    >
                      <wa-option value="">Custom Permission</wa-option>
                      {RBAC_FIELDS.map(field => (
                        <wa-option key={field.key} value={field.key}>{field.label}</wa-option>
                      ))}
                    </wa-select>
                    <wa-button
                      variant="danger"
                      size="small"
                      onClick={() => removeRbacPermission(actualIdx)}
                    >
                      Remove
                    </wa-button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <wa-input
                      placeholder="API Group (e.g. apps)"
                      value={permission.group || ''}
                      onInput={e => updateRbacPermission(actualIdx, 'group', e.target.value)}
                    />
                    <wa-input
                      placeholder="Resources (e.g. deployments)"
                      value={permission.resources || ''}
                      onInput={e => updateRbacPermission(actualIdx, 'resources', e.target.value)}
                    />
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'block' }}>
                      Verbs:
                    </label>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'].map(verb => {
                        const currentVerbs = permission.verbs ? permission.verbs.split(';').map(v => v.trim()).filter(v => v) : [];
                        const isChecked = currentVerbs.includes(verb);
                        
                        return (
                          <wa-checkbox
                            key={verb}
                            checked={isChecked}
                            onInput={e => {
                              const newVerbs = e.target.checked
                                ? [...currentVerbs, verb]
                                : currentVerbs.filter(v => v !== verb);
                              updateRbacPermission(actualIdx, 'verbs', newVerbs.join(';'));
                            }}
                          >
                            {verb}
                          </wa-checkbox>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {totalPages > 1 && (
              <>
                <wa-divider></wa-divider>
                <div className="wa-split">
                  <span className="wa-caption-l">
                    Showing {startIndex + 1} to {endIndex} of {rbac.length} Permissions
                  </span>
                  <div className="wa-cluster wa-gap-xs">
                    <wa-button 
                      appearance="outlined" 
                      size="small"
                      onClick={handlePrevPage}
                      disabled={currentPage === 0}
                    >
                      <wa-icon slot="start" name="chevron-left"></wa-icon>
                      Prev
                    </wa-button>
                    <wa-button 
                      appearance="outlined" 
                      size="small"
                      onClick={handleNextPage}
                      disabled={currentPage >= totalPages - 1}
                    >
                      <wa-icon slot="end" name="chevron-right"></wa-icon>
                      Next
                    </wa-button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default RBACPermissions;
