import React, { useState } from 'react';

const VALIDATION_TYPES = {
  string: ['minLength', 'maxLength', 'pattern', 'enum', 'format', 'default', 'example', 'type'],
  integer: ['minimum', 'maximum', 'multipleOf', 'enum', 'format', 'default', 'example', 'type'],
  array: ['minItems', 'maxItems', 'uniqueItems', 'itemsEnum', 'itemsPattern', 'itemsFormat',
    'default', 'example', 'type'],
  object: ['minProperties', 'maxProperties', 'default', 'example', 'type'],
  common: ['required', 'optional'],
};

function Properties({ properties, addProperty, updateProperty, removeProperty, errors, touched, setTouched }) {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5; // Show 5 properties per page to avoid overwhelming UI

  // Calculate pagination
  const totalPages = Math.ceil(properties.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, properties.length);
  const paginatedProperties = properties.slice(startIndex, endIndex);

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
      <div className="wa-stack">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Properties</h3>
          <p style={{ fontSize: '0.9rem', color: '#868686ff', marginBottom: '1rem' }}>
            Configure Properties to include in the generated custom resource definition code.
          </p>
          <wa-button
            variant="brand"
            appearance="filled"
            size="small"
            onClick={addProperty}
            style={{ marginLeft: 'auto' }}
          >
            Add Property
          </wa-button>
        </div>

        {properties.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#666',
            fontStyle: 'italic'
          }}>
            No properties defined. Click "Add Property" to get started.
          </div>
        ) : (
          <>
            {paginatedProperties.map((prop, displayIdx) => {
              const actualIdx = startIndex + displayIdx; // Get the actual index in the full array
              const propErr = errors.properties?.[actualIdx] ?? {};
              const propTouch = touched.properties?.[actualIdx] ?? {};
              const changeProp = (field, value) => updateProperty(actualIdx, field, value);
              const validationOptions = [
                ...(VALIDATION_TYPES[prop.type] ?? []),
                ...VALIDATION_TYPES.common,
              ];
              return (
                <div key={actualIdx} style={{
                  marginBottom: '1.5rem', padding: '0.75rem',
                  border: '1px solid #e0e0e0', borderRadius: '6px'
                }}>
                  {/* name + type */}
                  <wa-input
                    placeholder="Property name"
                    value={prop.name}
                    onInput={e => {
                      changeProp('name', e.target.value);
                      setTouched(t => ({
                        ...t, properties: {
                          ...t.properties, [actualIdx]: { ...propTouch, name: true }
                        }
                      }));
                    }}
                    with-clear
                    invalid={!!propErr.name && propTouch.name}
                  />
                  {propErr.name && propTouch.name && <span className="error-text">{propErr.name}</span>}
                  <wa-select
                    value={prop.type}
                    onChange={e => {
                      changeProp('type', e.target.value);
                      changeProp('validations', []);
                      setTouched(t => ({
                        ...t, properties: {
                          ...t.properties, [actualIdx]: { ...propTouch, type: true }
                        }
                      }));
                    }}
                    onInput={e => {
                      changeProp('type', e.target.value);
                      changeProp('validations', []);
                      setTouched(t => ({
                        ...t, properties: {
                          ...t.properties, [actualIdx]: { ...propTouch, type: true }
                        }
                      }));
                    }}
                    invalid={!!propErr.type && propTouch.type}
                  >
                    <wa-option value="">Select Type</wa-option>
                    {['string', 'integer', 'boolean', 'array', 'object']
                      .map(t => <wa-option key={t} value={t}>{t}</wa-option>)}
                  </wa-select>
                  {propErr.type && propTouch.type && <span className="error-text">{propErr.type}</span>}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <wa-button variant="brand" appearance="filled" size="small"
                      onClick={() => changeProp('showValidation', !prop.showValidation)}>
                      {prop.showValidation ? 'Hide Validations' : 'Show Validations'}
                    </wa-button>
                    <wa-button variant="danger" size="small"
                      onClick={() => removeProperty(actualIdx)}>
                      Remove
                    </wa-button>
                  </div>
                  {/* Validation editor */}
                  {prop.showValidation && (
                    <div style={{
                      marginTop: '0.75rem', marginLeft: '0.5rem',
                      padding: '0.75rem', borderRadius: '6px'
                    }}>
                      {prop.validations?.map((val, vIdx) => (
                        <div key={vIdx} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                          {/* type selector */}
                          <wa-select
                            style={{ width: '160px', marginRight: '0.5rem' }}
                            value={val.type}
                            onChange={e => {
                              const updated = [...prop.validations];
                              updated[vIdx].type = e.target.value;
                              changeProp('validations', updated);
                            }}
                            onInput={e => {
                              const updated = [...prop.validations];
                              updated[vIdx].type = e.target.value;
                              changeProp('validations', updated);
                            }}>
                            {validationOptions.map(opt =>
                              <wa-option key={opt} value={opt}>{opt}</wa-option>)}
                          </wa-select>
                          {/* value input – only render if needed */}
                          {(() => {
                            const needsNumber = ['minLength', 'maxLength', 'minimum', 'maximum',
                              'minItems', 'maxItems', 'minProperties', 'maxProperties', 'multipleOf']
                              .includes(val.type);
                            const needsText = ['pattern', 'itemsPattern', 'default', 'example', 'type'].includes(val.type);
                            const needsEnum = ['enum', 'itemsEnum'].includes(val.type);
                            const needsFormat = ['format', 'itemsFormat'].includes(val.type);
                            const needsBool = ['uniqueItems', 'exclusiveMinimum', 'exclusiveMaximum',
                              'required', 'optional'].includes(val.type);
                            if (needsNumber || needsText || needsEnum) {
                              const ph = needsEnum ? 'comma,separated' : val.type;
                              return (
                                <wa-input
                                  type={needsNumber ? 'number' : 'text'}
                                  style={{ width: needsNumber ? '120px' : '220px', marginRight: '0.5rem' }}
                                  value={val.value ?? ''}
                                  placeholder={ph}
                                  onInput={e => {
                                    const updated = [...prop.validations];
                                    updated[vIdx].value = e.target.value;
                                    changeProp('validations', updated);
                                  }}
                                  with-clear />
                              );
                            }
                            if (needsFormat) {
                              const opts = prop.type === 'string'
                                ? ['', 'date-time', 'email', 'uuid', 'uri']
                                : ['', 'int32', 'int64'];
                              return (
                                <wa-select
                                  style={{ width: '140px', marginRight: '0.5rem' }}
                                  value={val.value ?? ''}
                                  onChange={e => {
                                    const updated = [...prop.validations];
                                    updated[vIdx].value = e.target.value;
                                    changeProp('validations', updated);
                                  }}
                                  onInput={e => {
                                    const updated = [...prop.validations];
                                    updated[vIdx].value = e.target.value;
                                    changeProp('validations', updated);
                                  }}>
                                  {opts.map(o => <wa-option key={o} value={o}>{o || 'No format'}</wa-option>)}
                                </wa-select>
                              );
                            }
                            if (needsBool) {
                              return (
                                <wa-select
                                  style={{ width: '100px', marginRight: '0.5rem' }}
                                  value={val.value === undefined ? '' : String(val.value)}
                                  onChange={e => {
                                    const updated = [...prop.validations];
                                    updated[vIdx].value = e.target.value === 'true';
                                    changeProp('validations', updated);
                                  }}
                                  onInput={e => {
                                    const updated = [...prop.validations];
                                    updated[vIdx].value = e.target.value === 'true';
                                    changeProp('validations', updated);
                                  }}>
                                  <wa-option value="true">true</wa-option>
                                  <wa-option value="false">false</wa-option>
                                </wa-select>
                              );
                            }
                            return null;
                          })()}
                          <wa-button
                            variant="danger"
                            size="small"
                            style={{ marginLeft: '0.5rem', color: '#e96270ff', borderColor: '#e96270ff' }}
                            onClick={() => {
                              const updated = [...prop.validations];
                              updated.splice(vIdx, 1);
                              changeProp('validations', updated);
                            }}>
                            Remove
                          </wa-button>
                        </div>
                      ))}
                      {/* Add validation */}
                      <wa-button variant="brand" appearance="filled" size="small" style={{ marginTop: '0.5rem' }}
                        onClick={() => {
                          const updated = [...(prop.validations || [])];
                          const first = VALIDATION_TYPES[prop.type]?.[0] || '';
                          updated.push({ type: first, value: '' });
                          changeProp('validations', updated);
                        }}>
                        + Add Validation
                      </wa-button>
                    </div>
                  )}
                </div>
              );
            })}

            {totalPages > 1 && (
              <>
                <wa-divider></wa-divider>
                <div className="wa-split">
                  <span className="wa-caption-l">
                    Showing {startIndex + 1} to {endIndex} of {properties.length} Properties
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

export default Properties;
